/**
 * SignalBus - Desktop 信号发布订阅
 * 
 * [H1 拆分] 从 Desktop 提取的信号管理模块。
 * 
 * 职责:
 * - 管理 UpdateSignal 订阅者
 * - 发布信号到订阅者
 * - 管理 MutationObserver 并触发 dom_mutation 信号
 */

import type { DesktopID, UpdateSignal } from '../../spi/index.js';

export type SignalListener = (signal: UpdateSignal) => void;

/**
 * SignalBus 配置
 */
export interface SignalBusOptions {
    /** 是否在 emit 时 catch 异常，默认 true */
    catchErrors?: boolean;
}

/**
 * 单个 Desktop 的信号状态
 */
interface DesktopSignalState {
    listeners: Set<SignalListener>;
    observer: MutationObserver | null;
}

/**
 * SignalBus - 统一管理所有 Desktop 的信号发布订阅
 */
export class SignalBus {
    private states = new Map<DesktopID, DesktopSignalState>();
    private options: Required<SignalBusOptions>;

    constructor(options?: SignalBusOptions) {
        this.options = {
            catchErrors: options?.catchErrors ?? true
        };
    }

    /**
     * 订阅指定 Desktop 的信号
     * 
     * @param desktopId Desktop ID
     * @param listener 信号处理函数
     * @returns 取消订阅的函数
     */
    subscribe(desktopId: DesktopID, listener: SignalListener): () => void {
        const state = this.getOrCreateState(desktopId);
        state.listeners.add(listener);

        return () => {
            state.listeners.delete(listener);
        };
    }

    /**
     * 取消订阅
     */
    unsubscribe(desktopId: DesktopID, listener: SignalListener): void {
        const state = this.states.get(desktopId);
        if (state) {
            state.listeners.delete(listener);
        }
    }

    /**
     * 发布信号到指定 Desktop 的所有订阅者
     */
    emit(desktopId: DesktopID, signal: UpdateSignal): void {
        const state = this.states.get(desktopId);
        if (!state) return;

        state.listeners.forEach(listener => {
            if (this.options.catchErrors) {
                try {
                    listener(signal);
                } catch (e) {
                    console.error('[SignalBus] Error in signal listener:', e);
                }
            } else {
                listener(signal);
            }
        });
    }

    /**
     * 便捷方法：发布带原因的信号
     */
    emitSignal(desktopId: DesktopID, reason: UpdateSignal['reason']): void {
        this.emit(desktopId, {
            desktopId,
            timestamp: Date.now(),
            reason
        });
    }

    /**
     * 绑定 MutationObserver 到 Document
     * 
     * 当 DOM 变化时自动发布 'dom_mutation' 信号
     * 
     * @param desktopId Desktop ID
     * @param window linkedom window 对象
     */
    observeDOM(desktopId: DesktopID, window: any): void {
        const state = this.getOrCreateState(desktopId);

        // 如果已有 observer，先停止
        if (state.observer) {
            state.observer.disconnect();
        }

        // [Worker-Only Fix] LinkedOM 可能没有 MutationObserver，跳过
        const MutationObserver = window?.MutationObserver;
        if (!MutationObserver) {
            console.log(`[SignalBus] MutationObserver not available for desktop ${desktopId}, skipping DOM observation`);
            return;
        }

        // 创建新的 MutationObserver
        const observer = new MutationObserver(() => {
            this.emit(desktopId, {
                desktopId,
                timestamp: Date.now(),
                reason: 'dom_mutation'
            });
        });
        state.observer = observer;

        // 开始观察
        observer.observe(window.document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });
    }

    /**
     * 停止观察 DOM
     */
    stopObserving(desktopId: DesktopID): void {
        const state = this.states.get(desktopId);
        if (state?.observer) {
            state.observer.disconnect();
            state.observer = null;
        }
    }

    /**
     * 清理指定 Desktop 的所有状态
     */
    cleanup(desktopId: DesktopID): void {
        this.stopObserving(desktopId);
        this.states.delete(desktopId);
    }

    /**
     * 获取订阅者数量（用于调试）
     */
    getListenerCount(desktopId: DesktopID): number {
        return this.states.get(desktopId)?.listeners.size ?? 0;
    }

    // ---- 私有方法 ----

    private getOrCreateState(desktopId: DesktopID): DesktopSignalState {
        let state = this.states.get(desktopId);
        if (!state) {
            state = {
                listeners: new Set(),
                observer: null
            };
            this.states.set(desktopId, state);
        }
        return state;
    }
}

/**
 * SignalOutputStream 兼容接口
 * 
 * 用于保持 Desktop.output 的 API 兼容
 */
export interface SignalOutputStream {
    subscribe(listener: SignalListener): void;
    unsubscribe(listener: SignalListener): void;
}

/**
 * 创建 SignalOutputStream 适配器
 * 
 * 将 SignalBus 的 per-desktop subscribe 适配为原有 API
 */
export function createSignalOutputStream(
    bus: SignalBus,
    desktopId: DesktopID
): SignalOutputStream {
    return {
        subscribe: (listener) => { bus.subscribe(desktopId, listener); },
        unsubscribe: (listener) => { bus.unsubscribe(desktopId, listener); }
    };
}
