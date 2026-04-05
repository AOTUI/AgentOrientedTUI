/**
 * @aotui/host - SystemPromptDrivenSource
 * 
 * 系统提示词驱动源
 * 
 * 职责:
 * - 注入系统提示词，告诉 LLM 角色定位
 * - timestamp = 0，确保在所有消息之前
 * - 不提供 tools，不执行 toolCall
 * - 静态消息，无需更新通知
 * 
 * 设计特点:
 * - **最高优先级**: timestamp=0，确保系统提示词排在第一位
 * - **单一职责**: 只负责系统提示词注入
 * - **不可变性**: 系统提示词在创建后不可变
 * - **无副作用**: 不执行任何操作，不触发任何事件
 */

import type { IDrivenSource, MessageWithTimestamp, ToolResult } from '@aotui/agent-driver-v2';
type StaticMessageWithTimestamp = MessageWithTimestamp & {
    region?: 'static';
};

/**
 * SystemPromptDrivenSource 配置
 */
export interface SystemPromptConfig {
    /** 系统提示词内容 */
    systemPrompt: string;
    /** 可选的元数据 */
    metadata?: Record<string, unknown>;
}

/**
 * SystemPromptDrivenSource
 * 
 * 通过 DrivenSource 模式注入系统提示词
 * 
 * @example
 * ```typescript
 * const source = new SystemPromptDrivenSource({
 *   systemPrompt: `You are an AI assistant with access to a TUI desktop.
 * 
 * Your capabilities:
 * - Access and interact with applications
 * - Execute tools to manage files
 * - Use AOTUI IDE for code editing
 * 
 * Guidelines:
 * - Always confirm before destructive operations
 * - Provide clear explanations
 * - Respect user privacy`,
 *   metadata: {
 *     version: '1.0',
 *     locale: 'en-US',
 *   },
 * });
 * 
 * const messages = await source.getMessages();
 * // [{ role: 'system', content: '...', timestamp: 0 }]
 * ```
 */
export class SystemPromptDrivenSource implements IDrivenSource {
    readonly name = 'SystemPrompt';
    
    private config: SystemPromptConfig;
    private listeners = new Set<() => void>();
    
    /**
     * 创建系统提示词驱动源
     * 
     * @param config - 配置对象
     */
    constructor(config: SystemPromptConfig) {
        this.config = config;
        
        // 验证系统提示词不为空
        if (!config.systemPrompt || config.systemPrompt.trim().length === 0) {
            throw new Error('SystemPromptDrivenSource: systemPrompt cannot be empty');
        }
    }
    
    /**
     * 获取消息
     * 
     * 返回单条系统消息，timestamp = 0
     * 
     * @returns 系统提示词消息数组（长度为 1）
     */
    async getMessages(): Promise<MessageWithTimestamp[]> {
        return [{
            role: 'system',
            content: this.config.systemPrompt,
            timestamp: 0, // ✅ 确保第一位
            region: 'static',
        } as StaticMessageWithTimestamp];
    }

    /**
     * 动态更新系统提示词
     */
    setSystemPrompt(systemPrompt: string): void {
        const nextPrompt = systemPrompt?.trim();
        if (!nextPrompt) {
            throw new Error('SystemPromptDrivenSource: systemPrompt cannot be empty');
        }
        if (nextPrompt === this.config.systemPrompt) {
            return;
        }
        this.config = {
            ...this.config,
            systemPrompt: nextPrompt,
        };
        this.listeners.forEach((listener) => listener());
    }

    getSystemPrompt(): string {
        return this.config.systemPrompt;
    }
    
    /**
     * 获取工具
     * 
     * SystemPrompt 不提供工具
     * 
     * @returns 空对象
     */
    async getTools(): Promise<Record<string, any>> {
        return {}; // 不提供工具
    }
    
    /**
     * 执行工具
     * 
     * SystemPrompt 不执行工具
     * 
     * @returns undefined（表示不处理）
     */
    async executeTool(
        _toolName: string,
        _args: unknown,
        _toolCallId: string
    ): Promise<ToolResult | undefined> {
        return undefined; // 不执行工具
    }
    
    /**
     * 订阅更新
     * 
     * SystemPrompt 是静态的，不会变化
     * 
     * @returns 空的取消订阅函数
     */
    onUpdate(callback: () => void): () => void {
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }
    
    /**
     * 获取配置元数据
     * 
     * @returns 元数据对象
     */
    getMetadata(): Record<string, unknown> {
        return this.config.metadata || {};
    }
}
