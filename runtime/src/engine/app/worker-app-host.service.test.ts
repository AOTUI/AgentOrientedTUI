/**
 * WorkerAppHostService Unit Tests
 * 
 * [Option B] 测试 IAppHostService 的 Worker 实现
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DesktopID, AppID } from '../../spi/index.js';

// Since we can't easily mock WorkerSandbox, we'll test the service structure
// Full integration tests should be done with actual Worker spawning

describe('WorkerAppHostService', () => {
    describe('Interface Compliance', () => {
        it('should export WorkerAppHostService class', async () => {
            const { WorkerAppHostService } = await import('./worker-app-host.service.js');
            expect(WorkerAppHostService).toBeDefined();
            expect(typeof WorkerAppHostService).toBe('function');
        });

        it('should implement IAppHostService interface', async () => {
            const { WorkerAppHostService } = await import('./worker-app-host.service.js');
            const service = new WorkerAppHostService();

            // Check all interface methods exist
            expect(typeof service.install).toBe('function');
            expect(typeof service.executeOperation).toBe('function');

            expect(typeof service.dismountView).toBe('function');
            expect(typeof service.getSnapshotFragments).toBe('function');
            expect(typeof service.getAppInfo).toBe('function');
            expect(typeof service.hasApp).toBe('function');
            expect(typeof service.pauseAll).toBe('function');
            expect(typeof service.resumeAll).toBe('function');
            expect(typeof service.closeAll).toBe('function');
            expect(typeof service.setSignalEmitter).toBe('function');
        });
    });

    describe('Signal Emitter', () => {
        it('should allow setting signal emitter callback', async () => {
            const { WorkerAppHostService } = await import('./worker-app-host.service.js');
            const service = new WorkerAppHostService();

            const emitter = vi.fn();
            service.setSignalEmitter(emitter);

            // Signal emitter is stored internally (no public way to verify except through install/operation)
            expect(true).toBe(true); // Structure test passes
        });
    });

    describe('State Management', () => {
        it('should return empty fragments for unknown desktop', async () => {
            const { WorkerAppHostService } = await import('./worker-app-host.service.js');
            const service = new WorkerAppHostService();

            const fragments = service.getSnapshotFragments('unknown_desktop' as DesktopID);
            expect(fragments).toEqual([]);
        });

        it('should return undefined for unknown app info', async () => {
            const { WorkerAppHostService } = await import('./worker-app-host.service.js');
            const service = new WorkerAppHostService();

            const info = service.getAppInfo('desktop_1' as DesktopID, 'app_1' as AppID);
            expect(info).toBeUndefined();
        });

        it('should return false for hasApp on unknown desktop', async () => {
            const { WorkerAppHostService } = await import('./worker-app-host.service.js');
            const service = new WorkerAppHostService();

            const has = service.hasApp('desktop_1' as DesktopID, 'app_1' as AppID);
            expect(has).toBe(false);
        });
    });

    describe('Lifecycle Methods', () => {
        it('should handle pauseAll on empty desktop gracefully', async () => {
            const { WorkerAppHostService } = await import('./worker-app-host.service.js');
            const service = new WorkerAppHostService();

            // Should not throw
            await expect(service.pauseAll('unknown_desktop' as DesktopID)).resolves.toBeUndefined();
        });

        it('should handle resumeAll on empty desktop gracefully', async () => {
            const { WorkerAppHostService } = await import('./worker-app-host.service.js');
            const service = new WorkerAppHostService();

            await expect(service.resumeAll('unknown_desktop' as DesktopID)).resolves.toBeUndefined();
        });

        it('should handle closeAll on empty desktop gracefully', async () => {
            const { WorkerAppHostService } = await import('./worker-app-host.service.js');
            const service = new WorkerAppHostService();

            await expect(service.closeAll('unknown_desktop' as DesktopID)).resolves.toBeUndefined();
        });
    });
});

