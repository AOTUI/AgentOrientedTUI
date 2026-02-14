/**
 * SPI Layer - Kernel Interfaces
 * 
 * 定义 Kernel、Desktop、Registry 的契约。
 */

import type {
    SnapshotID,
    DesktopID,
    AppID,
    ViewID,
    DataPayload,
    IndexMap,
    DesktopState,
    AppConfig
} from '../core/types.js';
import type { Tool } from '../core/tool-call.js';
// [C1 FIX] Command type removed - unified to Operation
import type { Operation, OperationResult, OperationPayload } from '../core/operations.js';
import type { UpdateSignal } from '../core/signals.js';
import type { CachedSnapshot } from '../core/snapshot.js';
import type { IRuntimeContext } from './context.interface.js'; // New

import type { IAOTUIApp } from '../app/app.interface.js';

// ============================================================================
// Desktop Interface
// ============================================================================

/**
 * Desktop 接口
 * 
 * [Worker-Only] 隔离的运行时沙箱，托管多个 App。
 * 所有 App 运行在独立的 Worker Thread 中。
 */
export interface IDesktop {
    id: DesktopID;

    /**
     * [Worker-Only] 安装 App
     * 
     * App 运行在独立的 Worker Thread 中。
     * 
     * [C1 Fix] workerScriptPath 现在是可选的，默认使用 Runtime 内置的 worker-runtime
     */
    installDynamicWorkerApp(
        appModulePath: string,
        options?: {
            workerScriptPath?: string;
            appId?: string;
            name?: string;
            /** [RFC-013] App description for Agent */
            description?: string;
            whatItIs?: string;
            whenToUse?: string;
            config?: import('../app/app-config.interface.js').AppLaunchConfig;
            promptRole?: 'user' | 'assistant';
        }
    ): Promise<string>;

    /**
     * [RFC-014] 注册待启动 App (懒加载)
     * 
     * App 信息写入 installedApps，但不启动 Worker。
     * Agent 可以在 Snapshot 中看到这些 App，并通过 open_app 启动。
     */
    registerPendingApp(options: {
        appId?: string;
        name?: string;
        description?: string;
        whatItIs?: string;
        whenToUse?: string;
        modulePath: string;
        workerScriptPath?: string;
        promptRole?: 'user' | 'assistant';
    }): Promise<string>;

    // System Commands (App)
    openApp(appId: AppID): Promise<void>;
    closeApp(appId: AppID): Promise<void>;
    collapseApp(appId: AppID): Promise<void>;
    showApp(appId: AppID): Promise<void>;

    // System Commands (View)

    dismountView(appId: AppID, viewId: ViewID): Promise<void>;
    hideView(appId: AppID, viewId: ViewID): Promise<void>;
    showView(appId: AppID, viewId: ViewID): Promise<void>;

    // [RFC-006] ViewLink Mount
    mountViewByLink(appId: AppID, parentViewId: ViewID, linkId: string): Promise<void>;

    /**
     * 分发操作到应用容器
     * 
     * [C2 Refactor] 替代 Dispatcher 直接操作 DOM
     * Desktop 负责将操作载荷转换为 DOM 事件并发送给 App。
     * 
     * @param appId - 目标 App ID
     * @param payload - 操作载荷
     * @returns 操作执行结果
     */
    dispatchOperation(appId: AppID, payload: OperationPayload): Promise<OperationResult>;



    output: {
        subscribe(listener: (signal: UpdateSignal) => void): void;
        unsubscribe(listener: (signal: UpdateSignal) => void): void;
    };

    /**
     * [RFC-001] 获取所有 App 的 Snapshot Fragments
     * 
     * 当 Worker-Side Transformation 启用时，Worker 直接执行 Transformer，
     * 此方法返回所有 App 的缓存 Markdown + IndexMap + ViewTree。
     * 
     * [RFC-007] Added viewTree for Application View Tree section
     * 
     * @returns 所有 App 的 Snapshot Fragments
     */
    getSnapshotFragments(): { appId: AppID; markup: string; indexMap: Record<string, unknown>; viewTree?: string }[];

    /**
     * 获取 App 信息
     * @param appId - App ID
     * @returns App 信息 (name, etc.) 或 undefined
     */
    getAppInfo?(appId: AppID): { name?: string } | undefined;

    /**
     * 等待所有活动 Worker 结束
     * 
     * 用于 Graceful Shutdown
     */
    drain(): Promise<void>;

    /**
     * [RFC-015] 删除 Desktop
     * 
     * 1. 调用所有 App 的 onDelete() (清理持久化数据)
     * 2. 调用 drain() (关闭 Worker)
     * 3. 清理资源
     */
    delete(): Promise<void>;
}

// ============================================================================
// Registry Interface
// ============================================================================

/**
     * Registry 接口
     * 
     * 管理 Snapshot 的存储和生命周期。
     */
export interface IRegistry {
    /**
     * 创建并注册新快照
     * 
     * @param indexMap - 索引映射
     * @param markup - 完整的 Markdown 内容 (向后兼容)
     * @param ttl - 可选的生存时间
     * @param structured - [RFC-014] 可选的结构化快照
     */
    create(indexMap: IndexMap, markup: string, ttl?: number, structured?: import('../core/snapshot.js').StructuredSnapshot): CachedSnapshot;
    retain(id: SnapshotID): void;
    release(id: SnapshotID): void;
    resolve(id: SnapshotID, path: string): DataPayload | undefined;
}

// ============================================================================
// Kernel Interface
// ============================================================================

/**
 * Kernel 接口
 * 
 * Runtime 的核心编排器。
 */
export interface IKernel {
    createDesktop(desktopId?: DesktopID, context?: IRuntimeContext): Promise<DesktopID>;
    // [M1 FIX] Changed from void to Promise<void> to match implementation
    destroyDesktop(desktopId: DesktopID): Promise<void>;

    // App Management
    /**
     * [Worker-Only] 安装 App
     * 
     * @param desktopId - 目标桌面 ID
     * @param appModulePath - App 模块路径
     * @param workerScriptPath - Worker 脚本路径 (可选，默认使用 Runtime 内置)
     * @param options - 可选配置
     * @returns 分配的 appId
     * 
     * [C1 Fix] workerScriptPath 现在是可选的
     */
    installDynamicWorkerApp(
        desktopId: DesktopID,
        appModulePath: string,
        options?: {
            workerScriptPath?: string;
            appId?: string;
            name?: string;
            /** [RFC-013] App description for Agent */
            description?: string;
            config?: import('../app/app-config.interface.js').AppLaunchConfig;
            promptRole?: 'user' | 'assistant';
        }
    ): Promise<string>;

    /**
     * 获取 Desktop 实例
     * @throws {Error} E_NOT_FOUND if Desktop doesn't exist
     */
    getDesktop(desktopId: DesktopID): IDesktop;

    // Locking
    acquireLock(desktopId: DesktopID, ownerId: string): void;
    releaseLock(desktopId: DesktopID, ownerId: string): void;

    // Snapshot
    acquireSnapshot(desktopId: DesktopID, ttl?: number): Promise<CachedSnapshot>;
    releaseSnapshot(snapshotId: SnapshotID): void;

    // Execution
    /**
     * 执行操作
     * 
     * @param desktopId - 目标 Desktop
     * @param operation - 操作对象
     * @param ownerId - 锁持有者 ID
     */
    execute(desktopId: DesktopID, operation: Operation, ownerId: string): Promise<OperationResult>;

    /**
     * 获取系统工具定义
     */
    getSystemToolDefinitions(): Tool[];

    // [H3 FIX] Changed from void to Promise<void> - Desktop methods are async
    suspend(desktopId: DesktopID): Promise<void>;
    resume(desktopId: DesktopID): Promise<void>;
    serialize(desktopId: DesktopID): DesktopState;

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
    gracefulShutdown(desktopId: DesktopID, options?: ShutdownOptions): Promise<void>;

    /**
     * [RFC-015] 删除 Desktop
     * 
     * 永久销毁 Desktop 及其所有数据。
     * 会触发 App 的 onDelete 生命周期钩子。
     */
    deleteDesktop(desktopId: DesktopID): Promise<void>;
}

/**
 * [RFC-014] 优雅关闭选项
 */
export interface ShutdownOptions {
    /** 超时时间(ms)，默认 30000 */
    timeoutMs?: number;
    /** 关闭前回调 */
    beforeClose?: () => Promise<void>;
}
