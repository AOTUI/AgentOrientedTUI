import { describe, expect, it, vi } from 'vitest';
import { createTUIApp } from './createTUIApp.js';

describe('createTUIApp', () => {
    it('forwards onReinitialize into kernelConfig', () => {
        function RootComponent() {
            return null;
        }

        const onReinitialize = vi.fn();
        const factory = createTUIApp({
            appName: 'test_app',
            name: 'Test App',
            component: RootComponent,
            onReinitialize,
        });

        expect(factory.kernelConfig.onReinitialize).toBe(onReinitialize);
    });
});
