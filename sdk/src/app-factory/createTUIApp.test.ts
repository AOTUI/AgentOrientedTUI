import { describe, expect, it, vi } from 'vitest';
import { createTUIApp } from './createTUIApp.js';

describe('createTUIApp', () => {
    it('forwards canonical app_name into kernelConfig.appName', () => {
        function RootComponent() {
            return null;
        }

        const onReinitialize = vi.fn();
        const factory = createTUIApp({
            app_name: 'test_app',
            component: RootComponent,
            onReinitialize,
        } as any);

        expect(factory.kernelConfig.appName).toBe('test_app');
        expect(factory.kernelConfig.onReinitialize).toBe(onReinitialize);
    });

    it('does not require a separate display name', () => {
        function RootComponent() {
            return null;
        }

        expect(() =>
            createTUIApp({
                app_name: 'system_ide',
                component: RootComponent,
            } as any)
        ).not.toThrow();
    });

    it('rejects invalid app_name values', () => {
        function RootComponent() {
            return null;
        }

        expect(() =>
            createTUIApp({
                app_name: 'System-Ide',
                component: RootComponent,
            } as any)
        ).toThrow(/app_name/);
    });
});
