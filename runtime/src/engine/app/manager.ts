/**
 * AppManager - App 安装与生命周期管理
 * 
 * [Worker-Only] 重构为使用 WorkerSandbox 实现 App 隔离
 * 
 * 职责:
 * - App 安装 (Worker 模式)
 * - App 生命周期 (open/close/pause/resume)
 * - App 状态查询
 * - 管理 WorkerSandbox 集合
 * 
 * 设计说明:
 * - 每个 App 在独立的 Worker Thread 中运行
 * - 通过 mirrorDOM 实现主线程 DOM 同步
 * - AppManager 持有 Desktop 引用用于日志和信号
 */

import type { DesktopID, AppID, AppState, IDesktop } from '../../spi/index.js';
import { createAppId } from '../../spi/index.js';
import { WorkerSandbox, type SandboxStatus } from './worker-sandbox.js';

/**
 * 已安装的 App 信息
 */
export interface InstalledApp {
    appId: AppID;
    name?: string;
    /** [RFC-013] App 描述 - 告诉 Agent 什么时候使用此 App */
    description?: string;
    /** App 是什么 (用于 Desktop State 展示) */
    whatItIs?: string;
    /** 什么时候用 (用于 Desktop State 展示) */
    whenToUse?: string;
    html: string;
    /**
     * [RFC-014] App 状态
     * - 'pending': 已注册但未启动 (懒加载)
     * - 'running': 正在运行
     * - 'closed': 已关闭
     * - 'collapsed': 已折叠
     */
    status: 'pending' | 'running' | 'closed' | 'collapsed';
    installedAt: number;

    /** [RFC-014] 懒加载: 模块路径 */
    modulePath?: string;
    /** [RFC-014] 懒加载: Worker 脚本路径 */
    workerScript?: string;

    /** [RFC-025] Reopen 时复用的启动配置 */
    config?: import('../../spi/app/app-config.interface.js').AppLaunchConfig;

    /** [RFC-005] Reopen 时复用的 Runtime 配置 */
    runtimeConfig?: import('../../spi/config/index.js').RuntimeConfig;

    /** [RFC-014] 消息角色 */
    promptRole?: 'user' | 'assistant';
}

export interface AppManagerOptions {
    /** App 安装回调 */
    onAppInstalled?: (appId: AppID) => void;
    /** App 移除回调 */
    onAppRemoved?: (appId: AppID) => void;
}



/**
 * AppManager - 统一管理 App 安装与生命周期
 * 
 * [Worker-Only] 使用 WorkerSandbox 实现 App 隔离
 */
interface IDesktopInternal extends IDesktop {
    emitSignal(reason: string): void;
    logSystem(message: string, level?: 'info' | 'warn' | 'error'): void;
    logAppOperation(appId: AppID, message: string, level?: 'info' | 'warn' | 'error'): void;
    getDocument?(): Document; // Optional/Deprecated
}

export class AppManager {
    // ════════════════════════════════════════════════════════════════
    //  Private State
    // ════════════════════════════════════════════════════════════════

    /** [Worker-Only] WorkerSandbox 集合 - 核心隔离机制 */
    private workers = new Map<AppID, WorkerSandbox>();

    /** 已安装 App 元数据 (用于序列化和状态查询) */
    private installedApps = new Map<AppID, InstalledApp>();

    /** App ID 计数器 */
    private appIdCounter = 0;

    /** 配置选项 */
    private options: AppManagerOptions;


    /** Desktop 引用 (用于日志和信号) */
    private readonly desktop: IDesktopInternal;

    // ════════════════════════════════════════════════════════════════
    //  Constructor
    // ════════════════════════════════════════════════════════════════

    constructor(desktop: IDesktop, options?: AppManagerOptions) {
        this.desktop = desktop as unknown as IDesktopInternal;
        this.options = options || {};
    }

    // ════════════════════════════════════════════════════════════════
    //  安装方法
    // ════════════════════════════════════════════════════════════════

    /**
     * [Worker-Only] 安装 App
     * 
     * App 运行在独立的 Worker Thread 中，通过 IPC 通信
     * 
     * [C1 Fix] workerScriptPath 现在是可选的，默认使用 Runtime 内置的 worker-runtime
     */
    async install(
        appModulePath: string,
        options?: {
            workerScriptPath?: string;
            appId?: AppID;
            name?: string;
            /** [RFC-013] App description for Agent */
            description?: string;
            /** App 是什么 */
            whatItIs?: string;
            /** 什么时候用 */
            whenToUse?: string;
            config?: import('../../spi/app/app-config.interface.js').AppLaunchConfig;
            runtimeConfig?: import('../../spi/config/index.js').RuntimeConfig; // [RFC-005] Runtime Config

            /** [RFC-014] App Role */
            promptRole?: 'user' | 'assistant';
        }
    ): Promise<AppID> {
        // 分配 ID
        const appId = options?.appId ?? createAppId(this.appIdCounter++);

        // 创建 WorkerSandbox
        const workerSandbox = new WorkerSandbox({
            appId,
            desktopId: this.desktop.id,
            name: options?.name,
            appModulePath,
            workerScriptPath: options?.workerScriptPath,
            config: options?.config, // ✨ 传递配置
            runtimeConfig: options?.runtimeConfig, // [RFC-005] Pass configuration
        });

        // 设置更新回调
        workerSandbox.onUpdateRequest = () => {
            this.desktop.emitSignal('manual_refresh');
        };

        // 启动 Worker 并打开 App
        await workerSandbox.installDynamic();

        // [RFC-001 Phase 2] Removed Mirror DOM initialization and initial HTML push
        // Worker now uses Snapshot Fragment protocol exclusively.

        // 注册
        this.workers.set(appId, workerSandbox);

        // 记录元数据
        this.installedApps.set(appId, {
            appId,
            name: options?.name,
            description: options?.description,  // [RFC-013]
            whatItIs: options?.whatItIs,
            whenToUse: options?.whenToUse,
            html: '',  // 初始为空，之后通过 mirrorDOM 同步
            status: 'running',
            installedAt: Date.now(),
            modulePath: appModulePath,
            workerScript: options?.workerScriptPath,
            config: options?.config,
            runtimeConfig: options?.runtimeConfig,
            promptRole: options?.promptRole,
        });

        this.desktop.logSystem(`Installed Worker app: ${appId}`);
        this.desktop.emitSignal('app_opened');
        this.options.onAppInstalled?.(appId);

        return appId;
    }

    /**
     * [RFC-014] 注册待启动 App (懒加载)
     * 
     * App 信息写入 installedApps，但不启动 Worker。
     * Agent 可以在 Snapshot 中看到这些 App，并通过 open_app 启动。
     */
    registerPendingApp(options: {
        appId?: AppID;
        name?: string;
        description?: string;
        whatItIs?: string;
        whenToUse?: string;
        modulePath: string;
        workerScriptPath?: string;
        promptRole?: 'user' | 'assistant';
    }): AppID {
        const appId = options.appId ?? createAppId(this.appIdCounter++);

        this.installedApps.set(appId, {
            appId,
            name: options.name,
            description: options.description,
            whatItIs: options.whatItIs,
            whenToUse: options.whenToUse,
            html: '',
            status: 'pending',
            installedAt: Date.now(),
            modulePath: options.modulePath,
            workerScript: options.workerScriptPath,
            config: undefined,
            runtimeConfig: undefined,
            promptRole: options.promptRole,
        });

        this.desktop.logSystem(`Registered pending app: ${appId} (${options.name ?? 'unnamed'})`);
        return appId;
    }

    /**
     * [RFC-014] 启动待启动 App
     * 
     * 将 pending 状态的 App 真正安装并启动 Worker
     */
    async startPendingApp(appId: AppID): Promise<boolean> {
        const app = this.installedApps.get(appId);

        if (!app) {
            console.warn(`[AppManager] Cannot start ${appId}: not found`);
            return false;
        }

        if (app.status !== 'pending' && app.status !== 'closed') {
            console.warn(`[AppManager] App ${appId} is not startable (status: ${app.status})`);
            return false;
        }

        if (!app.modulePath) {
            console.error(`[AppManager] Cannot start ${appId}: missing modulePath`);
            return false;
        }

        // 真正安装 Worker
        await this.install(app.modulePath, {
            appId,
            name: app.name,
            description: app.description,
            whatItIs: app.whatItIs,
            whenToUse: app.whenToUse,
            workerScriptPath: app.workerScript,
            config: app.config,
            runtimeConfig: app.runtimeConfig,
            promptRole: app.promptRole,
        });

        this.desktop.logSystem(`Started staged app: ${appId}`);
        return true;
    }


    // ════════════════════════════════════════════════════════════════
    //  生命周期方法
    // ════════════════════════════════════════════════════════════════

    /**
     * 暂停所有 App
     */
    async pauseAll(): Promise<void> {
        for (const [appId, worker] of this.workers) {
            if (worker.status === 'running') {
                await worker.pause();
            }
        }
    }

    /**
     * 恢复所有 App
     */
    async resumeAll(): Promise<void> {
        for (const [appId, worker] of this.workers) {
            if (worker.status === 'paused') {
                await worker.resume();
            }
        }
    }

    /**
     * 关闭所有 App
     */
    async closeAll(): Promise<void> {
        for (const [appId, worker] of this.workers) {
            await worker.close();
            worker.dispose();
            this.options.onAppRemoved?.(appId);
        }
        this.workers.clear();
    }

    /**
     * [RFC-015] 删除所有 App
     * 
     * 1. 触发每个 App 的 onDelete (数据清理)
     * 2. 关闭并销毁 Worker
     */
    async deleteAll(): Promise<void> {
        for (const [appId, worker] of this.workers) {
            await worker.delete();
            worker.dispose();
            this.options.onAppRemoved?.(appId);
        }
        this.workers.clear();
    }

    /**
     * 打开指定 App (显示已关闭/折叠的 App)
     */
    async openApp(appId: AppID): Promise<void> {
        // [RFC-014] Check if app is staged (pending/closed) and start it
        const app = this.installedApps.get(appId);
        if (app && (app.status === 'pending' || app.status === 'closed')) {
            const started = await this.startPendingApp(appId);
            if (!started) {
                console.warn(`Failed to start staged app ${appId}`);
                return;
            }
            return;
        }

        const worker = this.workers.get(appId);
        if (!worker) {
            console.warn(`App ${appId} not found.`);
            return;
        }

        // [RFC-001 Phase 2] UI logic should be handled by Frontend/Product layer based on app status

        if (app) app.status = 'running';

        this.desktop.logSystem(`Opened application: ${appId}`);
        this.desktop.logAppOperation(appId, 'Application opened.');
        this.desktop.emitSignal('app_opened');
    }

    /**
     * 关闭指定 App
     *
     * 关闭后会真正释放 Worker，并把 App 从活动 Snapshot/Tool 集合中移除。
     * 安装元数据会保留，因此后续仍可通过 open_app 重新启动。
     */
    async closeApp(appId: AppID): Promise<void> {
        const worker = this.workers.get(appId);
        if (!worker) return;

        await worker.close();
        worker.dispose();
        this.workers.delete(appId);

        const app = this.installedApps.get(appId);
        if (app) app.status = 'closed';

        this.desktop.logSystem(`Closed application: ${appId}`);
        this.desktop.logAppOperation(appId, 'Application closed.');
        this.desktop.emitSignal('dom_mutation');
    }

    /**
     * 折叠指定 App
     */
    async collapseApp(appId: AppID): Promise<void> {
        const worker = this.workers.get(appId);
        if (!worker) return;



        // [RFC-001 Phase 2] UI logic should be handled by Frontend/Product layer based on app status

        const app = this.installedApps.get(appId);
        if (app) app.status = 'collapsed';

        this.desktop.logAppOperation(appId, 'Application collapsed.');
        this.desktop.emitSignal('dom_mutation');
    }

    /**
     * 显示指定 App (从折叠状态恢复)
     */
    async showApp(appId: AppID): Promise<void> {
        const worker = this.workers.get(appId);
        if (!worker) return;



        // [RFC-001 Phase 2] UI logic should be handled by Frontend/Product layer based on app status

        const app = this.installedApps.get(appId);
        if (app) app.status = 'running';

        this.desktop.logAppOperation(appId, 'Application shown.');
        this.desktop.emitSignal('dom_mutation');
    }

    // ════════════════════════════════════════════════════════════════
    //  查询方法
    // ════════════════════════════════════════════════════════════════





    /**
     * 获取所有 Workers
     */
    getAllWorkers(): Map<AppID, WorkerSandbox> {
        return this.workers;
    }



    /**
     * 获取所有已安装 App
     */
    getInstalledApps(): InstalledApp[] {
        return Array.from(this.installedApps.values());
    }

    /**
     * 获取动态 App ID 列表
     */
    getDynamicAppIds(): AppID[] {
        return Array.from(this.workers.keys());
    }

    /**
     * 获取 App 状态列表
     */
    getAppStates(): AppState[] {
        // [RFC-001 Phase 2] HTML is no longer available in AppManager (Headless)
        // Clients should subscribe to Snapshots.

        return Array.from(this.installedApps.entries()).map(([appId, app]) => ({
            appId,
            name: app.name,
            html: app.html,
            status: app.status,
            installedAt: app.installedAt
        }));
    }

    /**
     * 获取 WorkerSandbox
     */
    getWorkerSandbox(appId: AppID): WorkerSandbox | undefined {
        return this.workers.get(appId);
    }

    /**
     * 检查 App 是否运行在 Worker 模式
     * 
     * 在 Worker-Only 架构下，始终返回 true
     */
    isWorkerMode(appId: AppID): boolean {
        return this.workers.has(appId);
    }

    // ════════════════════════════════════════════════════════════════
    //  [RFC-011] LLM Output Channel
    // ════════════════════════════════════════════════════════════════

    /**
     * [RFC-011] Broadcast LLM text to all Workers
     * [RFC-020] Now accepts structured payload { reasoning?, content? }
     * 
     * Called by Desktop when LLMOutputChannelService receives new text.
     */
    broadcastLLMOutput(
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
        console.log(`[AppManager] Broadcasting LLM text to ${this.workers.size} workers`);
        for (const [appId, worker] of this.workers) {
            worker.pushLLMOutput(payload, type, meta);
        }
    }

    // ════════════════════════════════════════════════════════════════
    //  清理
    // ════════════════════════════════════════════════════════════════

    /**
     * 清理所有 Worker
     */
    cleanup(): void {
        for (const worker of this.workers.values()) {
            worker.dispose();
        }
        this.workers.clear();

        this.installedApps.clear();
        this.appIdCounter = 0;
    }
}
