import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Kernel } from './index.js';
import { Operation, createDesktopId, createAppId, createSnapshotId, createOperationId } from '../spi/index.js';

// Mock dependencies
vi.mock('../engine/desktop-manager/index.js');
vi.mock('../registry/index.js');
vi.mock('../transformer/index.js');
vi.mock('../dispatcher/index.js');

describe('Kernel Lock Security', () => {
    let kernel: Kernel;
    let mockDesktopManager: any;
    let mockRegistry: any;
    let mockTransformer: any;
    let mockDispatcher: any;
    let mockSystemOps: any;

    beforeEach(() => {
        // Mock DesktopManager with lock behaviors
        mockDesktopManager = {
            create: vi.fn().mockResolvedValue('dt_1'),
            destroy: vi.fn(),
            has: vi.fn().mockReturnValue(true),
            get: vi.fn(),
            installApp: vi.fn().mockResolvedValue('app_0'),
            installDynamicApp: vi.fn(),
            getApp: vi.fn(),
            acquireLock: vi.fn(),
            releaseLock: vi.fn(),
            verifyLock: vi.fn(), // Will be mocked per test
            refreshLock: vi.fn(),
            getLockInfo: vi.fn(),
            getDOM: vi.fn(),
            getAppStates: vi.fn().mockReturnValue([]),
            getDesktopInfo: vi.fn().mockReturnValue({ status: 'active', createdAt: 0 }),
            suspend: vi.fn(),
            resume: vi.fn(),
            restoreApp: vi.fn()
        };

        mockRegistry = {
            create: vi.fn().mockReturnValue('snap_1'),
            retain: vi.fn(),
            release: vi.fn(),
            resolve: vi.fn()
        };
        mockTransformer = {
            transform: vi.fn().mockReturnValue({ markup: '# Test', indexMap: {} })
        };
        mockDispatcher = {
            dispatch: vi.fn().mockResolvedValue(undefined)
        };
        mockSystemOps = {
            has: vi.fn().mockReturnValue(false),
            execute: vi.fn().mockResolvedValue({ success: true }),
            register: vi.fn(),
            get: vi.fn()
        };

        kernel = new Kernel(
            mockDesktopManager,
            mockRegistry,
            mockTransformer,
            mockDispatcher,
            mockSystemOps
        );
    });

    describe('Execution Security', () => {
        it('allows execution when lock is valid (verifyLock returns true)', async () => {
            mockDesktopManager.get.mockReturnValue({});
            mockDesktopManager.verifyLock.mockReturnValue(true);

            const op: Operation = {
                context: { appId: createAppId('app'), snapshotId: createSnapshotId('snap_1') },
                name: createOperationId('op'),
                args: {}
            };

            await expect(kernel.execute(createDesktopId('dt_1'), op, 'agent_A')).resolves.toBeDefined();
            expect(mockDesktopManager.verifyLock).toHaveBeenCalledWith('dt_1', 'agent_A');
            expect(mockDesktopManager.refreshLock).toHaveBeenCalledWith('dt_1', 'agent_A');
        });

        it('blocks execution when lock is invalid (verifyLock returns false)', async () => {
            mockDesktopManager.get.mockReturnValue({});
            mockDesktopManager.verifyLock.mockReturnValue(false);
            mockDesktopManager.getLockInfo.mockReturnValue({ ownerId: 'agent_B' });

            const op: Operation = {
                context: { appId: createAppId('app'), snapshotId: createSnapshotId('snap_1') },
                name: createOperationId('op'),
                args: {}
            };

            const result = await kernel.execute(createDesktopId('dt_1'), op, 'agent_A');
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error!.code).toBe('DESKTOP_LOCKED');
            expect(mockDesktopManager.refreshLock).not.toHaveBeenCalled();
        });

        it('acquireLock delegates to manager', () => {
            kernel.acquireLock(createDesktopId('dt_1'), 'agent_A');
            expect(mockDesktopManager.acquireLock).toHaveBeenCalledWith('dt_1', 'agent_A');
        });

        it('releaseLock delegates to manager', () => {
            kernel.releaseLock(createDesktopId('dt_1'), 'agent_A');
            expect(mockDesktopManager.releaseLock).toHaveBeenCalledWith('dt_1', 'agent_A');
        });
    });
});

