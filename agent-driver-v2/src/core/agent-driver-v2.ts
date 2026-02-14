/**
 * @aotui/agent-driver-v2 - AgentDriver V2 Core
 * 
 * 多源消息聚合器，负责：
 * 1. 聚合来自多个 DrivenSource 的消息和工具
 * 2. 按时间戳排序消息
 * 3. 路由 ToolCall 到对应的 DrivenSource
 * 4. 管理工作循环
 * 
 * 设计原则：
 * - **依赖反转**: 依赖 IDrivenSource 接口，不依赖具体实现
 * - **职责清晰**: AgentDriver 只负责聚合和路由，不负责业务逻辑
 * - **可扩展**: 易于添加新的 DrivenSource
 */

import type { ModelMessage, Tool } from 'ai';
import type {
    IDrivenSource,
    MessageWithTimestamp,
    ToolResult,
    AgentDriverV2Config,
    AgentState,
} from './interfaces.js';
import { debounce } from '../utils/debounce.js';
import { Logger } from '../utils/logger.js';
import { LLMClient } from './llm-client.js';

/**
 * AgentDriverV2 - 核心类
 */
export class AgentDriverV2 {
    private static nextId = 1;

    private readonly driverId: number;
    private sources: IDrivenSource[];
    private unsubscribers: (() => void)[] = [];
    private updateDebounced: () => void;
    private logger: Logger;
    private config: AgentDriverV2Config;
    private llmClient: LLMClient;

    // 状态机
    private state: AgentState = 'idle';
    private pending = false;
    private runInFlight: Promise<void> | null = null;
    private lastInputSignature: string | null = null;
    private toolFailureStreak = 0;

    // Tool → Source 映射
    private toolToSourceMap = new Map<string, IDrivenSource>();

    private running = false;

    constructor(config: AgentDriverV2Config) {
        this.config = config;
        this.sources = config.sources;
        this.logger = new Logger('AgentDriverV2');
        this.llmClient = new LLMClient(config.llm);
        this.driverId = AgentDriverV2.nextId++;

        // 创建防抖的更新处理函数
        const debounceMs = config.workLoop?.debounceMs ?? 300;
        this.updateDebounced = debounce(() => {
            // handleUpdate 现在不阻塞，可以安全调用
            this.handleUpdate().catch((error) => {
                this.logger.error('Error in debounced handleUpdate:', error);
            });
        }, debounceMs);

        this.setupUpdateListeners();
        this.start(); // 启动事件循环
    }

    /**
     * 获取 Driver 实例 ID (用于排查多实例并发)
     */
    getId(): number {
        return this.driverId;
    }

    /**
     * 获取当前状态 (用于测试)
     */
    getState(): AgentState {
        return this.state;
    }

    /**
     * 是否有待处理的更新 (用于测试)
     */
    hasPendingUpdate(): boolean {
        return this.pending;
    }

    /**
     * 获取 Tool 对应的 Source (用于测试)
     */
    getToolSource(toolName: string): IDrivenSource | undefined {
        return this.toolToSourceMap.get(toolName);
    }

    /**
     * 设置更新监听器
     * 
     * 订阅所有 DrivenSource 的更新事件
     */
    private setupUpdateListeners(): void {
        this.sources.forEach((source) => {
            const unsubscribe = source.onUpdate(() => {
                this.logger.debug(`Update signal from source: ${source.name}`);
                this.updateDebounced();
            });
            this.unsubscribers.push(unsubscribe);
        });

        this.logger.info(`Listening to ${this.sources.length} driven sources`);
    }

    /**
     * 收集所有消息
     * 
     * ✅ 简化: 直接聚合，按时间戳排序
     * - 每个 source 已经保证消息去重
     * - AgentDriver 只需拼接并排序
     */
private async collectMessages(): Promise<ModelMessage[]> {
        const allMessages: MessageWithTimestamp[] = [];

        for (const source of this.sources) {
            try {
                const messages = await source.getMessages();
                allMessages.push(...messages);
                this.logger.debug(
                    `Collected ${messages.length} messages from ${source.name}`
                );
            } catch (error) {
                this.logger.error(
                    `Failed to collect messages from ${source.name}:`,
                    error
                );
            }
        }

        // 按时间戳排序
        allMessages.sort((a, b) => a.timestamp - b.timestamp);

        this.logger.info(`Total messages collected: ${allMessages.length}`);

        // 移除 timestamp 字段，返回纯 ModelMessage（同时修复历史消息结构）
        const normalized = allMessages
            .map(({ timestamp, ...message }) => message as ModelMessage)
            .map((message) => {
                if (message.role === 'assistant') {
                    if (typeof message.content === 'string') {
                        const trimmed = message.content.trim();
                        if (trimmed === '') {
                            return null;
                        }

                        try {
                            const parsed = JSON.parse(trimmed);
                            if (Array.isArray(parsed) && parsed.every((part) => part && typeof part === 'object' && typeof part.type === 'string')) {
                                message = { ...message, content: parsed } as ModelMessage;
                            }
                        } catch {
                            // Not JSON; keep as string.
                        }
                    }

                    if (Array.isArray(message.content) && message.content.length === 0) {
                        return null;
                    }
                }

                if (message.role === 'tool' && Array.isArray(message.content)) {
                    const content = message.content.map((part: any) => {
                        if (part?.type !== 'tool-result') {
                            return part;
                        }

                        let output = part.output;
                        if (output === undefined && part.result !== undefined) {
                            output = part.result;
                        }

                        if (output && typeof output === 'object' && 'type' in output) {
                            return { ...part, output };
                        }

                        const wrapped = part.error
                            ? { type: 'error-json', value: part.error }
                            : { type: 'json', value: output ?? null };

                        return { ...part, output: wrapped };
                    });
                    return { ...message, content } as ModelMessage;
                }

                return message;
            })
            .filter((message): message is ModelMessage => message !== null);

        const getToolCallIds = (message: ModelMessage): string[] => {
            if (message.role !== 'assistant' || !Array.isArray(message.content)) {
                return [];
            }

            return message.content
                .filter((part: any) => part?.type === 'tool-call' && typeof part.toolCallId === 'string')
                .map((part: any) => part.toolCallId as string);
        };

        const getToolResultIds = (message: ModelMessage): string[] => {
            if (message.role !== 'tool' || !Array.isArray(message.content)) {
                return [];
            }

            return message.content
                .filter((part: any) => part?.type === 'tool-result' && typeof part.toolCallId === 'string')
                .map((part: any) => part.toolCallId as string);
        };

        const toolMessages = normalized.filter((message) => message.role === 'tool');
        const nonToolMessages = normalized.filter((message) => message.role !== 'tool');
        const usedToolMessages = new Set<number>();
        const reordered: ModelMessage[] = [];

        for (const message of nonToolMessages) {
            reordered.push(message);

            const toolCallIds = getToolCallIds(message);
            if (toolCallIds.length === 0) {
                continue;
            }

            const toolIndex = toolMessages.findIndex((toolMessage, index) => {
                if (usedToolMessages.has(index)) {
                    return false;
                }
                const toolResultIds = getToolResultIds(toolMessage);
                return toolResultIds.some((id) => toolCallIds.includes(id));
            });

            if (toolIndex >= 0) {
                usedToolMessages.add(toolIndex);
                reordered.push(toolMessages[toolIndex]);
            }
        }

        for (let index = 0; index < toolMessages.length; index += 1) {
            if (!usedToolMessages.has(index)) {
                reordered.push(toolMessages[index]);
            }
        }

        return reordered;
    }

    /**
     * 收集所有工具
     */
    private async collectTools(): Promise<Record<string, Tool>> {
        const allTools: Record<string, Tool> = {};

        for (const source of this.sources) {
            try {
                const tools = await source.getTools();
                Object.assign(allTools, tools);
                this.logger.debug(
                    `Collected ${Object.keys(tools).length} tools from ${source.name}`
                );
            } catch (error) {
                this.logger.error(
                    `Failed to collect tools from ${source.name}:`,
                    error
                );
            }
        }

        this.logger.info(`Total tools collected: ${Object.keys(allTools).length}`);

        return allTools;
    }

    /**
     * 执行工具调用
     * 
     * ✅ 优化: 使用 Tool → Source 映射，避免遍历
     */
    private async executeToolCalls(
        toolCalls: Array<{
            toolCallId: string;
            toolName: string;
            args: unknown;
        }>
    ): Promise<ToolResult[]> {
        const results: ToolResult[] = [];

        for (const toolCall of toolCalls) {
            // 使用映射查找对应的 source
            const source = this.toolToSourceMap.get(toolCall.toolName);

            if (source) {
                try {
                    const result = await source.executeTool(
                        toolCall.toolName,
                        toolCall.args,
                        toolCall.toolCallId
                    );

                    if (result) {
                        results.push(result);
                        this.logger.debug(
                            `Tool ${toolCall.toolName} executed by ${source.name}`
                        );
                    } else {
                        // Source 返回 undefined，Tool 不属于它
                        this.logger.warn(
                            `Tool ${toolCall.toolName} not found in ${source.name}`
                        );
                        results.push({
                            toolCallId: toolCall.toolCallId,
                            toolName: toolCall.toolName,
                            error: {
                                code: 'E_TOOL_NOT_FOUND',
                                message: `Tool ${toolCall.toolName} not found`,
                            },
                        });
                    }
                } catch (error) {
                    this.logger.error(
                        `Error executing tool ${toolCall.toolName}:`,
                        error
                    );
                    results.push({
                        toolCallId: toolCall.toolCallId,
                        toolName: toolCall.toolName,
                        error: {
                            code: 'E_EXECUTION_ERROR',
                            message:
                                error instanceof Error
                                    ? error.message
                                    : String(error),
                        },
                    });
                }
            } else {
                // 没有找到对应的 source
                this.logger.warn(
                    `No DrivenSource found for tool: ${toolCall.toolName}`
                );
                results.push({
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    error: {
                        code: 'E_TOOL_NOT_FOUND',
                        message: `No DrivenSource can execute tool: ${toolCall.toolName}`,
                    },
                });
            }
        }

        return results;
    }

    /**
     * 更新 Tool → Source 映射
     */
    private async updateToolMapping(): Promise<void> {
        this.toolToSourceMap.clear();

        for (const source of this.sources) {
            try {
                const tools = await source.getTools();
                for (const toolName of Object.keys(tools)) {
                    this.toolToSourceMap.set(toolName, source);
                }
            } catch (error) {
                this.logger.error(
                    `Failed to update tool mapping from ${source.name}:`,
                    error
                );
            }
        }

        this.logger.debug(
            `Tool mapping updated: ${this.toolToSourceMap.size} tools`
        );
    }

    /**
     * 设置状态
     */
    private async setState(newState: AgentState): Promise<void> {
        const oldState = this.state;
        if (oldState === newState) return;

        this.logger.info(`State transition: ${oldState} → ${newState}`);
        this.state = newState;

        // 触发状态变化回调
        if (this.config.onStateChange) {
            this.config.onStateChange(oldState, newState);
        }
    }

    /**
     * 处理更新信号
     * 
     * ✅ 修复后：非阻塞模式，只负责设置标志位和唤醒
     * 
     * 核心改进：
     * - 不再阻塞等待 idle 状态
     * - 只设置 pendingUpdate 标志位
     * - 尝试唤醒主循环（即使丢失信号也无妨，Loop 会检查标志位）
     */
    private async handleUpdate(): Promise<void> {
        this.requestRun();
    }

    /**
     * 请求调度一次 run
     * 
     * 语义：多次更新信号合并为一次 run
     */
    private requestRun(): void {
        if (!this.running) {
            return;
        }

        this.pending = true;
        void this.drainPendingRuns();
    }

    /**
     * 单飞行 drain：保证 run 非重入，且合并连续更新
     */
    private async drainPendingRuns(): Promise<void> {
        if (this.runInFlight) {
            return;
        }

        this.runInFlight = (async () => {
            do {
                this.pending = false;
                await this.run();
            } while (this.pending && this.running);
        })().finally(() => {
            this.runInFlight = null;
        });

        await this.runInFlight;
    }

    /**
     * 生成输入签名，用于跳过重复输入的 LLM 调用
     */
    private buildInputSignature(
        messages: ModelMessage[],
        tools: Record<string, Tool>
    ): string {
        const toolNames = Object.keys(tools).sort();
        const toolSignature = toolNames.join('|');

        const messageSignature = messages
            .map((message) => {
                const content =
                    typeof message.content === 'string'
                        ? message.content
                        : JSON.stringify(message.content);
                return `${message.role}:${this.hashString(content)}`;
            })
            .join('|');

        return `${messages.length}:${messageSignature}::${toolNames.length}:${toolSignature}`;
    }

    /**
     * 简单字符串哈希（32-bit），避免完整内容参与签名
     */
    private hashString(value: string): string {
        let hash = 0;
        for (let i = 0; i < value.length; i += 1) {
            hash = (hash << 5) - hash + value.charCodeAt(i);
            hash |= 0; // Convert to 32-bit integer
        }
        return hash.toString(16);
    }

    /**
     * 运行主循环 (一次 run)
     * 
     * 完整的 LLM ReAct 循环：
     * 1. 收集 Messages 和 Tools
     * 2. 调用 LLM
     * 3. 如果有 ToolCalls:
     *    - 执行 ToolCalls
     *    - 等待 Source 发送新信号 (Tool 执行完成后)
     * 4. 回到 idle 状态
     */
    private async run(): Promise<void> {
        await this.setState('thinking');

        try {
            // 1. 收集 Messages 和 Tools
            const messages = await this.collectMessages();
            const tools = await this.collectTools();
            await this.updateToolMapping();

            const inputSignature = this.buildInputSignature(messages, tools);
            if (this.lastInputSignature === inputSignature) {
                this.logger.info('Skipping LLM call: inputs unchanged');
                await this.setState('idle');
                return;
            }

            this.lastInputSignature = inputSignature;

            this.logger.info('Run iteration:', {
                messagesCount: messages.length,
                toolsCount: Object.keys(tools).length,
            });

            // 2. 调用 LLM
            const response = await this.llmClient.call(messages, tools);

            this.logger.info('LLM response:', {
                textLength: response.text.length,
                toolCallsCount: response.toolCalls.length,
                finishReason: response.finishReason,
            });

            if (response.usage && this.config.onLLMUsage) {
                this.config.onLLMUsage(response.usage);
            }

            // ✅ 新增: 发射 assistant message 事件
            if (response.assistantMessage && this.config.onAssistantMessage) {
                console.log('\n=== AgentDriver calling onAssistantMessage ===');
                console.log('Message:', JSON.stringify(response.assistantMessage, null, 2));
                console.log('Callback exists:', !!this.config.onAssistantMessage);
                console.log('=============================================\n');
                
                this.logger.debug('Emitting onAssistantMessage event');
                this.config.onAssistantMessage(response.assistantMessage);
            } else {
                console.log('\n⚠️  onAssistantMessage NOT called!');
                console.log('assistantMessage:', response.assistantMessage);
                console.log('callback exists:', !!this.config.onAssistantMessage);
                console.log('\n');
            }

            // 3. 如果有 ToolCalls
            if (response.toolCalls && response.toolCalls.length > 0) {
                await this.setState('executing');

                this.logger.info(`Executing ${response.toolCalls.length} tool calls...`);

                // 执行所有 ToolCalls
                const results = await this.executeToolCalls(response.toolCalls);

                this.logger.info('Tool execution completed:', {
                    resultsCount: results.length,
                    successCount: results.filter(r => !r.error).length,
                    errorCount: results.filter(r => r.error).length,
                });

                // ✅ 新增: 发射 toolresult message 事件
                if (this.config.onToolResult) {
                    const toolMessage = this.createToolMessage(results);
                    this.logger.debug('Emitting onToolResult event');
                    this.config.onToolResult(toolMessage);
                }

                const hasToolFailure = results.some((result) => Boolean(result.error));
                if (hasToolFailure) {
                    this.toolFailureStreak += 1;
                    if (this.toolFailureStreak < 3) {
                        this.pending = true;
                    } else {
                        this.logger.warn('Tool execution failed 3 times; stopping auto-retry');
                    }
                } else {
                    this.toolFailureStreak = 0;
                }

                // ✅ 关键改进: 执行完 Tool 后，不立即进入下一循环
                // 而是回到 idle，等待 Source 发送新信号
                // 
                // 原因：
                // - Tool 执行完成后，Source 需要更新状态 (如 TUI App 更新 Snapshot)
                // - Source 更新后会发送新信号，AgentDriver 再次进入循环
                // - 这样可以确保 LLM 看到最新的状态
                this.logger.info('Tool execution finished. Returning to idle, waiting for source signals...');
            } else {
                // 没有 ToolCalls，说明 LLM 完成了思考
                this.logger.info('No tool calls. LLM finished thinking.');
                this.toolFailureStreak = 0;
            }

            // 回到 idle 状态
            await this.setState('idle');

        } catch (error) {
            this.logger.error('Error in run loop:', error);
            await this.setState('idle');
        }
    }

    /**
     * 创建 Tool Message
     * 
     * 将 ToolResult[] 转换为 Vercel AI SDK 的 CoreToolMessage
     * 
     * @param results - ToolResult 数组
     * @returns Tool Message
     */
    private createToolMessage(results: ToolResult[]): ModelMessage {
        return {
            role: 'tool',
            content: results.map((result) => ({
                type: 'tool-result' as const,
                toolCallId: result.toolCallId,
                toolName: result.toolName,
                output: result.error
                    ? { type: 'error-json', value: result.error }
                    : { type: 'json', value: result.result ?? { success: true } },
            })) as any,
        };
    }

    /**
     * 启动 AgentDriver
     */
    start(): void {
        if (this.running) {
            this.logger.warn('AgentDriver already running');
            return;
        }

        this.running = true;
        this.logger.info('AgentDriver started');
    }

    /**
     * 停止 AgentDriver
     */
    stop(): void {
        this.running = false;
        this.logger.info('AgentDriver stopped');
    }

    /**
     * 手动触发工作循环
     * 
     * 用于测试或手动触发
     */
    async trigger(): Promise<void> {
        if (this.state !== 'idle') {
            this.logger.warn('AgentDriver is busy, marking update instead');
        }

        this.requestRun();
    }

    /**
     * 清理资源
     */
    dispose(): void {
        this.unsubscribers.forEach((fn) => fn());
        this.unsubscribers = [];
        this.logger.info('AgentDriver V2 disposed');
    }
    
}
