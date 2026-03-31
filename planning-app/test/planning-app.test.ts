import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@aotui/sdk', async () => import('../../sdk/src/index.ts'));

describe('planning app factory', () => {
    let PlanningAppFactory: any;

    beforeAll(async () => {
        PlanningAppFactory = (await import('../src/tui/index.js')).default;
    });

    it('exposes canonical app_name metadata', () => {
        const factory = PlanningAppFactory as { displayName?: string; kernelConfig?: { appName?: string } };
        expect(factory.displayName).toBe('planning_app');
        expect(factory.kernelConfig?.appName).toBe('planning_app');
    });
});
