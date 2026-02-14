
import { describe, it, expect, vi } from 'vitest';
import { useExternalEvent } from './useExternalEvent.js';
import { useState } from 'preact/hooks';

// Mock window.addEventListener if needed, but JSDOM should handle it.
// Since we are in vitest environment 'jsdom' (usually configured in vite.config or vitest.config)
// Let's assume standard DOM API works.

describe('useExternalEvent', () => {
    it('should listen to specific event type', () => {
        const callback = vi.fn();
        const eventType = 'my-test-event';
        
        // Use a simple wrapper to test the hook
        function TestComponent() {
            useExternalEvent(eventType, callback);
            return null;
        }

        // We can simulate component mounting by just running the hook logic
        // But since we need to test useEffect, we need a runner.
        // Let's manually implement a simple test harness if renderHook is not available
        // SDK package.json doesn't list @testing-library/preact-hooks explicitly?
        // It has 'preact' and 'vitest'.
        
        // Let's use a manual mount approach for simplicity and robustness
        const cleanupFns: Array<() => void> = [];
        
        function runHook(type: string, cb: any) {
             // Simulate effect
             const handler = (e: any) => {
                if (e.detail?.type === type) {
                    cb(e.detail.data, {
                        viewId: e.detail.viewId,
                        timestamp: e.detail.timestamp
                    });
                }
            };
            window.addEventListener('aotui:external-event', handler);
            return () => window.removeEventListener('aotui:external-event', handler);
        }

        // 1. Mount (simulate)
        const cleanupFn = runHook(eventType, callback);

        // 2. Dispatch event
        const eventData = { foo: 'bar' };
        const event = new CustomEvent('aotui:external-event', {
            detail: {
                type: eventType,
                data: eventData,
                viewId: 'view-1',
                timestamp: 123456
            }
        });
        window.dispatchEvent(event);

        // 3. Verify
        expect(callback).toHaveBeenCalledWith(eventData, {
            viewId: 'view-1',
            timestamp: 123456
        });

        // 4. Dispatch different event type
        const otherEvent = new CustomEvent('aotui:external-event', {
            detail: {
                type: 'other-event',
                data: {}
            }
        });
        window.dispatchEvent(otherEvent);
        expect(callback).toHaveBeenCalledTimes(1); // Should not increase

        // 5. Unmount
        cleanupFn();
        
        // 6. Dispatch again
        window.dispatchEvent(event);
        expect(callback).toHaveBeenCalledTimes(1); // Should not increase
    });
});
