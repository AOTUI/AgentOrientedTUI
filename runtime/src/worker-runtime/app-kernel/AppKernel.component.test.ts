import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppKernel } from './AppKernel.js';
import type { IView, OperationContext, AppKernelConfig, AppContext } from '../../spi/index.js';
import { createViewId, createOperationId } from '../../spi/index.js';

describe('AppKernel - Component Mode Operation Routing', () => {
    let appKernel: AppKernel;
    let mockContext: AppContext;
    let mockContainer: HTMLElement;

    beforeEach(() => {
        // Create mock AppContext
        mockContext = {
            appId: 'test-app' as any,
            desktopId: 'test-desktop' as any,
            onRender: vi.fn(),
            markDirty: vi.fn(),
        };

        // Create mock DOM elements
        const mockViewsContainer = {
            appendChild: vi.fn(),
            setAttribute: vi.fn(),
        };

        const mockTreeContainer = {
            innerHTML: '',
            setAttribute: vi.fn(),
        };

        const mockAppRoot = {
            setAttribute: vi.fn(),
        };

        // Create comprehensive mock container
        const mockDocument = {
            createElement: vi.fn((tag: string) => {
                if (tag === 'div') {
                    return mockAppRoot;
                }
                return {
                    setAttribute: vi.fn(),
                    appendChild: vi.fn(),
                    innerHTML: '',
                };
            }),
        };

        mockContainer = {
            innerHTML: '',
            querySelector: vi.fn((selector: string) => {
                if (selector === '[data-views]') {
                    return mockViewsContainer;
                }
                if (selector === '[data-view-tree]') {
                    return mockTreeContainer;
                }
                return null;
            }),
            querySelectorAll: vi.fn(),
            appendChild: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            ownerDocument: mockDocument,
        } as any;

        // Create AppKernel with component mode config
        const config: AppKernelConfig = {
            appName: 'test_component_app',
            name: 'test-component-app',
            component: {
                initializeComponent: vi.fn().mockResolvedValue({}),
            },
        };

        appKernel = new AppKernel(config);
        appKernel.setId('app_0' as any);
    });

    describe('[RFC-B2] ViewRegistry Integration', () => {
        it('should register component-mode view to ViewRegistry', async () => {
            // Initialize AppKernel
            await appKernel.onOpen(mockContext, mockContainer);

            // Create mock component-mode View
            const mockView: IView = {
                id: createViewId(0),
                name: 'TestView',
                displayName: 'Test View',
                onMount: vi.fn().mockResolvedValue(undefined),
                onDismount: vi.fn().mockResolvedValue(undefined),
                onOperation: vi.fn().mockResolvedValue({ success: true, data: { id: 'result_123' } }),
                render: vi.fn().mockReturnValue('<div>Test</div>'),
            };

            // Simulate SDK View component registration
            (appKernel as any).registerView(mockView);

            // Verify: View should be accessible via ViewRegistry
            const viewRegistry = (appKernel as any).viewRegistry;
            const retrievedView = viewRegistry.get(mockView.id);

            expect(retrievedView).toBe(mockView);
        });

        it('should route operation to component-mode view via ViewRegistry', async () => {
            // Initialize AppKernel
            await appKernel.onOpen(mockContext, mockContainer);

            // Create mock component-mode View
            const mockView: IView = {
                id: createViewId(0),
                name: 'TestView',
                displayName: 'Test View',
                onMount: vi.fn().mockResolvedValue(undefined),
                onDismount: vi.fn().mockResolvedValue(undefined),
                onOperation: vi.fn().mockResolvedValue({ success: true, data: { id: 'result_123' } }),
                render: vi.fn().mockReturnValue('<div>Test</div>'),
            };

            // Register View (simulating SDK View.useLayoutEffect)
            (appKernel as any).registerView(mockView);

            // Execute Operation
            const operationContext: OperationContext = {
                viewId: mockView.id,
                appId: 'app_0' as any,
                snapshotId: 'snapshot_0' as any,
            };

            const result = await appKernel.onOperation(operationContext, createOperationId('test_operation'), { foo: 'bar' });

            // Verify: Operation was routed successfully
            expect(result.success).toBe(true);
            expect(result.data).toEqual({ id: 'result_123' });
            expect(mockView.onOperation).toHaveBeenCalledWith('test_operation', { foo: 'bar' });
        });

        it('should unregister component-mode view from ViewRegistry', async () => {
            // Initialize AppKernel
            await appKernel.onOpen(mockContext, mockContainer);

            // Create and register mock View
            const mockView: IView = {
                id: createViewId(0),
                name: 'TestView',
                displayName: 'Test View',
                onMount: vi.fn().mockResolvedValue(undefined),
                onDismount: vi.fn().mockResolvedValue(undefined),
                onOperation: vi.fn(),
                render: vi.fn().mockReturnValue('<div>Test</div>'),
            };

            (appKernel as any).registerView(mockView);

            // Verify registered
            const viewRegistry = (appKernel as any).viewRegistry;
            expect(viewRegistry.get(mockView.id)).toBe(mockView);

            // Unregister View (simulating SDK View unmount)
            (appKernel as any).unregisterView(mockView.id);

            // Verify: View should no longer be in ViewRegistry
            expect(viewRegistry.get(mockView.id)).toBeUndefined();
        });

        it('should prevent VIEW_NOT_FOUND error for component-mode operations', async () => {
            // This test verifies the fix for the original bug
            await appKernel.onOpen(mockContext, mockContainer);

            const mockView: IView = {
                id: createViewId(0),
                name: 'TodoHome',
                displayName: 'TODO Home',
                onMount: vi.fn().mockResolvedValue(undefined),
                onDismount: vi.fn().mockResolvedValue(undefined),
                onOperation: vi.fn().mockResolvedValue({
                    success: true,
                    data: { id: 'todo_123', title: 'Test TODO' }
                }),
                render: vi.fn().mockReturnValue('<div>TODO</div>'),
            };

            (appKernel as any).registerView(mockView);

            // Execute todo operation (like add_todo)
            const result = await appKernel.onOperation(
                { viewId: mockView.id, appId: 'app_0' as any, snapshotId: 'snapshot_0' as any },
                createOperationId('add_todo'),
                { title: 'Test TODO', description: 'Test description' }
            );

            // ✅ Should NOT return VIEW_NOT_FOUND error
            expect(result.success).toBe(true);
            expect(result.data?.id).toBe('todo_123');
            expect(mockView.onOperation).toHaveBeenCalled();
        });

        it('should invoke onReinitialize hook with reason', async () => {
            const onReinitialize = vi.fn().mockResolvedValue(undefined);
            const appKernelWithHook = new AppKernel({
                appName: 'test_component_app',
                name: 'test-component-app',
                component: {
                    initializeComponent: vi.fn().mockResolvedValue({}),
                },
                onReinitialize,
                launchConfig: {
                    __aotuiLifecycle: {
                        startupKind: 'reinitialize',
                        reason: 'context_compaction',
                    },
                },
            });
            appKernelWithHook.setId('app_0' as any);

            await appKernelWithHook.onOpen(mockContext, mockContainer);
            await appKernelWithHook.onReinitialize({
                ...mockContext,
                reason: 'context_compaction',
            });

            expect(onReinitialize).toHaveBeenCalledWith({
                ...mockContext,
                reason: 'context_compaction',
            });
        });

        it('should require explicit appName instead of deriving from display name', () => {
            expect(() =>
                new AppKernel({
                    name: 'Test Component App',
                    component: {
                        initializeComponent: vi.fn().mockResolvedValue({}),
                    },
                } as any)
            ).toThrow(/appName/);
        });

        it('rejects legacy root-mode configs and documents component mode as the only supported path', () => {
            expect(() =>
                new AppKernel({
                    appName: 'legacy_app',
                    name: 'legacy-app',
                    root: {} as any,
                } as any)
            ).toThrow(/component is required|component mode/i);
        });

        it('should pass launchConfig through runtime context during initialization', async () => {
            const initializeComponent = vi.fn().mockResolvedValue({});
            const appKernelWithLaunchConfig = new AppKernel({
                appName: 'test_component_app',
                name: 'test-component-app',
                component: {
                    initializeComponent,
                },
                launchConfig: {
                    foo: 'bar',
                    __aotuiLifecycle: {
                        startupKind: 'reinitialize',
                        reason: 'context_compaction',
                    },
                },
            });
            appKernelWithLaunchConfig.setId('app_0' as any);

            await appKernelWithLaunchConfig.onOpen(mockContext, mockContainer);

            expect(initializeComponent).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    launchConfig: expect.objectContaining({
                        foo: 'bar',
                        __aotuiLifecycle: {
                            startupKind: 'reinitialize',
                            reason: 'context_compaction',
                        },
                    }),
                })
            );
        });
    });
});
