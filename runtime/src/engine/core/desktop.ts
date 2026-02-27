import type { IDesktop, DesktopID, AppID, ViewID, UpdateSignal, AppState, DesktopStatus, AppContext, OperationPayload, IAppHostService, ISignalService, ILLMOutputChannelService, IRuntimeContext } from '../../spi/index.js';
import { createDesktopId, createSnapshotId, createOperationId } from '../../spi/index.js';
import { AOTUIError, failedResult } from '../../spi/core/errors.js';
import { SignalBus, createSignalOutputStream, type SignalOutputStream } from './signal-bus.js';
import { DesktopLogger, type LogEntry } from './desktop-logger.js';
import { AppManager, type InstalledApp } from '../app/index.js';
import { ViewManager } from '../view/index.js';
import { SignalServiceImpl } from './signal-service.js';
import { LLMOutputChannelService } from './llm-output-channel.js';
import { RuntimeConfig, RUNTIME_DEFAULTS } from '../../spi/config/index.js';


// Re-export for backward compatibility
export { SignalOutputStream } from './signal-bus.js';
export { LogEntry } from './desktop-logger.js';
export { InstalledApp } from '../app/index.js';

/**
 * Desktop 构造参数
 * 
 * [Option B] 支持新的 Service 接口注入
 */
export interface DesktopOptions {
    /** 使用外部 SignalBus (默认创建内部实例) - 向后兼容 */
    signalBus?: SignalBus;
    /** 使用外部 DesktopLogger (默认创建内部实例) */
    logger?: DesktopLogger;
    /** 使用外部 AppManager (默认创建内部实例) - 向后兼容 */
    appManager?: AppManager;
    /** 使用外部 ViewManager (默认创建内部实例) */
    viewManager?: ViewManager;

    // [Option B] 新 Service 接口
    /** [Option B] 使用外部 IAppHostService */
    appHostService?: IAppHostService;
    /** [Option B] 使用外部 ISignalService */
    signalService?: ISignalService;

    // [RFC-005] Runtime Config
    runtimeConfig?: RuntimeConfig;

    // [RFC-011] LLM Output Channel Service
    /** 使用外部 ILLMOutputChannelService */
    llmOutputChannelService?: ILLMOutputChannelService;

    // [RFC-026] Runtime Context Injection
    context?: IRuntimeContext;
}

// Desktop now explicitly implements IDesktopDOM for type safety
export class Desktop implements IDesktop {
    public readonly id: DesktopID;
    public readonly createdAt: number;

    // [RFC-026] Runtime Context
    public readonly context?: IRuntimeContext;

    private _status: DesktopStatus = 'active';
    private _disposed = false;
    private _isDraining = false;  // [RFC-014] Draining 状态标志

    // Use injected SignalBus or create internal instance
    private signalBus: SignalBus;

    // Use injected DesktopLogger or create internal instance
    private logger: DesktopLogger;

    // Use injected AppManager or create internal instance
    private appManager: AppManager;

    // Use injected ViewManager or create internal instance
    private viewManager: ViewManager;

    // [Option B] New Service interfaces
    private appHostService: IAppHostService | null = null;
    private signalService: ISignalService | null = null;

    private config: RuntimeConfig;

    // [RFC-011] LLM Output Channel Service
    private llmOutputChannel: ILLMOutputChannelService;

    constructor(id?: DesktopID, options?: DesktopOptions) {
        this.id = id ?? createDesktopId();
        this.createdAt = Date.now();
        this.config = options?.runtimeConfig ?? RUNTIME_DEFAULTS;
        this.context = options?.context;

        // Desktop is Headless (No Mirror DOM)

        // [Option B] 新 Service 接口注入
        this.appHostService = options?.appHostService ?? null;
        this.signalService = options?.signalService ?? null;

        // 向后兼容: 使用 SignalBus 或从 SignalService 获取
        if (options?.signalBus) {
            this.signalBus = options.signalBus;
        } else if (this.signalService && (this.signalService as any).getBus) {
            this.signalBus = (this.signalService as SignalServiceImpl).getBus();
        } else {
            this.signalBus = new SignalBus();
        }

        this.logger = options?.logger || new DesktopLogger({
            maxSystemLogs: this.config.logger.maxSystemLogs,
            maxAppLogs: this.config.logger.maxAppLogs
        });

        this.appManager = options?.appManager || new AppManager(this);

        this.viewManager = options?.viewManager || new ViewManager();

        // [RFC-011] LLM Output Channel Service
        this.llmOutputChannel = options?.llmOutputChannelService ?? new LLMOutputChannelService();

        this.logSystem('Desktop initialized.');
        if (this.context) {
            this.logSystem(`Context injected: ${JSON.stringify(Object.keys(this.context.env))}`);
        }
    }

    get status(): DesktopStatus {
        return this._status;
    }



    // Delegate to SignalBus
    public get output(): SignalOutputStream {
        return createSignalOutputStream(this.signalBus, this.id);
    }

    // [RFC-011] Expose LLM Output Channel for Bridge access
    public getLLMOutputChannel(): ILLMOutputChannelService {
        return this.llmOutputChannel;
    }

    // [RFC-011] Broadcast LLM text to all Workers
    // [RFC-020] Now accepts structured payload
    public broadcastLLMOutput(
        payload: { reasoning?: string; content?: string },
        type: 'complete',
        meta?: {
            model?: string;
            providerId?: string;
            modelId?: string;
            usage?: {
                promptTokens: number;
                completionTokens: number;
                totalTokens: number;
            };
        }
    ): void {
        this.appManager.broadcastLLMOutput(payload, type, meta);
    }

    // --- System Commands (App) ---

    async openApp(appId: AppID): Promise<void> {
        return this.appManager.openApp(appId);
    }

    async closeApp(appId: AppID): Promise<void> {
        return this.appManager.closeApp(appId);
    }

    async collapseApp(appId: AppID): Promise<void> {
        return this.appManager.collapseApp(appId);
    }

    async showApp(appId: AppID): Promise<void> {
        return this.appManager.showApp(appId);
    }

    // --- System Commands (View) ---
    // Delegate to ViewManager



    async dismountView(appId: AppID, viewId: ViewID): Promise<void> {
        // [Worker-Only] Use IPC for Worker Apps
        const sandbox = this.appManager.getWorkerSandbox(appId);
        if (sandbox) {
            await sandbox.dismountView(viewId);
        } else {
            await this.viewManager.dismount(appId, viewId);
        }
        this.emitSignal('dom_mutation');  // Notify after view state change
    }


    async hideView(appId: AppID, viewId: ViewID): Promise<void> {
        await this.viewManager.hide(appId, viewId);
        this.emitSignal('dom_mutation');  // Notify after view state change
    }

    async showView(appId: AppID, viewId: ViewID): Promise<void> {
        await this.viewManager.show(appId, viewId);
        this.emitSignal('dom_mutation');  // Notify after view state change
    }

    /**
     * [RFC-006] Mount view via ViewLink
     * 
     * Called when Agent uses V2 mount API: mount(parent_view, link_id)
     */
    async mountViewByLink(appId: AppID, parentViewId: ViewID, linkId: string): Promise<void> {
        // [Worker-Only] Use IPC for Worker Apps
        const sandbox = this.appManager.getWorkerSandbox(appId);
        if (sandbox) {
            await sandbox.mountViewByLink(parentViewId, linkId);
        } else {
            // Non-worker apps: delegate to ViewManager (fallback)
            await this.viewManager.mountByLink(appId, parentViewId, linkId);
        }
        this.emitSignal('dom_mutation');  // Notify after view state change
    }

    /**
     * Get Window object (for ViewManager)
     */


    // --- Core Methods ---

    /**
     * [Worker-Only] Install Dynamic Worker App
     * 
     * App runs in a dedicated Worker Thread via IPC.
     */
    async installDynamicWorkerApp(
        appModulePath: string,
        options?: {
            workerScriptPath?: string;
            appId?: string;
            name?: string;
            /** [RFC-013] App description for Agent */
            description?: string;
            /** App 是什么 */
            whatItIs?: string;
            /** 什么时候用 */
            whenToUse?: string;
            config?: import('../../spi/app/app-config.interface.js').AppLaunchConfig;

            /** [RFC-014] App Role */
            promptRole?: 'user' | 'assistant';
        }
    ): Promise<string> {
        // [RFC-026] Merge Runtime Context into AppLaunchConfig
        // Priority: App Specific Config > Runtime Context
        // Note: We inject env vars from context into config.env if not present
        let mergedConfig = options?.config;
        if (this.context?.env) {
            mergedConfig = mergedConfig || {};
            // Inject all env vars from context
            for (const [key, value] of Object.entries(this.context.env)) {
                if (mergedConfig[key] === undefined) {
                    mergedConfig[key] = value;
                }
            }
        }

        return this.appManager.install(
            appModulePath,
            {
                workerScriptPath: options?.workerScriptPath,  // Now optional, AppManager/AppWorkerHost will use default
                appId: options?.appId as any,
                name: options?.name,
                description: options?.description,  // [RFC-013]
                whatItIs: options?.whatItIs,
                whenToUse: options?.whenToUse,
                config: mergedConfig, // [RFC-026] Injected Config
                runtimeConfig: this.config, // [RFC-005] Pass Runtime Config
                promptRole: options?.promptRole
            }
        );
    }

    /**
     * [RFC-014] 注册待启动 App (懒加载)
     */
    async registerPendingApp(options: {
        appId?: string;
        name?: string;
        description?: string;
        whatItIs?: string;
        whenToUse?: string;
        modulePath: string;
        workerScriptPath?: string;
        /** [RFC-014] App Role */
        promptRole?: 'user' | 'assistant';
    }): Promise<string> {
        return this.appManager.registerPendingApp({
            appId: options.appId as any,
            name: options.name,
            description: options.description,
            whatItIs: options.whatItIs,
            whenToUse: options.whenToUse,
            modulePath: options.modulePath,
            workerScriptPath: options.workerScriptPath,
            promptRole: options.promptRole
        });
    }



    /**
     * Get Snapshot Fragments from all Apps
     * 
     * When Worker-Side Transformation is enabled, Worker executes Transformer directly.
     * This method aggregates cached Markdown + IndexMap + ViewTree from all workers.
     * 
     * [RFC-007] Added viewTree for Application View Tree section
     * 
     * @returns Snapshot Fragments from all apps, or empty array
     */
    getSnapshotFragments(): {
        appId: AppID;
        markup: string;
        indexMap: Record<string, unknown>;
        views?: Array<{
            viewId: ViewID;
            viewType: string;
            viewName?: string;
            markup: string;
            timestamp: number;
        }>;
        viewTree?: string;
        timestamp?: number;
    }[] {
        if (this._disposed) throw new AOTUIError('DESKTOP_DISPOSED', { desktopId: this.id });

        const fragments: {
            appId: AppID;
            markup: string;
            indexMap: Record<string, unknown>;
            views?: Array<{
                viewId: ViewID;
                viewType: string;
                viewName?: string;
                markup: string;
                timestamp: number;
            }>;
            viewTree?: string;
            timestamp?: number;
        }[] = [];
        for (const [appId, worker] of this.appManager.getAllWorkers()) {
            const fragment = worker.getSnapshotFragment();
            if (fragment) {
                fragments.push({
                    appId,
                    markup: fragment.markup,
                    indexMap: fragment.indexMap,
                    views: fragment.views,
                    viewTree: fragment.viewTree,  // [RFC-007]
                    timestamp: fragment.timestamp,
                });
            }
        }

        return fragments;
    }

    /**
     * 获取 App 信息
     * @param appId - App ID
     * @returns App 信息 (name, etc.) 或 undefined
     */
    getAppInfo(appId: AppID): { name?: string } | undefined {
        if (this._disposed) throw new AOTUIError('DESKTOP_DISPOSED', { desktopId: this.id });

        const worker = this.appManager.getAllWorkers().get(appId);
        if (worker) {
            return { name: worker.name };
        }
        return undefined;
    }

    // --- Lifecycle Methods ---

    /**
     * 暂停 Desktop
     * 会调用所有动态 App 的 onPause()
     */
    async suspend(): Promise<void> {
        this._status = 'suspended';
        this.signalBus.stopObserving(this.id);

        await this.appManager.pauseAll();
    }

    /**
     * 恢复 Desktop
     * 会调用所有动态 App 的 onResume()
     */
    async resume(): Promise<void> {
        if (this._status === 'suspended') {
            this._status = 'active';
            await this.appManager.resumeAll();
        }
    }

    getAppStates(): AppState[] {
        return this.appManager.getAppStates();
    }

    /**
     * 获取已安装应用列表 (用于 SnapshotBuilder)
     */
    getInstalledApps(): InstalledApp[] {
        return this.appManager.getInstalledApps();
    }

    /**
     * Get System Logs (for <desktop> area)
     */
    getSystemLogs(): LogEntry[] {
        return this.logger.getSystemLogs(this.id);
    }

    /**
     * Get App Operation Logs (for <application> <info> area)
     */
    getAppOperationLogs(appId: AppID): LogEntry[] {
        return this.logger.getAppLogs(this.id, appId);
    }

    /**
     * Log System Message
     */
    logSystem(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        this.logger.logSystem(this.id, message, level);
    }

    /**
     * Log App Operation
     */
    logAppOperation(appId: AppID, message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        this.logger.logApp(this.id, appId, message, level);
    }

    /**
     * 获取动态 App ID 列表（用于序列化恢复）
     */
    getDynamicAppIds(): AppID[] {
        return this.appManager.getDynamicAppIds();
    }

    /**
     * [RFC-014] 等待所有 App 关闭完成
     * 
     * 关闭所有 App 并等待 Worker 清理。
     * 调用后 Desktop 进入 draining 状态。
     */
    async drain(): Promise<void> {
        if (this._disposed || this._isDraining) return;
        this._isDraining = true;

        this.logSystem('Desktop draining: closing all apps...');

        // 关闭所有 App（等待 Worker 清理）
        await this.appManager.closeAll();

        this.logSystem('Desktop drained: all apps closed.');
    }

    /**
     * [RFC-015] Delete Desktop
     * 
     * 1. 触发 App onDelete 清理数据
     * 2. 调用 drain 关闭 Worker
     * 3. 清理 Desktop 资源
     */
    async delete(): Promise<void> {
        if (this._disposed) return;

        this.logSystem('Desktop deleting: cleaning up app data...');

        // 1. 触发 App 数据清理
        await this.appManager.deleteAll();

        // 2. 标记为 draining (避免重复 close)
        this._isDraining = true;

        // 3. 销毁 Desktop
        await this.dispose();

        this.logSystem('Desktop deleted.');
    }

    async dispose(): Promise<void> {
        if (this._disposed) return;

        // [RFC-014] 确保 drain 过
        if (!this._isDraining) {
            await this.drain();
        }

        this._disposed = true;
        this.signalBus.cleanup(this.id);
    }

    // --- Internals ---

    /**
     * Dispatch Operation to App Container
     * 
     * Desktop is responsible for converting Operation Payload to DOM Events (or IPC messages)
     * and sending them to the App.
     * 
     * [Worker-Only] For WorkerSandbox, use IPC instead of CustomEvent
     * [P0-1 FIX] Now returns the actual OperationResult from the Worker
     */
    async dispatchOperation(appId: AppID, payload: OperationPayload): Promise<import('../../spi/index.js').OperationResult> {
        const sandbox = this.appManager.getWorkerSandbox(appId);
        if (!sandbox) {
            return failedResult('APP_NOT_FOUND', { appId, desktopId: this.id });
        }

        // WorkerSandbox Mode: Dispatch operation via IPC
        // [P0-1 FIX] Return the actual result from executeOperation
        return await sandbox.executeOperation(
            createOperationId(payload.operation),
            payload.args || {},
            createSnapshotId(payload.context.snapshotId || ''),
            payload.context.viewId
        );
    }



    // Delegate to SignalBus
    public emitSignal(reason: UpdateSignal['reason']) {
        this.signalBus.emitSignal(this.id, reason);
    }

    // [RFC-001 Phase 2] DOM Observers Removed

}
