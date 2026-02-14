import { describe, it, expect } from 'vitest';
import { createRuntime } from '../../src/facades/index.js';
import type { IRuntimeContext } from '../../src/spi/index.js';

describe('RuntimeContext Integration', () => {
    it('should store and propagate context from kernel to desktop', async () => {
        const kernel = createRuntime();
        const context: IRuntimeContext = {
            env: {
                projectPath: '/test/path',
                testKey: 'testValue'
            }
        };

        const desktopId = await kernel.createDesktop('test-ctx-desktop', context);
        const desktop = kernel.getDesktop(desktopId);

        // Verification 1: Desktop should have the context
        expect((desktop as any).context).toBeDefined();
        expect((desktop as any).context.env.projectPath).toBe('/test/path');

        // Verification 2: App installation should merge this context (indirectly verified via metadata if possible)
        // Since we are in integration test without real workers, we verify the Desktop internal state.
        
        await kernel.destroyDesktop(desktopId);
    });
});
