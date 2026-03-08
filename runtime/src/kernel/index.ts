// [DIP FIX] Kernel now depends ONLY on interfaces from SPI, not concrete Engine classes
import type {
    IKernel,
    Operation,
    OperationResult,
    DesktopID,
    SnapshotID,
    CachedSnapshot,
    IDesktop,
    IRegistry,
    AppID,
    AppConfig,
    DesktopState,
    IAOTUIApp,

    ISystemOperationRegistry,
    IDesktopForOperation,
    SystemOperationContext,
    IDesktopManager,
    ITransformer,
    IDispatcher,
    OperationLogScope,
    IRuntimeContext, // New
    ReinitializeDesktopAppsOptions,
    ReinitializeDesktopAppsResult,
} from '../spi/index.js';

import { AOTUIError, failedResult } from '../spi/core/errors.js';
import { createOperationId } from '../spi/core/id-factory.js';
import { buildOperationLogEntry } from '../engine/core/operation-log-formatter.js';
import type { Tool } from '../spi/core/tool-call.js';

/**
 * Kernel - The core orchestrator of the AOTUI Runtime.
 * 
 * Responsibilities:
 * - Creates and manages Desktop instances (via IDesktopManager)
 * - Handles concurrency via lock mechanism (delegated to IDesktopManager)
 * - Generates and manages Snapshots for Agent consumption
 * - Dispatches operations to Apps via IDispatcher
 * - Manages Desktop lifecycle (suspend, resume, serialize, restore)
 * 
 * [DIP] Kernel depends ONLY on interfaces (IDesktopManager, IRegistry, ITransformer, IDispatcher).
 * Concrete implementations are injected via constructor (Inversion of Control).
 * 
 * @example
 * ```typescript
 * // Use createKernel factory to get a properly configured Kernel
 * import { createKernel } from '@aotui/runtime';
 * const kernel = createKernel(desktopManager, registry, systemOps);
 * ```
 */
export class Kernel implements IKernel {
    private static readonly EXTERNAL_SYSTEM_TOOL_NAMES = new Set([
        'system-open_app',
        'system-close_app',
    ]);

    constructor(
        private desktopManager: IDesktopManager,
        private snapshotRegistry: IRegistry,
        private transformer: ITransformer,
        private dispatcher: IDispatcher,
        private systemOps: ISystemOperationRegistry
    ) { }

    getSystemToolDefinitions() {
        return this.systemOps.getToolDefinitions().filter((tool) => {
            const name = (tool as Tool).function?.name;
            return !!name && Kernel.EXTERNAL_SYSTEM_TOOL_NAMES.has(name);
        });
    }

    private buildSystemToolIndexMap(): Record<string, unknown> {
        const indexMap: Record<string, unknown> = {};

        for (const tool of this.getSystemToolDefinitions()) {
            const fn = (tool as Tool).function;
            if (!fn?.name) {
                continue;
            }

            const properties = fn.parameters?.properties ?? {};
            const required = new Set(fn.parameters?.required ?? []);

            indexMap[`tool:${fn.name}`] = {
                description: fn.description,
                params: Object.entries(properties).map(([name, schema]) => ({
                    name,
                    type: schema.type,
                    required: required.has(name),
                    description: schema.description,
                    options: Array.isArray(schema.enum) ? schema.enum : undefined,
                })),
            };
        }

        return indexMap;
    }

    /**
     * Creates a new Desktop instance with a clean state.
     * The Desktop is immediately registered and ready for app installation.
     * 
     * App installation is the responsibility of Product Layer (e.g., DesktopManager).
     * This follows the microkernel principle: Kernel handles scheduling,
     * Product Layer handles app discovery and installation.
     * 
     * @param desktopId - Optional: specify a custom Desktop ID (for historical topics)
     * @param context - Optional: Runtime Context to inject into the Desktop
     * @returns The unique identifier of the created Desktop
     */
    async createDesktop(desktopId?: DesktopID, context?: IRuntimeContext): Promise<DesktopID> {
        return this.desktopManager.create(desktopId, context);
    }

    /**
     * Destroys a Desktop and releases all associated resources.
     * This operation is idempotent - calling with non-existent ID is safe.
     * 
     * @param desktopId - The ID of the Desktop to destroy
     */
    async destroyDesktop(desktopId: DesktopID): Promise<void> {
        await this.desktopManager.destroy(desktopId);
    }

    /**
     * 获取 Desktop 实例 (供 ToolCallAdapter 使用)
     * @throws {Error} E_NOT_FOUND if Desktop doesn't exist
     */
    getDesktop(desktopId: DesktopID): IDesktop {
        const desktop = this.desktopManager.get(desktopId);
        if (!desktop) {
            throw new AOTUIError('DESKTOP_NOT_FOUND', { desktopId });
        }
        return desktop;
    }

    /**
     * [Worker-Only] 安装 App
     * 
     * [C1 Fix] workerScriptPath 现在是可选的，默认使用 Runtime 内置的 worker-runtime
     */
    async installDynamicWorkerApp(
        desktopId: DesktopID,
        appModulePath: string,
        options?: {
            workerScriptPath?: string;
            appId?: string;
            name?: string;
            /** [RFC-013] App description for Agent */
            description?: string;
            config?: import('../spi/app/app-config.interface.js').AppLaunchConfig;
            promptRole?: 'user' | 'assistant';
        }
    ): Promise<string> {
        const desktop = this.desktopManager.get(desktopId);
        if (!desktop) {
            throw new AOTUIError('DESKTOP_NOT_FOUND', { desktopId });
        }
        // [Refactor] Use DesktopManager to centralize log/signal if needed, but direct Desktop call is fine via Kernel
        // Actually, Kernel mostly delegates to DesktopManager or Desktop directly.
        // Let's delegate to DesktopManager to keep symmetry if Manager has it.
        // Wait, Kernel line 110 calls 'desktop.installDynamicWorkerApp'.
        // But DesktopManager ALSO has 'installDynamicWorkerApp'.
        // Let's stick to what Kernel was doing: calling `desktop.installDynamicWorkerApp`.
        return desktop.installDynamicWorkerApp(appModulePath, options);
    }

    /**
     * [C1 FIX] Lock management delegated to IDesktopManager
     */
    acquireLock(desktopId: DesktopID, ownerId: string): void {
        this.desktopManager.acquireLock(desktopId, ownerId);
    }

    releaseLock(desktopId: DesktopID, ownerId: string): void {
        this.desktopManager.releaseLock(desktopId, ownerId);
    }

    async acquireSnapshot(desktopId: DesktopID, ttl?: number): Promise<CachedSnapshot> {
        const desktop = this.desktopManager.get(desktopId);
        if (!desktop) {
            throw new AOTUIError('DESKTOP_NOT_FOUND', { desktopId });
        }

        // [RFC-001] Get Worker-pushed SnapshotFragments
        const fragments = desktop.getSnapshotFragments();

        // [RFC-007] Use SnapshotFormatter for complete TUI output
        // [RFC-014] SnapshotFormatter now returns structured output
        const { SnapshotFormatter } = await import('../engine/view/snapshot/index.js');
        const formatter = new SnapshotFormatter();

        // Desktop implements IDesktopMetadata (getInstalledApps, getSystemLogs, etc.)
        const result = formatter.format(fragments, desktop as any);
        const indexMap = {
            ...result.indexMap,
            ...this.buildSystemToolIndexMap(),
        };

        // [RFC-014] Pass structured output to Registry
        return this.snapshotRegistry.create(
            indexMap as any,
            result.markup,
            ttl,
            result.structured
        );
    }

    releaseSnapshot(snapshotId: SnapshotID): void {
        this.snapshotRegistry.release(snapshotId);
    }

    async reinitializeDesktopApps(
        desktopId: DesktopID,
        options?: ReinitializeDesktopAppsOptions
    ): Promise<ReinitializeDesktopAppsResult> {
        const desktop = this.desktopManager.get(desktopId);
        if (!desktop) {
            throw new AOTUIError('DESKTOP_NOT_FOUND', { desktopId });
        }

        return desktop.reinitializeApps(options);
    }

    async execute(desktopId: DesktopID, operation: Operation, ownerId: string): Promise<OperationResult> {
        const startTime = Date.now();

        try {
            // 1. Verify Desktop
            const desktop = this.desktopManager.get(desktopId);
            if (!desktop) throw new AOTUIError('DESKTOP_NOT_FOUND', { desktopId });

            // 2. Verify Lock (delegated to desktopManager)
            if (!this.desktopManager.verifyLock(desktopId, ownerId)) {
                const lockInfo = this.desktopManager.getLockInfo(desktopId);
                throw new AOTUIError('DESKTOP_LOCKED', {
                    desktopId,
                    ownerId: lockInfo?.ownerId ?? 'none',
                    claimant: ownerId,
                });
            }

            // Refresh timestamp on successful lock verification
            this.desktopManager.refreshLock(desktopId, ownerId);

            const { context, name: operationName, args } = operation;

            // 3. System Operation Dispatch (via Registry - replaces switch statement)
            if (this.systemOps.has(operationName)) {
                const systemCtx: SystemOperationContext = {
                    desktopId,
                    args: { ...args, appId: context.appId }  // Inject appId for view operations
                };
                const result = await this.systemOps.execute(operationName, systemCtx, desktop as IDesktopForOperation);
                if (result.success && 'emitSignal' in desktop) {
                    (desktop as { emitSignal: (reason: string) => void }).emitSignal('manual_refresh');
                }
                return this.enrichResult(result, operationName, startTime, desktop, desktopId, context.appId, args || {});
            }

            // 4. App Operation Dispatch
            // [Worker-Only] 所有 App 操作通过 Dispatcher 路由到 Worker
            if (!context.appId) {
                throw new AOTUIError('OPERATION_REQUIRES_CONTEXT', { operationName });
            }

            // Pass Operation directly to Dispatcher (handles Worker IPC routing)
            const dispatchOp: Operation = {
                context,
                name: operationName,
                args
            };
            // [P0-1 FIX] Now returns the actual OperationResult from the App
            const result = await this.dispatcher.dispatch(desktop, dispatchOp, this.snapshotRegistry);
            return this.enrichResult(result, operationName, startTime, desktop, desktopId, context.appId, args || {});

        } catch (e: unknown) {
            // If already AOTUIError, preserve it. Otherwise wrap.
            const aotuiError = AOTUIError.is(e) ? e : AOTUIError.fromError(e, 'EXECUTION_FAILED');
            const durationMs = Date.now() - startTime;

            // [RFC-008] Log failed operation
            const desktop = this.desktopManager.get(desktopId);
            if (desktop) {
                this.logOperationExecution(
                    desktop,
                    desktopId,
                    operation.context.appId,
                    operation.name,
                    operation.args || {},
                    false,
                    durationMs,
                    'agent',  // Default actor for now - could be passed in
                    aotuiError.message
                );
            }

            return {
                success: false,
                error: aotuiError.toOperationError(),
                data: { durationMs }
            };
        }
    }

    /**
     * Enrich OperationResult with execution metadata
     * 
     * @param result - Original operation result
     * @param operationName - Name of the executed operation
     * @param startTime - Execution start timestamp
     * @returns Result with added durationMs
     */
    private enrichResult(
        result: OperationResult,
        operationName: string,
        startTime: number,
        desktop: IDesktop,
        desktopId: DesktopID,
        appId: AppID | undefined,
        args: Record<string, unknown>
    ): OperationResult {
        const durationMs = Date.now() - startTime;

        // [RFC-008] Log successful operation
        this.logOperationExecution(
            desktop,
            desktopId,
            appId,
            operationName,
            args,
            result.success,
            durationMs,
            'agent'  // Default actor for now
        );

        return {
            ...result,
            data: {
                ...result.data,
                durationMs,
                operationName
            }
        };
    }

    /**
     * [RFC-008] Log operation execution with semantic format
     * 
     * Generates WHO/WHEN/WHERE/WHAT log entries:
     * - WHO: The actor (agent name)
     * - WHEN: Timestamp and duration
     * - WHERE: Desktop > App > View
     * - WHAT: Operation name and result
     */
    private logOperationExecution(
        desktop: IDesktop,
        desktopId: DesktopID,
        appId: AppID | undefined,
        operationName: string,
        args: Record<string, unknown>,
        success: boolean,
        durationMs: number,
        actor: string,
        errorMessage?: string
    ): void {
        const scope: OperationLogScope = this.systemOps.has(operationName) ? 'system' : 'app';

        // Get app name for semantic description (getAppInfo is optional on IDesktop)
        let appName: string | undefined;
        if (appId && desktop.getAppInfo) {
            const appInfo = desktop.getAppInfo(appId);
            appName = appInfo?.name;
        }

        const entry = buildOperationLogEntry({
            actor,
            desktopId,
            scope,
            operationName: createOperationId(operationName),
            args,
            success,
            durationMs,
            appId,
            appName,
            errorMessage
        });

        // Log using Desktop's existing logger (duck typing for concrete Desktop methods)
        // These methods exist on concrete Desktop but not on IDesktop interface
        const desktopWithLogger = desktop as unknown as {
            logSystem?: (msg: string, level: 'info' | 'warn' | 'error') => void;
            logAppOperation?: (appId: AppID, msg: string, level: 'info' | 'warn' | 'error') => void;
        };

        if (scope === 'system' && desktopWithLogger.logSystem) {
            desktopWithLogger.logSystem(entry.semanticDescription, success ? 'info' : 'error');
        } else if (appId && desktopWithLogger.logAppOperation) {
            desktopWithLogger.logAppOperation(appId, entry.semanticDescription, success ? 'info' : 'error');
        }
    }


    /**
     * [C1 FIX] Now type-safe via IDesktopManager
     */
    async suspend(desktopId: DesktopID): Promise<void> {
        await this.desktopManager.suspend(desktopId);
    }

    /**
     * [C1 FIX] Now type-safe via IDesktopManager
     */
    async resume(desktopId: DesktopID): Promise<void> {
        await this.desktopManager.resume(desktopId);
    }

    serialize(desktopId: DesktopID): DesktopState {
        const info = this.desktopManager.getDesktopInfo(desktopId);
        if (!info) {
            throw new AOTUIError('DESKTOP_NOT_FOUND', { desktopId });
        }

        return {
            id: desktopId,
            status: info.status,
            createdAt: info.createdAt,
            serializedAt: Date.now(),
            apps: this.desktopManager.getAppStates(desktopId)
        };
    }

    /**
     * [RFC-014] 优雅关闭 Desktop
     * 
     * 1. 调用 Desktop.drain() 等待 App 清理
     * 2. 执行 beforeClose 回调（如持久化）
     * 3. 销毁 Desktop
     * 
     * @param desktopId - Desktop ID
     * @param options - 关闭选项
     */
    async gracefulShutdown(
        desktopId: DesktopID,
        options?: import('../spi/index.js').ShutdownOptions
    ): Promise<void> {
        const timeout = options?.timeoutMs ?? 30000;

        const desktop = this.desktopManager.get(desktopId);
        if (!desktop) {
            // 已不存在，直接返回
            console.log(`[Kernel] gracefulShutdown: Desktop ${desktopId} not found, skipping`);
            return;
        }

        const shutdownTask = async () => {
            // 1. Drain Desktop (等待 App 清理)
            await desktop.drain();

            // 2. 执行 beforeClose 回调
            if (options?.beforeClose) {
                await options.beforeClose();
            }

            // 3. 销毁 Desktop
            await this.destroyDesktop(desktopId);
        };

        // 超时保护
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('gracefulShutdown timeout')), timeout);
        });

        try {
            await Promise.race([shutdownTask(), timeoutPromise]);
            console.log(`[Kernel] gracefulShutdown completed for ${desktopId}`);
        } catch (e) {
            console.warn(`[Kernel] gracefulShutdown timeout for ${desktopId}, forcing destroy`);
            await this.destroyDesktop(desktopId);
        }
    }

    /**
     * [RFC-015] 删除 Desktop (清理数据)
     */
    async deleteDesktop(desktopId: DesktopID): Promise<void> {
        const desktop = this.desktopManager.get(desktopId);
        if (!desktop) {
            console.log(`[Kernel] deleteDesktop: Desktop ${desktopId} not found, skipping`);
            return;
        }

        console.log(`[Kernel] Deleting Desktop ${desktopId}...`);

        // 1. 调用 Desktop.delete() (触发 App onDelete + drain)
        await desktop.delete();

        // 2. 从 DesktopManager 移除
        this.desktopManager.destroy(desktopId);

        console.log(`[Kernel] Desktop ${desktopId} deleted.`);
    }

}
