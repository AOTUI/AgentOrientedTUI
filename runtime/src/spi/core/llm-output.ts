/**
 * SPI Layer - LLM Output Types
 * 
 * [RFC-011] LLM Output Output Channel
 * 
 * 定义 LLM 文本输出事件类型，用于将 Agent 的文本输出
 * 暴露给 Desktop 上的 TUI 应用。
 * 
 * @module @aotui/runtime/spi
 */

import type { DesktopID } from './types.js';

// ============================================================================
// LLM Output Event
// ============================================================================

/**
 * LLM 文本事件类型
 * 
 * 当 LLM 产生非 Tool Call 的文本输出时触发。
 * 
 * @example
 * ```typescript
 * const event: LLMOutputEvent = {
 *     desktopId: 'desktop_1' as DesktopID,
 *     timestamp: Date.now(),
 *     type: 'complete',
 *     content: 'Let me analyze this request...',
 *     meta: { model: 'gpt-4' }
 * };
 * ```
 */
export interface LLMOutputEvent {
    /** Desktop ID */
    desktopId: DesktopID;

    /** 时间戳 (毫秒) */
    timestamp: number;

    /** 
     * 事件类型
     * - complete: 完整消息 (V1 only)
     * - chunk: 流式片段 (future)
     */
    type: 'complete';

    /** 
     * [RFC-020] LLM 最终回复内容
     * 可选 - 若模型只输出 reasoning 可为空
     */
    content?: string;

    /**
     * [RFC-020] LLM 思考/推理过程
     * DeepSeek Reasoner 等思考模型的 Chain-of-Thought 内容
     */
    reasoning?: string;

    /** 元数据 (可选) */
    meta?: LLMOutputEventMeta;
}

/**
 * LLM 文本事件元数据
 */
export interface LLMOutputEventMeta {
    /** 模型名称 (如 'gpt-4', 'claude-3') */
    model?: string;

    /** Provider ID (如 'openai', 'anthropic') */
    providerId?: string;

    /** Model ID (如 'gpt-4', 'claude-3-5-sonnet-20241022') */
    modelId?: string;

    /** 角色 */
    role?: 'assistant' | 'system';

    /** Token 使用情况 */
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

// ============================================================================
// Listener Type
// ============================================================================

/**
 * LLM 文本通道监听器
 */
export type LLMOutputListener = (event: LLMOutputEvent) => void;
