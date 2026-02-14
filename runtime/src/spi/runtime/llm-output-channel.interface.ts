/**
 * SPI Layer - LLM Output Channel Service Interface
 * 
 * [RFC-011] LLM Output Output Channel
 * 
 * 管理 Desktop 级别的 LLM 文本发布订阅。
 * 每个 Desktop 有独立的通道，支持历史缓冲。
 * 
 * @module @aotui/runtime/spi
 */

import type { DesktopID } from '../core/types.js';
import type { LLMOutputEvent, LLMOutputListener, LLMOutputEventMeta } from '../core/llm-output.js';

// ============================================================================
// Service Interface
// ============================================================================

/**
 * LLM Output Channel Service 接口
 * 
 * 管理 Desktop 级别的 LLM 文本发布订阅。
 * 
 * 设计原则:
 * - Opt-in: Apps 按需订阅，不关心则无开销
 * - Desktop 隔离: 每个 Desktop 有独立的通道
 * - 历史支持: 新订阅者可获取最近 N 条消息
 * 
 * @example
 * ```typescript
 * const service: ILLMOutputChannelService = new LLMOutputChannelService();
 * 
 * // 订阅
 * const unsubscribe = service.subscribe(desktopId, (event) => {
 *     console.log('LLM said:', event.content);
 * });
 * 
 * // 推送 (由 AgentDriver 调用)
 * service.push(desktopId, 'Thinking...', 'complete');
 * 
 * // 取消订阅
 * unsubscribe();
 * ```
 */
export interface ILLMOutputChannelService {
    // ─────────────────────────────────────────────────────────────
    //  订阅管理
    // ─────────────────────────────────────────────────────────────

    /**
     * 订阅 LLM 文本事件
     * 
     * 订阅时会立即接收到历史消息 (最近 N 条)。
     * 
     * @param desktopId - Desktop ID
     * @param listener - 事件处理函数
     * @returns 取消订阅的函数
     */
    subscribe(desktopId: DesktopID, listener: LLMOutputListener): () => void;

    // ─────────────────────────────────────────────────────────────
    //  发布
    // ─────────────────────────────────────────────────────────────

    /**
     * 推送 LLM 文本事件
     * 
     * [RFC-020] 支持结构化 payload { reasoning?, content? }
     * 由 AgentDriver 通过 Bridge 调用。
     * 
     * @param desktopId - Desktop ID
     * @param payload - 结构化内容 { reasoning?, content? }
     * @param meta - 可选元数据
     */
    push(
        desktopId: DesktopID,
        payload: { reasoning?: string; content?: string },
        meta?: LLMOutputEventMeta
    ): void;

    // ─────────────────────────────────────────────────────────────
    //  历史查询
    // ─────────────────────────────────────────────────────────────

    /**
     * 获取历史消息
     * 
     * 返回最近 N 条消息 (默认 3 条)。
     * 
     * @param desktopId - Desktop ID
     * @returns 历史事件数组
     */
    getHistory(desktopId: DesktopID): LLMOutputEvent[];

    // ─────────────────────────────────────────────────────────────
    //  生命周期
    // ─────────────────────────────────────────────────────────────

    /**
     * 清理 Desktop 相关资源
     * 
     * 当 Desktop 销毁时调用，释放订阅者和历史记录。
     * 
     * @param desktopId - Desktop ID
     */
    cleanup(desktopId: DesktopID): void;
}
