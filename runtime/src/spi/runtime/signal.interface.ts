/**
 * SPI Layer - Signal Service Interface
 * 
 * 管理 Desktop 级别的事件发布订阅。
 * 
 * @module @aotui/runtime/spi
 */

import type { DesktopID } from '../core/types.js';
import type { UpdateSignal } from '../core/signals.js';

// ============================================================================
// Signal Listener Type
// ============================================================================

/**
 * Signal 监听器函数类型
 */
export type SignalListener = (signal: UpdateSignal) => void;

// ============================================================================
// Signal Service Interface
// ============================================================================

/**
 * 信号服务接口
 * 
 * 管理 Desktop 级别的事件发布订阅。
 * 
 * 设计原则:
 * - 解耦: Signal 的产生和消费完全分离
 * - 多租户: 每个 Desktop 有独立的信号空间
 * - 可靠性: 订阅者异常不影响其他订阅者
 * 
 * @example
 * ```typescript
 * const signalService: ISignalService = new SignalBusAdapter();
 * 
 * // 订阅
 * const unsubscribe = signalService.subscribe(desktopId, (signal) => {
 *     console.log('Signal received:', signal.reason);
 * });
 * 
 * // 发布
 * signalService.emit(desktopId, 'dom_mutation');
 * 
 * // 取消订阅
 * unsubscribe();
 * ```
 */
export interface ISignalService {
    // ─────────────────────────────────────────────────────────────
    //  订阅管理
    // ─────────────────────────────────────────────────────────────

    /**
     * 订阅信号
     * 
     * @param desktopId - Desktop ID
     * @param listener - 信号处理函数
     * @returns 取消订阅的函数
     */
    subscribe(desktopId: DesktopID, listener: SignalListener): () => void;

    // ─────────────────────────────────────────────────────────────
    //  信号发布
    // ─────────────────────────────────────────────────────────────

    /**
     * 发布信号
     * 
     * @param desktopId - Desktop ID
     * @param reason - 信号原因 (dom_mutation, app_opened, manual_refresh 等)
     */
    emit(desktopId: DesktopID, reason: UpdateSignal['reason']): void;

    // ─────────────────────────────────────────────────────────────
    //  生命周期
    // ─────────────────────────────────────────────────────────────

    /**
     * 清理 Desktop 相关状态
     * 
     * 当 Desktop 销毁时调用，释放订阅者和相关资源。
     * 
     * @param desktopId - Desktop ID
     */
    cleanup(desktopId: DesktopID): void;
}

/**
 * Signal Output Stream Interface
 * 
 * Desktop.output 的公开接口，用于外部消费者订阅信号。
 * 与 ISignalService 的区别是：此接口仅暴露单个 Desktop 的订阅能力。
 */
export interface ISignalOutputStream {
    /**
     * 订阅信号
     */
    subscribe(listener: SignalListener): void;

    /**
     * 取消订阅
     */
    unsubscribe(listener: SignalListener): void;
}

