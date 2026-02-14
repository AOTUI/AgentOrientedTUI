
import { describe, it, expect, vi } from 'vitest';
import { createRuntime, defineRuntimeConfig } from '../../../src/facades/index.js'; // Use facades which exports everything now
import { DesktopManager } from '../../../src/engine/core/manager.js';
import { SnapshotRegistry } from '../../../src/engine/system/registry.js';
import { AppWorkerHost } from '../../../src/engine/app/worker-host.js';
import { createDesktopId, createAppId } from '../../../src/spi/index.js';

// Mock dependencies if needed, but we want to test propagation
// We might need to inspect private properties or use public getters

describe('Runtime Config Integration', () => {

    it('should propagate legacy snapshotTTL to SnapshotRegistry (valid value)', () => {
        const runtime = createRuntime({ snapshotTTL: 61000 });
        const registry = (runtime as any).snapshotRegistry as SnapshotRegistry;
        expect((registry as any).config.ttl).toBe(61000);
    });

    it('should propagate new RuntimeConfig to components', async () => {
        const config = defineRuntimeConfig({
            worker: { timeoutMs: 44444 },
            snapshot: { ttlMs: 65555 }, // > 60000
            lock: { ttlMs: 66666 }
        });

        const runtime = createRuntime(config);

        // 1. Verify SnapshotRegistry
        const registry = (runtime as any).snapshotRegistry as SnapshotRegistry;
        expect((registry as any).config.ttl).toBe(65555);

        // 2. Verify DesktopManager -> Desktop
        const desktopManager = (runtime as any).desktopManager as DesktopManager;

        // Create a desktop to verify config propagation
        const desktopId = await runtime.createDesktop();
        const desktop = desktopManager.get(desktopId);

        expect(desktop).toBeDefined();
        // Check Desktop private config
        expect((desktop as any).config.worker.timeoutMs).toBe(44444);

        // 3. Verify Desktop -> AppManager (via installDynamicApp)
        // This is harder to test without mocking file system or actual worker
        // But we can check AppManager instance on Desktop
        const appManager = (desktop as any).appManager;
        expect(appManager).toBeDefined();

        // 4. Verify LockService
        const lockService = (desktopManager as any).lockService;
        expect((lockService as any).ttlMs).toBe(66666);
    });

    it('should use defaults when no config provided', async () => {
        const runtime = createRuntime();
        const registry = (runtime as any).snapshotRegistry;

        // Default snapshot TTL is 600,000 (10 min)
        expect(registry.config.ttl).toBe(600_000);
    });
});
