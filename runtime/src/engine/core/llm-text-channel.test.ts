/**
 * LLMOutputChannelService Unit Tests
 * 
 * [RFC-011] LLM Output Output Channel
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMOutputChannelService } from './llm-output-channel.js';
import type { DesktopID } from '../../spi/core/types.js';
import type { LLMOutputEvent, LLMOutputListener } from '../../spi/core/llm-output.js';

describe('LLMOutputChannelService', () => {
    let service: LLMOutputChannelService;
    const desktopId = 'desktop_1' as DesktopID;

    beforeEach(() => {
        service = new LLMOutputChannelService();
    });

    describe('subscribe', () => {
        it('should receive new events after subscription', () => {
            const events: LLMOutputEvent[] = [];
            const listener: LLMOutputListener = (e) => events.push(e);

            service.subscribe(desktopId, listener);
            service.push(desktopId, { content: 'Hello' });

            expect(events).toHaveLength(1);
            expect(events[0].content).toBe('Hello');
            expect(events[0].type).toBe('complete');
            expect(events[0].desktopId).toBe(desktopId);
        });

        it('should receive history on subscribe', () => {
            // Push events before subscription
            service.push(desktopId, { content: 'Event 1' });
            service.push(desktopId, { content: 'Event 2' });

            const events: LLMOutputEvent[] = [];
            service.subscribe(desktopId, (e) => events.push(e));

            // Should receive 2 historical events
            expect(events).toHaveLength(2);
            expect(events[0].content).toBe('Event 1');
            expect(events[1].content).toBe('Event 2');
        });

        it('should return unsubscribe function', () => {
            const events: LLMOutputEvent[] = [];
            const unsubscribe = service.subscribe(desktopId, (e) => events.push(e));

            service.push(desktopId, { content: 'Event 1' });
            expect(events).toHaveLength(1);

            // Unsubscribe
            unsubscribe();

            service.push(desktopId, { content: 'Event 2' });
            // Should not receive new events
            expect(events).toHaveLength(1);
        });
    });

    describe('push', () => {
        it('should include correct timestamp', () => {
            const before = Date.now();
            service.push(desktopId, { content: 'Test' });
            const after = Date.now();

            const history = service.getHistory(desktopId);
            expect(history[0].timestamp).toBeGreaterThanOrEqual(before);
            expect(history[0].timestamp).toBeLessThanOrEqual(after);
        });

        it('should include meta data', () => {
            service.push(desktopId, { content: 'Test' }, {
                model: 'gpt-4',
                role: 'assistant'
            });

            const history = service.getHistory(desktopId);
            expect(history[0].meta?.model).toBe('gpt-4');
            expect(history[0].meta?.role).toBe('assistant');
        });

        it('should notify multiple subscribers', () => {
            const events1: LLMOutputEvent[] = [];
            const events2: LLMOutputEvent[] = [];

            service.subscribe(desktopId, (e) => events1.push(e));
            service.subscribe(desktopId, (e) => events2.push(e));

            service.push(desktopId, { content: 'Broadcast' });

            expect(events1).toHaveLength(1);
            expect(events2).toHaveLength(1);
        });

        it('should isolate events between desktops', () => {
            const desktop2 = 'desktop_2' as DesktopID;
            const events1: LLMOutputEvent[] = [];
            const events2: LLMOutputEvent[] = [];

            service.subscribe(desktopId, (e) => events1.push(e));
            service.subscribe(desktop2, (e) => events2.push(e));

            service.push(desktopId, { content: 'For Desktop 1' });

            expect(events1).toHaveLength(1);
            expect(events2).toHaveLength(0);
        });
    });

    describe('history', () => {
        it('should limit history to 3 events', () => {
            for (let i = 0; i < 5; i++) {
                service.push(desktopId, { content: `Event ${i}` });
            }

            const history = service.getHistory(desktopId);
            expect(history).toHaveLength(3);
            // Should keep the most recent 3
            expect(history[0].content).toBe('Event 2');
            expect(history[1].content).toBe('Event 3');
            expect(history[2].content).toBe('Event 4');
        });

        it('should return empty array for unknown desktop', () => {
            const unknown = 'unknown' as DesktopID;
            expect(service.getHistory(unknown)).toEqual([]);
        });
    });

    describe('cleanup', () => {
        it('should remove all state for desktop', () => {
            service.push(desktopId, { content: 'Hello' });
            expect(service.getHistory(desktopId)).toHaveLength(1);

            service.cleanup(desktopId);

            expect(service.getHistory(desktopId)).toHaveLength(0);
        });

        it('should stop delivering events after cleanup', () => {
            const events: LLMOutputEvent[] = [];
            service.subscribe(desktopId, (e) => events.push(e));

            service.cleanup(desktopId);
            service.push(desktopId, { content: 'After cleanup' });

            // Subscription was removed, but push creates new state
            // The original subscriber should not receive it
            expect(events).toHaveLength(0);
        });
    });

    describe('error handling', () => {
        it('should continue notifying other subscribers if one throws', () => {
            const events: LLMOutputEvent[] = [];

            // First subscriber throws
            service.subscribe(desktopId, () => { throw new Error('Test error'); });
            // Second subscriber works
            service.subscribe(desktopId, (e) => events.push(e));

            // Should not throw
            expect(() => {
                service.push(desktopId, { content: 'Test' });
            }).not.toThrow();

            // Second subscriber should receive the event
            expect(events).toHaveLength(1);
        });
    });
});
