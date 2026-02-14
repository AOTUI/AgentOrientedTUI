/**
 * SignalServiceImpl Unit Tests
 * 
 * [Option B] 测试 ISignalService 实现
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignalServiceImpl } from './signal-service.js';
import { SignalBus } from './signal-bus.js';
import type { DesktopID } from '../../spi/index.js';

describe('SignalServiceImpl', () => {
    describe('Interface Compliance', () => {
        it('should implement ISignalService interface', () => {
            const service = new SignalServiceImpl();

            expect(typeof service.subscribe).toBe('function');
            expect(typeof service.emit).toBe('function');
            expect(typeof service.cleanup).toBe('function');
        });
    });

    describe('subscribe', () => {
        it('should return unsubscribe function', () => {
            const service = new SignalServiceImpl();
            const listener = vi.fn();

            const unsubscribe = service.subscribe('desktop_1' as DesktopID, listener);

            expect(typeof unsubscribe).toBe('function');
        });

        it('should call listener when signal is emitted', () => {
            const service = new SignalServiceImpl();
            const listener = vi.fn();

            service.subscribe('desktop_1' as DesktopID, listener);
            service.emit('desktop_1' as DesktopID, 'dom_mutation');

            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith(
                expect.objectContaining({
                    desktopId: 'desktop_1',
                    reason: 'dom_mutation'
                })
            );
        });

        it('should not call listener after unsubscribe', () => {
            const service = new SignalServiceImpl();
            const listener = vi.fn();

            const unsubscribe = service.subscribe('desktop_1' as DesktopID, listener);
            unsubscribe();
            service.emit('desktop_1' as DesktopID, 'dom_mutation');

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('emit', () => {
        it('should emit signals to correct desktop only', () => {
            const service = new SignalServiceImpl();
            const listener1 = vi.fn();
            const listener2 = vi.fn();

            service.subscribe('desktop_1' as DesktopID, listener1);
            service.subscribe('desktop_2' as DesktopID, listener2);

            service.emit('desktop_1' as DesktopID, 'app_opened');

            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).not.toHaveBeenCalled();
        });

        it('should emit to multiple listeners on same desktop', () => {
            const service = new SignalServiceImpl();
            const listener1 = vi.fn();
            const listener2 = vi.fn();

            service.subscribe('desktop_1' as DesktopID, listener1);
            service.subscribe('desktop_1' as DesktopID, listener2);

            service.emit('desktop_1' as DesktopID, 'manual_refresh');

            expect(listener1).toHaveBeenCalledTimes(1);
            expect(listener2).toHaveBeenCalledTimes(1);
        });
    });

    describe('cleanup', () => {
        it('should remove all listeners for desktop', () => {
            const service = new SignalServiceImpl();
            const listener = vi.fn();

            service.subscribe('desktop_1' as DesktopID, listener);
            service.cleanup('desktop_1' as DesktopID);
            service.emit('desktop_1' as DesktopID, 'dom_mutation');

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('getBus', () => {
        it('should return internal SignalBus', () => {
            const service = new SignalServiceImpl();
            const bus = service.getBus();

            expect(bus).toBeInstanceOf(SignalBus);
        });

        it('should use injected SignalBus if provided', () => {
            const customBus = new SignalBus();
            const service = new SignalServiceImpl(customBus);

            expect(service.getBus()).toBe(customBus);
        });
    });
});

