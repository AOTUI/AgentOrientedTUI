/**
 * AOTUI Runtime - ViewRegistry Tests
 * 
 * Tests for the lightweight ViewRegistry component.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ViewRegistry, createViewRegistry } from './view-registry.js';
import type { IView, ViewID } from '../../spi/index.js';

describe('ViewRegistry', () => {
    let registry: ViewRegistry;

    beforeEach(() => {
        registry = createViewRegistry();
    });

    // Helper to create mock view
    const createMockView = (id: ViewID, name: string = 'TestView'): IView => ({
        id,
        name,
        displayName: name,
        onMount: async () => { },
        onDismount: async () => { },
        onOperation: async () => ({ success: true }),
        render: () => '<div>Test</div>',
    });

    describe('Basic Operations', () => {
        it('should register a view', () => {
            const view = createMockView('view_0');

            registry.register(view);

            expect(registry.has('view_0')).toBe(true);
            expect(registry.get('view_0')).toBe(view);
            expect(registry.size()).toBe(1);
        });

        it('should retrieve registered view', () => {
            const view = createMockView('view_0', 'HomePage');
            registry.register(view);

            const retrieved = registry.get('view_0');

            expect(retrieved).toBe(view);
            expect(retrieved!.name).toBe('HomePage');
        });

        it('should return undefined for non-existent view', () => {
            expect(registry.get('view_999')).toBeUndefined();
            expect(registry.has('view_999')).toBe(false);
        });

        it('should unregister a view', () => {
            const view = createMockView('view_0');
            registry.register(view);

            registry.unregister('view_0');

            expect(registry.has('view_0')).toBe(false);
            expect(registry.get('view_0')).toBeUndefined();
            expect(registry.size()).toBe(0);
        });

        it('should handle unregister of non-existent view (idempotent)', () => {
            expect(() => {
                registry.unregister('view_999');
            }).not.toThrow();
        });
    });

    describe('Multiple Views', () => {
        it('should register multiple views', () => {
            const view0 = createMockView('view_0', 'Home');
            const view1 = createMockView('view_1', 'Detail');
            const view2 = createMockView('view_2', 'Settings');

            registry.register(view0);
            registry.register(view1);
            registry.register(view2);

            expect(registry.size()).toBe(3);
            expect(registry.has('view_0')).toBe(true);
            expect(registry.has('view_1')).toBe(true);
            expect(registry.has('view_2')).toBe(true);
        });

        it('should retrieve all views', () => {
            registry.register(createMockView('view_0', 'A'));
            registry.register(createMockView('view_1', 'B'));
            registry.register(createMockView('view_2', 'C'));

            const allViews = registry.getAll();

            expect(allViews).toHaveLength(3);
            expect(allViews.map(v => v.name).sort()).toEqual(['A', 'B', 'C']);
        });

        it('should retrieve all view IDs', () => {
            registry.register(createMockView('view_0'));
            registry.register(createMockView('view_1'));
            registry.register(createMockView('view_2'));

            const allIds = registry.getAllIds();

            expect(allIds).toHaveLength(3);
            expect(allIds.sort()).toEqual(['view_0', 'view_1', 'view_2']);
        });
    });

    describe('Error Handling', () => {
        it('should throw on duplicate registration', () => {
            const view1 = createMockView('view_0', 'First');
            const view2 = createMockView('view_0', 'Second');

            registry.register(view1);

            expect(() => {
                registry.register(view2);
            }).toThrow("View 'view_0' already exists");
        });
    });

    describe('Clear', () => {
        it('should clear all views', () => {
            registry.register(createMockView('view_0'));
            registry.register(createMockView('view_1'));
            registry.register(createMockView('view_2'));

            expect(registry.size()).toBe(3);

            registry.clear();

            expect(registry.size()).toBe(0);
            expect(registry.has('view_0')).toBe(false);
            expect(registry.getAll()).toHaveLength(0);
        });

        it('should allow registration after clear', () => {
            registry.register(createMockView('view_0'));
            registry.clear();

            const newView = createMockView('view_1');
            registry.register(newView);

            expect(registry.size()).toBe(1);
            expect(registry.get('view_1')).toBe(newView);
        });
    });

    describe('Performance Characteristics', () => {
        it('should handle large number of views efficiently', () => {
            const viewCount = 1000;
            const startTime = performance.now();

            // Register 1000 views
            for (let i = 0; i < viewCount; i++) {
                registry.register(createMockView(`view_${i}` as ViewID));
            }

            const registerTime = performance.now() - startTime;

            // Lookups should be O(1)
            const lookupStart = performance.now();
            for (let i = 0; i < viewCount; i++) {
                registry.get(`view_${i}` as ViewID);
            }
            const lookupTime = performance.now() - lookupStart;

            expect(registry.size()).toBe(viewCount);

            // Performance targets (very generous):
            // 1000 registrations < 50ms
            // 1000 lookups < 10ms
            expect(registerTime).toBeLessThan(50);
            expect(lookupTime).toBeLessThan(10);
        });
    });
});

describe('createViewRegistry', () => {
    it('should create a new ViewRegistry instance', () => {
        const registry = createViewRegistry();

        expect(registry).toBeInstanceOf(ViewRegistry);
        expect(registry.size()).toBe(0);
    });

    it('should create independent instances', () => {
        const registry1 = createViewRegistry();
        const registry2 = createViewRegistry();

        registry1.register({ id: 'view_0', name: 'Test' } as IView);

        expect(registry1.size()).toBe(1);
        expect(registry2.size()).toBe(0);
    });
});
