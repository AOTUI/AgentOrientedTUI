/**
 * Engine Layer - Signal Bus Adapter
 * 
 * [Option B] ISignalService 的实现。
 * 
 * 将现有 SignalBus 适配为 ISignalService 接口，
 * 实现 Desktop 解耦。
 * 
 * @module @aotui/runtime/engine/core
 */

import type { ISignalService, SignalListener, DesktopID } from '../../spi/index.js';
import { SignalBus } from './signal-bus.js';

// ============================================================================
// Signal Service Implementation
// ============================================================================

/**
 * Signal Service 实现
 * 
 * 基于现有 SignalBus 实现 ISignalService 接口。
 * 
 * @example
 * ```typescript
 * const signalService = new SignalServiceImpl();
 * 
 * const unsubscribe = signalService.subscribe(desktopId, (signal) => {
 *     console.log('Signal:', signal.reason);
 * });
 * 
 * signalService.emit(desktopId, 'dom_mutation');
 * ```
 */
export class SignalServiceImpl implements ISignalService {
    /** 内部 SignalBus 实例 */
    private bus: SignalBus;

    constructor(bus?: SignalBus) {
        this.bus = bus ?? new SignalBus();
    }

    subscribe(desktopId: DesktopID, listener: SignalListener): () => void {
        return this.bus.subscribe(desktopId, listener);
    }

    emit(desktopId: DesktopID, reason: string): void {
        this.bus.emitSignal(desktopId, reason as any);
    }

    cleanup(desktopId: DesktopID): void {
        this.bus.cleanup(desktopId);
    }

    // ─────────────────────────────────────────────────────────────
    //  Additional Methods (for compatibility)
    // ─────────────────────────────────────────────────────────────

    /**
     * 获取底层 SignalBus
     * 
     * 用于需要直接访问 SignalBus 的场景 (如 Desktop.output)
     */
    getBus(): SignalBus {
        return this.bus;
    }
}

