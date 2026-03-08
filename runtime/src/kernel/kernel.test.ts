import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Kernel } from './index.js';
import { IDesktopManager, Operation } from '../spi/index.js';

// Mocks
vi.mock('../engine/desktop-manager/index.js'); // Mock DesktopManager
vi.mock('../registry/index.js');
vi.mock('../transformer/index.js');
vi.mock('../dispatcher/index.js');

describe('Kernel', () => {
    let kernel: Kernel;
    let mockDesktopManager: any; // Mocked IDesktopManager
    let mockRegistry: any;
    let mockTransformer: any;
    let mockDispatcher: any;
    let mockSystemOps: any;

    beforeEach(() => {
        // Mock DesktopManager
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
            verifyLock: vi.fn().mockReturnValue(true), // Default to valid lock
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
            // [Phase 1 C1 FIX] Registry.create now returns full CachedSnapshot object
            create: vi.fn().mockReturnValue({
                id: 'snap_1',
                markup: '# Test',
                indexMap: {},
                createdAt: Date.now(),
                refCount: 1,
                ttl: 600000,
                expiresAt: Date.now() + 600000
            }),
            retain: vi.fn(),
            release: vi.fn(),
            resolve: vi.fn()
        };
        mockTransformer = {
            transform: vi.fn().mockReturnValue({ markup: '# Test', indexMap: {} })
        };
        mockDispatcher = {
            // [P0-1 FIX] dispatch now returns OperationResult
            dispatch: vi.fn().mockResolvedValue({ success: true })
        };
        mockSystemOps = {
            has: vi.fn().mockReturnValue(false),
            execute: vi.fn().mockResolvedValue({ success: true }),
            register: vi.fn(),
            get: vi.fn(),
            getToolDefinitions: vi.fn().mockReturnValue([
                {
                    type: 'function',
                    function: {
                        name: 'system-open_app',
                        description: 'Open an app',
                        parameters: {
                            type: 'object',
                            properties: {
                                app_id: {
                                    type: 'string',
                                    description: 'Application ID',
                                },
                            },
                            required: ['app_id'],
                        },
                    },
                },
                {
                    type: 'function',
                    function: {
                        name: 'system-close_app',
                        description: 'Close an app',
                        parameters: {
                            type: 'object',
                            properties: {
                                app_id: {
                                    type: 'string',
                                    description: 'Application ID',
                                },
                            },
                            required: ['app_id'],
                        },
                    },
                },
                {
                    type: 'function',
                    function: {
                        name: 'system-dismount_view',
                        description: 'Hide a view',
                        parameters: {
                            type: 'object',
                            properties: {
                                app_id: {
                                    type: 'string',
                                    description: 'Application ID',
                                },
                                view_id: {
                                    type: 'string',
                                    description: 'View ID',
                                },
                            },
                            required: ['app_id', 'view_id'],
                        },
                    },
                },
            ])
        };

        // Inject mockDesktopManager
        kernel = new Kernel(
            mockDesktopManager,
            mockRegistry,
            mockTransformer,
            mockDispatcher,
            mockSystemOps
        );
    });

    describe('Lifecycle', () => {
        it('creates a desktop via manager', async () => {
            const id = await kernel.createDesktop();
            expect(id).toBe('dt_1');
            expect(mockDesktopManager.create).toHaveBeenCalled();
        });

        it('destroyDesktop delegates to manager', async () => {
            await kernel.destroyDesktop('dt_1');
            expect(mockDesktopManager.destroy).toHaveBeenCalledWith('dt_1');
        });

        it('reinitializeDesktopApps delegates to desktop and preserves desktop id in result', async () => {
            const mockDesktop = {
                reinitializeApps: vi.fn().mockResolvedValue({
                    desktopId: 'dt_1',
                    reinitializedAppIds: ['app_0'],
                    skippedAppIds: ['app_1'],
                    failedAppIds: [],
                }),
            };
            mockDesktopManager.get.mockReturnValue(mockDesktop);

            const result = await kernel.reinitializeDesktopApps('dt_1', {
                reason: 'context_compaction',
            });

            expect(mockDesktop.reinitializeApps).toHaveBeenCalledWith({
                reason: 'context_compaction',
            });
            expect(result).toEqual({
                desktopId: 'dt_1',
                reinitializedAppIds: ['app_0'],
                skippedAppIds: ['app_1'],
                failedAppIds: [],
            });
        });
    });

    // [B1 FIX] Removed 'App Management' tests - installApp was removed in Worker-Only migration
    // Use installDynamicWorkerApp for app installation

    describe('Concurrency Locking', () => {
        it('acquireLock delegates to manager', () => {
            kernel.acquireLock('dt_1', 'agent_A');
            expect(mockDesktopManager.acquireLock).toHaveBeenCalledWith('dt_1', 'agent_A');
        });

        it('releaseLock delegates to manager', () => {
            kernel.releaseLock('dt_1', 'agent_A');
            expect(mockDesktopManager.releaseLock).toHaveBeenCalledWith('dt_1', 'agent_A');
        });
    });

    describe('Execution', () => {
        it('executes command if owner holds lock (verifyLock returns true)', async () => {
            // Setup
            mockDesktopManager.get.mockReturnValue({}); // Mock valid desktop
            mockDesktopManager.verifyLock.mockReturnValue(true);

            const op: Operation = {
                context: { appId: 'app', snapshotId: 'snap_1' },
                name: 'op',
                args: {}
            };
            const result = await kernel.execute('dt_1', op, 'agent_A');

            expect(result.success).toBe(true);
            expect(mockDispatcher.dispatch).toHaveBeenCalled();
            expect(mockDesktopManager.verifyLock).toHaveBeenCalledWith('dt_1', 'agent_A');
            expect(mockDesktopManager.refreshLock).toHaveBeenCalledWith('dt_1', 'agent_A');
        });

        it('throws if owner does not hold lock (verifyLock returns false)', async () => {
            mockDesktopManager.get.mockReturnValue({});
            mockDesktopManager.verifyLock.mockReturnValue(false); // Locked by someone else or expired

            const op: Operation = {
                context: { appId: 'app', snapshotId: 'snap_1' },
                name: 'op',
                args: {}
            };

            const result = await kernel.execute('dt_1', op, 'agent_B');
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error!.code).toBe('DESKTOP_LOCKED');
        });
    });

    describe('Snapshot', () => {
        it('only exposes open_app and close_app as external system tools', () => {
            const tools = kernel.getSystemToolDefinitions();
            const toolNames = tools.map((tool: any) => tool.function?.name);

            expect(toolNames).toEqual(['system-open_app', 'system-close_app']);
            expect(toolNames).not.toContain('system-dismount_view');
        });

        it('acquires snapshot via fragments aggregation without exposing system tools in snapshot indexMap', async () => {
            const mockDesktop = {
                getSnapshotFragments: vi.fn().mockReturnValue([{
                    appId: 'app1',
                    markup: '<div>App1</div>',
                    indexMap: {}
                }]),
                getAppInfo: vi.fn().mockReturnValue({ name: 'App1' }),
                getInstalledApps: vi.fn().mockReturnValue([{
                    appId: 'app1',
                    name: 'App1',
                    status: 'running',
                    html: '',
                    installedAt: Date.now()
                }]),
                getSystemLogs: vi.fn().mockReturnValue([]),
                getAppOperationLogs: vi.fn().mockReturnValue([])
            };
            mockDesktopManager.get.mockReturnValue(mockDesktop);

            const snap = await kernel.acquireSnapshot('dt_1');

            expect(mockDesktop.getSnapshotFragments).toHaveBeenCalled();
            // Expect aggregation
            expect(mockRegistry.create).toHaveBeenCalledWith(
                expect.any(Object),
                expect.stringContaining('<application id="app1" name="App1">'),
                undefined,
                expect.objectContaining({ systemInstruction: expect.any(String) })
            );

            const indexMap = mockRegistry.create.mock.calls[0]?.[0] as Record<string, unknown>;
            expect(indexMap['tool:system-open_app']).toBeUndefined();
            expect(indexMap['tool:system-close_app']).toBeUndefined();
            expect(indexMap['tool:system-dismount_view']).toBeUndefined();
        });

        it('returns empty snapshot if no fragments available', async () => {
            const mockDesktop = {
                getSnapshotFragments: vi.fn().mockReturnValue([]),
                getAppInfo: vi.fn().mockReturnValue(undefined),
                getInstalledApps: vi.fn().mockReturnValue([]),
                getSystemLogs: vi.fn().mockReturnValue([]),
                getAppOperationLogs: vi.fn().mockReturnValue([])
            };
            mockDesktopManager.get.mockReturnValue(mockDesktop);

            const snap = await kernel.acquireSnapshot('dt_1');

            // Should not call getDOM or transformer (removed fallback)
            expect(mockDesktop.getSnapshotFragments).toHaveBeenCalled();

            expect(snap).toBeDefined();
            expect(mockRegistry.create).toHaveBeenCalledWith(
                expect.any(Object),
                expect.stringContaining('<desktop>'),
                undefined,
                expect.objectContaining({ systemInstruction: expect.any(String) })
            );
        });

        it('throws E_NOT_FOUND if desktop does not exist', async () => {
            mockDesktopManager.get.mockReturnValue(undefined);
            mockDesktopManager.has.mockReturnValue(false);
            await expect(kernel.acquireSnapshot('dt_1')).rejects.toThrow(/DESKTOP_NOT_FOUND|not found/);
        });
    });
});
