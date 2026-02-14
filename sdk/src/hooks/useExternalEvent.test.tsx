
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useExternalEvent } from './useExternalEvent.js';
import { render } from 'preact';
import { h } from 'preact'; // Ensure h is available for JSX

describe('useExternalEvent', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        container = null as any;
        vi.restoreAllMocks();
    });

    it('should call callback when matching event is dispatched', async () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
        const callback = vi.fn();
        const eventType = 'test-event';
        
        function TestComponent() {
            useExternalEvent(eventType, callback);
            return null;
        }

        render(<TestComponent />, container);

        // Wait for useEffect to attach listener
        await vi.waitUntil(() => addEventListenerSpy.mock.calls.some(call => call[0] === 'aotui:external-event'));

        // Dispatch event
        const event = new CustomEvent('aotui:external-event', {
            bubbles: true,
            detail: {
                type: eventType,
                data: { foo: 'bar' },
                viewId: 'v1',
                timestamp: 123
            }
        });
        window.dispatchEvent(event);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith({ foo: 'bar' }, { viewId: 'v1', timestamp: 123 });
    });

    it('should ignore non-matching events', async () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
        const callback = vi.fn();
        
        function TestComponent() {
            useExternalEvent('target-event', callback);
            return null;
        }

        render(<TestComponent />, container);

        // Wait for useEffect
        await vi.waitUntil(() => addEventListenerSpy.mock.calls.some(call => call[0] === 'aotui:external-event'));

        window.dispatchEvent(new CustomEvent('aotui:external-event', {
            bubbles: true,
            detail: { type: 'other-event' }
        }));

        expect(callback).not.toHaveBeenCalled();
    });
    
    it('should cleanup listener on unmount', async () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
        const callback = vi.fn();
        
        function TestComponent() {
            useExternalEvent('test-event', callback);
            return null;
        }

        render(<TestComponent />, container);

        // Wait for useEffect
        await vi.waitUntil(() => addEventListenerSpy.mock.calls.some(call => call[0] === 'aotui:external-event'));
        
        // Unmount by rendering null
        render(null, container);
        
        // Wait for cleanup (Preact unmount is synchronous usually, but effects cleanup might be async?)
        // Let's verify via spy if removeEventListener was called? 
        // But simpler to just wait a tick and check callback not called.
        await new Promise(resolve => setTimeout(resolve, 10));

        window.dispatchEvent(new CustomEvent('aotui:external-event', {
            bubbles: true,
            detail: { type: 'test-event' }
        }));

        expect(callback).not.toHaveBeenCalled();
    });
});
