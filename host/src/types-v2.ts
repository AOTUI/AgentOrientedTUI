/**
 * @aotui/host - Types V2
 * 
 * 完全对齐 AI SDK v6 的数据模型
 * 
 * 设计原则:
 * - ❌ 不自己设计数据模型
 * - ✅ 完全使用 AI SDK v6 的 ModelMessage
 * - ✅ Host 只负责存储和检索
 * 
 * @see https://sdk.vercel.ai/docs/ai-sdk-core/messages-and-roles
 */

import type { ModelMessage } from 'ai';

type ContextRegion = 'static' | 'session' | 'dynamic';

// ============================================================================
// Core Types - 直接使用 AI SDK v6
// ============================================================================

/**
 * 消息 - 直接使用 AI SDK v6 的 ModelMessage
 * 
 * 不再自定义 Message 类型，完全对齐 AI SDK v6：
 * - SystemModelMessage
 * - UserModelMessage
 * - AssistantModelMessage
 * - ToolModelMessage
 */
export type Message = ModelMessage & {
    /** 消息 ID (用于数据库索引) */
    id: string;
    /** 时间戳 (用于排序) */
    timestamp: number;
    /** Context layering hint for AgentDriver assembly */
    region?: ContextRegion;
};

/**
 * 话题 (对话主题 = Desktop)
 */
export interface Topic {
    /** 话题 ID (对应 Desktop ID) */
    id: string;
    /** 话题标题 */
    title: string;
    /** 创建时间 */
    createdAt: number;
    /** 更新时间 */
    updatedAt: number;
    /** Desktop 状态 */
    status: 'hot' | 'warm' | 'cold';

    // Agent 增强字段
    /** Agent 定义的话题摘要 */
    summary?: string;
    /** 对话阶段 (如 "需求澄清", "任务执行") */
    stage?: string;
    /** 最后 Snapshot 拉取时间 */
    lastSnapshotTime?: number;
    /** 关联项目 ID */
    projectId?: string;
}

/**
 * 项目
 */
export interface Project {
    id: string;
    path: string;
    name: string;
    lastOpenedAt?: number;
    createdAt: number;
}

// ============================================================================
// 数据库存储格式
// ============================================================================

/**
 * 消息存储格式
 * 
 * 直接将 ModelMessage 序列化为 JSON 存储
 */
export interface MessageRow {
    /** 消息 ID */
    id: string;
    /** 话题 ID */
    topic_id: string;
    /** 消息角色 */
    role: 'system' | 'user' | 'assistant' | 'tool';
    /** 
     * 消息内容 (JSON)
     * 
     * 直接存储 ModelMessage.content，不做转换：
     * - UserMessage: string | Array<TextPart | ImagePart | FilePart>
     * - AssistantMessage: string | Array<TextPart | FilePart | ReasoningPart | ToolCallPart | ...>
     * - ToolMessage: Array<ToolResultPart | ToolApprovalResponse>
     */
    content: string; // JSON.stringify(message.content)
    /** 时间戳 */
    timestamp: number;
    /** 
     * Provider Options (JSON, 可选)
     * 
     * AI SDK v6 的 providerOptions 字段
     */
    provider_options?: string; // JSON.stringify(message.providerOptions)
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 将 Message 转换为数据库行
 */
export function messageToRow(topicId: string, message: Message): MessageRow {
    return {
        id: message.id,
        topic_id: topicId,
        role: message.role,
        content: JSON.stringify(message.content),
        timestamp: message.timestamp,
        provider_options: (message as any).providerOptions
            ? JSON.stringify((message as any).providerOptions)
            : undefined,
    };
}

/**
 * 将数据库行转换为 Message
 */
export function rowToMessage(row: MessageRow): Message {
    const base: any = {
        id: row.id,
        role: row.role,
        content: JSON.parse(row.content),
        timestamp: row.timestamp,
    };

    if (row.provider_options) {
        base.providerOptions = JSON.parse(row.provider_options);
    }

    return base as Message;
}

/**
 * 创建消息 ID
 */
export function createMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
