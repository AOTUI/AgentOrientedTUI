/**
 * @aotui/runtime - AOTUIDrivenSource
 * 
 * AOTUI Runtime 到 AgentDriver V2 的适配器
 * 
 * 职责:
 * - 适配 IDesktop 和 IKernel 到 IDrivenSource 接口
 * - 获取 TUI App 状态 (getMessages)
 * - 获取 Operations (getTools)
 * - 执行 Operations (executeTool)
 * - 监听各类信号 (onUpdate)
 */

import type { IDrivenSource, MessageWithTimestamp, ToolResult } from '@aotui/agent-driver-v2';
import { jsonSchema } from 'ai';
import type { IDesktop, IKernel, Operation, OperationID } from '../spi/index.js';

// ============================================================================
// Local Interfaces (解决 SPI 类型缺失问题)
// ============================================================================

/** Operation 参数定义 */
interface OperationParamDef {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'enum' | 'reference';
    description?: string;
    required?: boolean;
    // array 类型需要 itemType
    itemType?: 'string' | 'number' | 'boolean' | 'object';
    // enum 类型需要 options
    options?: readonly string[];
    // reference 类型需要 refType
    refType?: string;
}

/** IndexMap 中的 Operation 条目结构 */
interface IndexMapOperationEntry {
    type: 'operation';
    appId: string;
    operation: {
        id: string;
        displayName?: string;
        params: OperationParamDef[];
    };
}

interface IndexMapTypeToolEntry {
    description: string;
    params: OperationParamDef[];
    appId?: string;
    appName?: string;
    viewType?: string;
    toolName?: string;
}

// ============================================================================
// AOTUI System Instruction（Runtime 默认内置，可通过 options/env/path 覆盖）
// ============================================================================

import { readFileSync } from 'fs';
import { DEFAULT_AOTUI_SYSTEM_INSTRUCTION } from './system-instruction.js';

const AOTUI_SYSTEM_INSTRUCTION_PATH_ENV = 'AOTUI_SYSTEM_INSTRUCTION_PATH';

/**
 * 懒加载 AOTUI System Instruction
 */
function loadSystemInstruction(instructionPath?: string): string {
    if (!instructionPath) {
        return DEFAULT_AOTUI_SYSTEM_INSTRUCTION;
    }

    try {
        return readFileSync(instructionPath, 'utf-8');
    } catch (error) {
        console.error(
            `[AOTUIDrivenSource] Failed to load system instruction from path: ${instructionPath}`,
            error
        );
        return DEFAULT_AOTUI_SYSTEM_INSTRUCTION;
    }
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * AOTUIDrivenSource 配置
 */
export interface AOTUIDrivenSourceOptions {
    /**
     * 是否注入 AOTUI System Instruction
     * 默认: true
     */
    includeInstruction?: boolean;

    /**
     * 直接覆盖 system instruction 内容
     * 优先级最高
     */
    instruction?: string;

    /**
     * 从指定路径加载 system instruction
     * 优先级低于 instruction，高于环境变量
     */
    instructionPath?: string;
}

/**
 * AOTUI Driven Source (Enhanced)
 * 
 * 将 AOTUI Runtime 暴露给 AgentDriver V2
 * 
 * 设计改进 (RFC: Topic-Desktop Sync):
 * - 注入 AOTUI System Instruction (timestamp=1)
    * - Desktop State timestamp 取最新 app fragment 的时间戳
 * - 优化 Tool 提取逻辑
 */
export class AOTUIDrivenSource implements IDrivenSource {
    readonly name = 'AOTUI';
    
    private includeInstruction: boolean;
    private systemInstruction: string;
    private sourceEnabled = true;
    private disabledApps = new Set<string>();
    private listeners = new Set<() => void>();

    constructor(
        private desktop: IDesktop,
        private kernel: IKernel,
        options?: AOTUIDrivenSourceOptions
    ) {
        this.includeInstruction = options?.includeInstruction ?? true;

        const instructionFromOptions = options?.instruction?.trim();
        const instructionFromPath = options?.instructionPath;
        const instructionFromEnv = process.env[AOTUI_SYSTEM_INSTRUCTION_PATH_ENV];

        this.systemInstruction = instructionFromOptions && instructionFromOptions.length > 0
            ? instructionFromOptions
            : loadSystemInstruction(instructionFromPath ?? instructionFromEnv);
    }

    setEnabled(enabled: boolean): void {
        this.sourceEnabled = enabled;
        this.triggerUpdate();
    }

    setAppEnabled(appName: string, enabled: boolean): void {
        const normalized = this.normalizeAppKey(appName);
        if (!normalized) {
            return;
        }

        if (enabled) {
            this.disabledApps.delete(normalized);
        } else {
            this.disabledApps.add(normalized);
        }

        this.triggerUpdate();
    }

    private triggerUpdate(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }

    private normalizeAppKey(value: unknown): string {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim();
    }

    private resolveAppName(appId?: string): string | undefined {
        if (!appId) {
            return undefined;
        }

        try {
            const info = (this.desktop as any).getAppInfo?.(appId);
            if (info && typeof info.name === 'string') {
                return info.name;
            }
        } catch {
        }

        return undefined;
    }

    private isAppAllowed(appId?: string, appName?: string): boolean {
        if (!this.sourceEnabled) {
            return false;
        }

        if (this.disabledApps.size === 0) {
            return true;
        }

        const normalizedId = this.normalizeAppKey(appId);
        const normalizedName = this.normalizeAppKey(appName);

        if (normalizedId && this.disabledApps.has(normalizedId)) {
            return false;
        }

        if (normalizedName && this.disabledApps.has(normalizedName)) {
            return false;
        }

        return true;
    }

    /**
     * 获取消息 (AOTUI System Instruction + TUI App Snapshots)
     * 
     * 使用 Pull-Lease 机制获取最新快照
     * 
     * 消息顺序:
     * 1. AOTUI System Instruction (timestamp=1, role='system')
    * 2. Desktop State (timestamp=latest app fragment, role='user')
     */
    async getMessages(): Promise<MessageWithTimestamp[]> {
        if (!this.sourceEnabled) {
            return [];
        }

        const messages: MessageWithTimestamp[] = [];
        
        // 1. 注入 AOTUI System Instruction (仅一次)
        if (this.includeInstruction) {
            messages.push({
                role: 'system',
                content: this.systemInstruction,
                timestamp: 1, // ✅ 在 SystemPrompt (0) 之后，在用户消息之前
            });
        }
        
        // 2. 获取 Desktop 的 Snapshot (Pull-Lease)
        const snapshot = await this.kernel.acquireSnapshot(this.desktop.id);

        try {
            const baseTimestamp = snapshot.createdAt || Date.now();

            const desktopTimestamp = 2;

            // 3. 优先使用结构化 Snapshot (RFC-014)
            if (snapshot.structured?.appStates) {
                if (snapshot.structured.desktopState && this.disabledApps.size === 0) {
                    messages.push({
                        role: 'user',
                        content: snapshot.structured.desktopState,
                        timestamp: desktopTimestamp
                    });
                }

                for (const fragment of snapshot.structured.appStates) {
                    const fragmentAppId = this.normalizeAppKey((fragment as any).appId);
                    const fragmentAppName = this.normalizeAppKey((fragment as any).appName)
                        || this.normalizeAppKey(this.resolveAppName(fragmentAppId));

                    if (!this.isAppAllowed(fragmentAppId, fragmentAppName)) {
                        continue;
                    }

                    messages.push({
                        role: 'user',
                        content: `${fragment.markup}`,
                        timestamp: fragment.timestamp ?? baseTimestamp
                    });
                }
            }
            // 4. 回退到旧的 markup 解析 (如果需要)
            else if (snapshot.markup && this.disabledApps.size === 0) {
                messages.push({
                    role: 'user',
                    content: `# TUI Desktop State\n\n${snapshot.markup}`,
                    timestamp: baseTimestamp
                });
            }

            return messages;
        } finally {
            // 5. 释放 Snapshot (Pull-Lease)
            this.kernel.releaseSnapshot(snapshot.id);
        }
    }

    /**
     * 获取工具 (Operations)
     *
     * 从 IndexMap 提取所有 operations
     *
    * 重要: AI SDK v6 使用 inputSchema 字段而不是 parameters。
    * 如果传入 parameters，inputSchema 为 undefined，会被推断成空 schema。
     */
    async getTools(): Promise<Record<string, any>> {
        if (!this.sourceEnabled) {
            return {};
        }

        const snapshot = await this.kernel.acquireSnapshot(this.desktop.id);

        try {
            const tools: Record<string, any> = {};

            if (snapshot.indexMap) {
                for (const [key, value] of Object.entries(snapshot.indexMap)) {
                    // 1. 传统 Operation Entry (type === 'operation')
                    if (this.isOperationEntry(value)) {
                        if (!this.isAppAllowed(value.appId, this.resolveAppName(value.appId))) {
                            continue;
                        }

                        const op = value.operation;
                        const schema = this.convertParamsToJsonSchema(op.params);
                        tools[op.id] = {
                            description: op.displayName || op.id,
                            inputSchema: jsonSchema(schema),
                        };
                    }
                    // 2. useViewTypeTool 注册的工具 (key 以 'tool:' 开头)
                    else if (key.startsWith('tool:') && this.isTypeToolEntry(value)) {
                        if (!this.isAppAllowed(value.appId, value.appName || this.resolveAppName(value.appId))) {
                            continue;
                        }

                        const toolId = key.slice(5);
                        const params = (value as any).params || [];
                        const schema = this.convertParamsToJsonSchema(params);

                        tools[toolId] = {
                            description: (value as any).description || toolId,
                            inputSchema: jsonSchema(schema),
                        };
                    }
                }
            }

            const systemTools = this.kernel.getSystemToolDefinitions?.() || [];
            for (const tool of systemTools) {
                const fn = (tool as any).function;
                const toolName = fn?.name;
                if (!toolName || tools[toolName]) {
                    continue;
                }

                const schema = fn?.parameters || { type: 'object', properties: {}, required: [] };
                tools[toolName] = {
                    description: fn?.description || toolName,
                    inputSchema: jsonSchema(schema),
                };
            }

            return tools;
        } finally {
            this.kernel.releaseSnapshot(snapshot.id);
        }
    }

    /**
     * 执行工具 (Operation)
     * 
     * 使用 Kernel.execute() 执行 Operation
     */
    async executeTool(
        toolName: string,
        args: unknown,
        toolCallId: string
    ): Promise<ToolResult | undefined> {
        if (!this.sourceEnabled) {
            return {
                toolCallId,
                toolName,
                error: {
                    code: 'E_SOURCE_DISABLED',
                    message: 'AOTUI source is disabled for this topic',
                },
            };
        }

        const ownerId = 'agent-driver';
        let appId = 'system';
        let viewId: string | undefined;
        let operationName = toolName;

        if (toolName.startsWith('system-')) {
            operationName = toolName.slice('system-'.length);
        } else if (toolName.includes('.')) {
            const parts = toolName.split('.');
            if (parts.length >= 3) {
                appId = parts[0] || 'system';
                viewId = parts[1];
                operationName = parts.slice(2).join('.');
            } else if (parts.length === 2) {
                appId = parts[0] || 'system';
                operationName = parts[1];
            }
        } else {
            // Preferred path: resolve from snapshot indexMap metadata
            const typeToolContext = await this.resolveTypeToolContext(toolName);
            if (typeToolContext) {
                appId = typeToolContext.appId;
                viewId = typeToolContext.viewType;
                operationName = typeToolContext.toolName;
            } else if (toolName.startsWith('app_') && toolName.includes('-')) {
                // Backward compatibility: app_id-view_type-tool_name
                const [appIdPart, viewTypePart, ...rest] = toolName.split('-');
                if (appIdPart && viewTypePart && rest.length > 0) {
                    appId = appIdPart;
                    viewId = viewTypePart;
                    operationName = rest.join('-');
                }
            }
        }
        // 1. 构建 Operation
        const operation: Operation = {
            context: {
                appId: appId as any,
                viewId: viewId as any,
                snapshotId: 'latest' as any // 暂定
            },
            name: operationName as OperationID,
            args: args as Record<string, unknown>
        };

        // TODO: 真正的实现需要从 IndexMap 中查找 Operation context
        // 这里简化处理，假设 ToolName 就是 OperationID
        // 实际上 IndexMap 中包含了 correct context (appId, etc.)

        if (appId !== 'system' && !this.isAppAllowed(appId, this.resolveAppName(appId))) {
            return {
                toolCallId,
                toolName,
                error: {
                    code: 'E_APP_DISABLED',
                    message: `App "${this.resolveAppName(appId) || appId}" is disabled for this topic`,
                },
            };
        }

        // 3. 执行 Operation
        try {
            // 注意：kernel.execute 签名可能不同，这里根据之前的 outline 调整
            // Kernel.execute(desktopId, operation, ownerId)
            this.kernel.acquireLock(this.desktop.id, ownerId);
            const result = await this.kernel.execute(this.desktop.id, operation, ownerId);

            // 4. 转换为 ToolResult
            if (result.success) {
                return {
                    toolCallId,
                    toolName,
                    result: result.data || { success: true }
                };
            } else {
                return {
                    toolCallId,
                    toolName,
                    error: {
                        code: result.error?.code || 'E_EXECUTION_FAILED',
                        message: result.error?.message || 'Unknown error'
                    }
                };
            }
        } catch (error) {
            return {
                toolCallId,
                toolName,
                error: {
                    code: 'E_EXCEPTION',
                    message: error instanceof Error ? error.message : String(error)
                }
            };
        } finally {
            this.kernel.releaseLock(this.desktop.id, ownerId);
        }
    }

    private async resolveTypeToolContext(toolName: string): Promise<{ appId: string; viewType: string; toolName: string } | null> {
        const snapshot = await this.kernel.acquireSnapshot(this.desktop.id);
        try {
            const key = `tool:${toolName}`;
            const entry = snapshot.indexMap?.[key];
            if (!this.isTypeToolEntry(entry)) {
                return null;
            }

            const appId = entry.appId;
            const viewType = entry.viewType;
            const resolvedToolName = entry.toolName;

            if (
                typeof appId === 'string' && appId.length > 0 &&
                typeof viewType === 'string' && viewType.length > 0 &&
                typeof resolvedToolName === 'string' && resolvedToolName.length > 0
            ) {
                return {
                    appId,
                    viewType,
                    toolName: resolvedToolName,
                };
            }

            return null;
        } finally {
            this.kernel.releaseSnapshot(snapshot.id);
        }
    }

    /**
     * 订阅更新
     */
    onUpdate(callback: () => void): () => void {
        const signalListener = () => callback();
        this.listeners.add(callback);

        // [Fix] output is a property, not a method
        const outputStream = this.desktop.output;

        // 订阅
        outputStream.subscribe(signalListener);

        // 返回取消订阅函数
        return () => {
            this.listeners.delete(callback);
            outputStream.unsubscribe(signalListener);
        };
    }

    /**
     * 类型守卫: 判断是否为 Operation Entry
     */
    private isOperationEntry(entry: unknown): entry is IndexMapOperationEntry {
        return (
            typeof entry === 'object' &&
            entry !== null &&
            (entry as any).type === 'operation' &&
            (entry as any).operation &&
            Array.isArray((entry as any).operation.params)
        );
    }

    /**
     * 类型守卫: 判断是否为 useViewTypeTool 注册的工具
     * 格式: { description: string, params: Array<{ name, type, required, description }> }
     */
    private isTypeToolEntry(entry: unknown): entry is IndexMapTypeToolEntry {
        return (
            typeof entry === 'object' &&
            entry !== null &&
            typeof (entry as any).description === 'string' &&
            Array.isArray((entry as any).params)
        );
    }

    /**
     * 将 Operation params 转换为 JSON Schema
     */
    private convertParamsToJsonSchema(params: OperationParamDef[]): Record<string, unknown> {
        const properties: Record<string, Record<string, unknown>> = {};
        const required: string[] = [];

        for (const param of params) {
            let schema: Record<string, unknown>;

            switch (param.type) {
                case 'string':
                    schema = { type: 'string' };
                    break;
                case 'number':
                    schema = { type: 'number' };
                    break;
                case 'boolean':
                    schema = { type: 'boolean' };
                    break;
                case 'object':
                    schema = { type: 'object' };
                    break;
                case 'array': {
                    const itemType = param.itemType || 'string';
                    let items: Record<string, unknown>;
                    switch (itemType) {
                        case 'string':
                            items = { type: 'string' };
                            break;
                        case 'number':
                            items = { type: 'number' };
                            break;
                        case 'boolean':
                            items = { type: 'boolean' };
                            break;
                        case 'object':
                            items = { type: 'object' };
                            break;
                        default:
                            items = {};
                    }
                    schema = { type: 'array', items };
                    break;
                }
                case 'enum':
                    if (param.options && param.options.length > 0) {
                        schema = { type: 'string', enum: param.options };
                    } else {
                        schema = { type: 'string' };
                    }
                    break;
                case 'reference':
                    schema = { type: 'string' };
                    break;
                default:
                    console.warn(`[AOTUI] Unknown param type: "${param.type}", defaulting to string`);
                    schema = { type: 'string' };
            }

            if (param.description) {
                schema.description = param.description;
            }

            if (param.required) {
                required.push(param.name);
            }

            properties[param.name] = schema;
        }

        return {
            type: 'object',
            properties,
            ...(required.length > 0 ? { required } : {}),
        };
    }
}
