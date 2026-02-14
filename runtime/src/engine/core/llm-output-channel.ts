/**
 * LLMOutputChannelService - LLM 文本输出通道
 * 
 * [RFC-011] LLM Output Output Channel
 * 
 * 管理 Desktop 级别的 LLM 文本发布订阅。
 * 支持历史缓冲，新订阅者可获取最近 N 条消息。
 * 
 * 职责:
 * - 管理 per-Desktop 的订阅者
 * - 维护历史消息缓冲 (默认 3 条)
 * - 在 Desktop cleanup 时释放资源
 */

import type { DesktopID } from '../../spi/core/types.js';
import type { LLMOutputEvent, LLMOutputListener, LLMOutputEventMeta } from '../../spi/core/llm-output.js';
import type { ILLMOutputChannelService } from '../../spi/runtime/llm-output-channel.interface.js';

// ============================================================================
// Constants
// ============================================================================

/** 历史缓冲大小 */
const HISTORY_SIZE = 3;

// ============================================================================
// Internal State
// ============================================================================

/**
 * 单个 Desktop 的通道状态
 */
interface DesktopChannelState {
    /** 订阅者集合 */
    listeners: Set<LLMOutputListener>;
    /** 历史消息缓冲 (FIFO, 最多 HISTORY_SIZE 条) */
    history: LLMOutputEvent[];
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * LLM 文本通道服务实现
 */
export class LLMOutputChannelService implements ILLMOutputChannelService {
    private states = new Map<DesktopID, DesktopChannelState>();

    // ─────────────────────────────────────────────────────────────
    //  订阅管理
    // ─────────────────────────────────────────────────────────────

    /**
     * 订阅 LLM 文本事件
     * 
     * 订阅时立即推送历史消息。
     */
    subscribe(desktopId: DesktopID, listener: LLMOutputListener): () => void {
        const state = this.getOrCreateState(desktopId);
        state.listeners.add(listener);

        // 立即推送历史消息到新订阅者
        for (const event of state.history) {
            try {
                listener(event);
            } catch (e) {
                if (process.env.NODE_ENV !== 'production') {
                    console.error('[LLMOutputChannel] Error in history replay:', e);
                }
            }
        }

        // 返回取消订阅函数
        return () => {
            state.listeners.delete(listener);
        };
    }

    // ─────────────────────────────────────────────────────────────
    //  发布
    // ─────────────────────────────────────────────────────────────

    /**
     * 推送 LLM 文本事件
     * [RFC-020] 支持结构化 payload { reasoning?, content? }
     */
    push(
        desktopId: DesktopID,
        payload: { reasoning?: string; content?: string },
        meta?: LLMOutputEventMeta
    ): void {
        const state = this.getOrCreateState(desktopId);

        // 构建事件
        const event: LLMOutputEvent = {
            desktopId,
            timestamp: Date.now(),
            type: 'complete',
            content: payload.content,
            reasoning: payload.reasoning,
            meta
        };

        // 维护历史缓冲 (FIFO)
        state.history.push(event);
        if (state.history.length > HISTORY_SIZE) {
            state.history.shift();
        }

        // 通知所有订阅者
        for (const listener of state.listeners) {
            try {
                listener(event);
            } catch (e) {
                if (process.env.NODE_ENV !== 'production') {
                    console.error('[LLMOutputChannel] Error in listener:', e);
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  历史查询
    // ─────────────────────────────────────────────────────────────

    /**
     * 获取历史消息
     */
    getHistory(desktopId: DesktopID): LLMOutputEvent[] {
        return this.states.get(desktopId)?.history ?? [];
    }

    // ─────────────────────────────────────────────────────────────
    //  生命周期
    // ─────────────────────────────────────────────────────────────

    /**
     * 清理 Desktop 相关资源
     */
    cleanup(desktopId: DesktopID): void {
        this.states.delete(desktopId);
    }

    // ─────────────────────────────────────────────────────────────
    //  内部方法
    // ─────────────────────────────────────────────────────────────

    private getOrCreateState(desktopId: DesktopID): DesktopChannelState {
        let state = this.states.get(desktopId);
        if (!state) {
            state = {
                listeners: new Set(),
                history: []
            };
            this.states.set(desktopId, state);
        }
        return state;
    }
}
