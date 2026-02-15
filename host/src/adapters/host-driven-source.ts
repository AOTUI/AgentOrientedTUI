/**
 * @aotui/host - HostDrivenSource V2
 * 
 * 完全对齐 AI SDK v6，零转换成本
 * 
 * 职责:
 * - ✅ 直接返回 AI SDK v6 的 ModelMessage
 * - ✅ 不做任何类型转换
 * - ✅ Host 只负责存储和检索
 */

import type { MessageWithTimestamp } from '@aotui/agent-driver-v2';
import EventEmitter from 'events';
import type { MessageServiceV2 } from '../core/message-service-v2.js';

/**
 * Tool Result (临时定义，避免import问题)
 */
interface ToolResult {
    toolCallId: string;
    toolName: string;
    result?: unknown;
    error?: {
        code: string;
        message: string;
    };
}

/**
 * IDrivenSource (临时定义，避免跨项目import)
 */
interface IDrivenSource {
    readonly name: string;
    getMessages(): Promise<MessageWithTimestamp[]>;
    getTools(): Promise<Record<string, any>>;
    executeTool(toolName: string, args: unknown, toolCallId: string): Promise<ToolResult | undefined>;
    onUpdate(callback: () => void): () => void;
}

/**
 * HostDrivenSource V2 - 零转换版本
 */
export class HostDrivenSourceV2 implements IDrivenSource {
    readonly name = 'Host';

    private eventEmitter = new EventEmitter();
    private topicId: string;

    constructor(
        private messageService: MessageServiceV2,
        topicId: string
    ) {
        this.topicId = topicId;
    }

    /**
     * 获取消息
     * 
     * ✅ 直接返回，零转换!
     */
    async getMessages(): Promise<MessageWithTimestamp[]> {
        // ✅ 数据库存储的就是 AI SDK v6 的 ModelMessage + timestamp
        return this.messageService.getMessages(this.topicId);
    }

    /**
     * 获取工具
     * 
     * Host 不提供工具
     */
    async getTools(): Promise<Record<string, any>> {
        return {};
    }

    /**
     * 执行工具调用
     * 
     * Host 不执行工具
     */
    async executeTool(): Promise<ToolResult | undefined> {
        return undefined;
    }

    /**
     * 订阅更新事件
     */
    onUpdate(callback: () => void): () => void {
        this.eventEmitter.on('message', callback);
        return () => this.eventEmitter.off('message', callback);
    }

    /**
     * 通知有新消息
     */
    notifyNewMessage(): void {
        this.eventEmitter.emit('message');
    }

    /**
     * 切换主题
     */
    switchTopic(topicId: string): void {
        this.topicId = topicId;
        this.notifyNewMessage();
    }
}
