/**
 * SignalBus 单元测试
 * 
 * 测试信号发布订阅机制。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SignalBus, createSignalOutputStream, type SignalListener } from './signal-bus.js';
import type { DesktopID, UpdateSignal } from '../../spi/index.js';

describe('SignalBus', () => {
    let bus: SignalBus;
    const desktopId = 'dt_test' as DesktopID;

    beforeEach(() => {
        bus = new SignalBus();
    });

    afterEach(() => {
        bus.cleanup(desktopId);
    });

    // ════════════════════════════════════════════════════════════════
    // 构造函数
    // ════════════════════════════════════════════════════════════════

    describe('constructor', () => {
        it('创建 SignalBus 实例', () => {
            expect(bus).toBeInstanceOf(SignalBus);
        });

        it('默认 catchErrors 为 true', () => {
            // 通过行为验证：listener 抛出错误不应该影响其他 listener
            const errorListener = vi.fn(() => { throw new Error('test error'); });
            const normalListener = vi.fn();

            bus.subscribe(desktopId, errorListener);
            bus.subscribe(desktopId, normalListener);

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            bus.emitSignal(desktopId, 'dom_mutation');
            consoleSpy.mockRestore();

            expect(normalListener).toHaveBeenCalled();
        });

        it('可配置 catchErrors 为 false', () => {
            const busNoCatch = new SignalBus({ catchErrors: false });
            const errorListener = vi.fn(() => { throw new Error('test error'); });

            busNoCatch.subscribe(desktopId, errorListener);

            expect(() => {
                busNoCatch.emitSignal(desktopId, 'dom_mutation');
            }).toThrow('test error');
        });
    });

    // ════════════════════════════════════════════════════════════════
    // 订阅与取消订阅
    // ════════════════════════════════════════════════════════════════

    describe('subscribe', () => {
        it('添加 listener 到指定 desktop', () => {
            const listener = vi.fn();
            bus.subscribe(desktopId, listener);

            expect(bus.getListenerCount(desktopId)).toBe(1);
        });

        it('返回取消订阅函数', () => {
            const listener = vi.fn();
            const unsubscribe = bus.subscribe(desktopId, listener);

            expect(typeof unsubscribe).toBe('function');
            unsubscribe();
            expect(bus.getListenerCount(desktopId)).toBe(0);
        });

        it('同一 listener 可以订阅多次（Set 会去重）', () => {
            const listener = vi.fn();
            bus.subscribe(desktopId, listener);
            bus.subscribe(desktopId, listener); // 重复订阅

            expect(bus.getListenerCount(desktopId)).toBe(1);
        });

        it('不同 listener 可以同时订阅', () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();
            bus.subscribe(desktopId, listener1);
            bus.subscribe(desktopId, listener2);

            expect(bus.getListenerCount(desktopId)).toBe(2);
        });
    });

    describe('unsubscribe', () => {
        it('移除指定 listener', () => {
            const listener = vi.fn();
            bus.subscribe(desktopId, listener);
            bus.unsubscribe(desktopId, listener);

            expect(bus.getListenerCount(desktopId)).toBe(0);
        });

        it('移除不存在的 listener 不抛出错误', () => {
            const listener = vi.fn();
            expect(() => {
                bus.unsubscribe(desktopId, listener);
            }).not.toThrow();
        });

        it('移除不存在 desktop 的 listener 不抛出错误', () => {
            const listener = vi.fn();
            expect(() => {
                bus.unsubscribe('nonexistent' as DesktopID, listener);
            }).not.toThrow();
        });
    });

    // ════════════════════════════════════════════════════════════════
    // 信号发布
    // ════════════════════════════════════════════════════════════════

    describe('emit', () => {
        it('调用所有订阅的 listener', () => {
            const listener1 = vi.fn();
            const listener2 = vi.fn();
            bus.subscribe(desktopId, listener1);
            bus.subscribe(desktopId, listener2);

            const signal: UpdateSignal = {
                desktopId,
                timestamp: Date.now(),
                reason: 'dom_mutation'
            };
            bus.emit(desktopId, signal);

            expect(listener1).toHaveBeenCalledWith(signal);
            expect(listener2).toHaveBeenCalledWith(signal);
        });

        it('没有订阅者时不抛出错误', () => {
            expect(() => {
                bus.emit(desktopId, {
                    desktopId,
                    timestamp: Date.now(),
                    reason: 'dom_mutation'
                });
            }).not.toThrow();
        });

        it('对不存在的 desktop 不抛出错误', () => {
            expect(() => {
                bus.emit('nonexistent' as DesktopID, {
                    desktopId: 'nonexistent' as DesktopID,
                    timestamp: Date.now(),
                    reason: 'dom_mutation'
                });
            }).not.toThrow();
        });
    });

    describe('emitSignal', () => {
        it('发送带有 reason 的信号', () => {
            const listener = vi.fn();
            bus.subscribe(desktopId, listener);

            bus.emitSignal(desktopId, 'manual_refresh');

            expect(listener).toHaveBeenCalledWith(expect.objectContaining({
                desktopId,
                reason: 'manual_refresh'
            }));
        });

        it('自动添加 timestamp', () => {
            const listener = vi.fn();
            bus.subscribe(desktopId, listener);

            const before = Date.now();
            bus.emitSignal(desktopId, 'dom_mutation');
            const after = Date.now();

            const signal = listener.mock.calls[0][0] as UpdateSignal;
            expect(signal.timestamp).toBeGreaterThanOrEqual(before);
            expect(signal.timestamp).toBeLessThanOrEqual(after);
        });
    });

    // ════════════════════════════════════════════════════════════════
    // DOM 观察
    // ════════════════════════════════════════════════════════════════

    describe('observeDOM', () => {
        it('当 window 没有 MutationObserver 时不抛出错误', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            expect(() => {
                bus.observeDOM(desktopId, {});
            }).not.toThrow();
            consoleSpy.mockRestore();
        });

        it('打印日志当 MutationObserver 不可用', () => {
            const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });
            bus.observeDOM(desktopId, {});
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('MutationObserver not available'));
            consoleSpy.mockRestore();
        });
    });

    describe('stopObserving', () => {
        it('对未观察的 desktop 不抛出错误', () => {
            expect(() => {
                bus.stopObserving(desktopId);
            }).not.toThrow();
        });
    });

    // ════════════════════════════════════════════════════════════════
    // 清理
    // ════════════════════════════════════════════════════════════════

    describe('cleanup', () => {
        it('移除所有 listener', () => {
            bus.subscribe(desktopId, vi.fn());
            bus.subscribe(desktopId, vi.fn());

            bus.cleanup(desktopId);

            expect(bus.getListenerCount(desktopId)).toBe(0);
        });

        it('对不存在的 desktop 不抛出错误', () => {
            expect(() => {
                bus.cleanup('nonexistent' as DesktopID);
            }).not.toThrow();
        });
    });

    // ════════════════════════════════════════════════════════════════
    // 辅助方法
    // ════════════════════════════════════════════════════════════════

    describe('getListenerCount', () => {
        it('返回 0 当没有 listener', () => {
            expect(bus.getListenerCount(desktopId)).toBe(0);
        });

        it('返回正确的 listener 数量', () => {
            bus.subscribe(desktopId, vi.fn());
            bus.subscribe(desktopId, vi.fn());

            expect(bus.getListenerCount(desktopId)).toBe(2);
        });

        it('对不存在的 desktop 返回 0', () => {
            expect(bus.getListenerCount('nonexistent' as DesktopID)).toBe(0);
        });
    });
});

// ============================================================================
// createSignalOutputStream
// ============================================================================

describe('createSignalOutputStream', () => {
    it('创建具有 subscribe 和 unsubscribe 方法的对象', () => {
        const bus = new SignalBus();
        const desktopId = 'dt_test' as DesktopID;
        const output = createSignalOutputStream(bus, desktopId);

        expect(typeof output.subscribe).toBe('function');
        expect(typeof output.unsubscribe).toBe('function');
    });

    it('subscribe 委托给 SignalBus', () => {
        const bus = new SignalBus();
        const desktopId = 'dt_test' as DesktopID;
        const output = createSignalOutputStream(bus, desktopId);
        const listener = vi.fn();

        output.subscribe(listener);

        expect(bus.getListenerCount(desktopId)).toBe(1);
    });

    it('unsubscribe 委托给 SignalBus', () => {
        const bus = new SignalBus();
        const desktopId = 'dt_test' as DesktopID;
        const output = createSignalOutputStream(bus, desktopId);
        const listener = vi.fn();

        output.subscribe(listener);
        output.unsubscribe(listener);

        expect(bus.getListenerCount(desktopId)).toBe(0);
    });
});
