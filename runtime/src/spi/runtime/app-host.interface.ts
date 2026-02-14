/**
 * SPI Layer - App Host Service Interface
 * 
 * 抽象 App 的安装、执行和状态查询。
 * 实现可以是 Worker-based, WASM-based, 或 Remote-based。
 * 
 * @module @aotui/runtime/spi
 */

import type { AppID, DesktopID, ViewID } from '../core/types.js';
import type { OperationPayload } from '../core/operations.js';
import type { AppLaunchConfig } from '../app/app-config.interface.js';

// ============================================================================
// Snapshot Fragment
// ============================================================================

/**
 * Snapshot Fragment (Worker 端渲染结果)
 * 
 * 当 Worker 端执行 Transformer 时，返回的局部渲染结果。
 * Kernel 会将多个 Fragment 聚合为完整的 Snapshot。
 */
export interface SnapshotFragment {
    /** App ID */
    appId: AppID;
    /** Markdown 渲染结果 */
    markup: string;
    /** 索引映射表 (用于 Operation 参数解析) */
    indexMap: Record<string, unknown>;
    /** 更新时间戳 (用于排序) */
    timestamp?: number;
}

// ============================================================================
// App Install Options
// ============================================================================

/**
 * App 安装选项
 */
export interface AppInstallOptions {
    /** 自定义 App ID (默认自动生成) */
    appId?: AppID;
    /** App 显示名称 */
    name?: string;
    /** App 启动配置 (环境变量、初始状态等) */
    config?: AppLaunchConfig;
    /** Worker 脚本路径 (可选，默认使用 Runtime 内置) */
    workerScriptPath?: string;
    /** [Fix] App 角色 */
    promptRole?: 'user' | 'assistant';
}

// ============================================================================
// App Host Service Interface
// ============================================================================

/**
 * App 托管服务接口
 * 
 * 抽象 App 的安装、执行和状态查询。
 * 
 * 设计原则:
 * - 接口隔离: 仅暴露 Kernel 需要的能力
 * - 依赖反转: Kernel 依赖此接口，不依赖具体实现
 * - 可替换性: 支持 Worker、WASM、Remote 等多种托管策略
 * 
 * @example
 * ```typescript
 * // Worker-based implementation
 * const appHost: IAppHostService = new WorkerAppHostService();
 * 
 * const appId = await appHost.install(desktopId, './my-app.js');
 * await appHost.executeOperation(desktopId, appId, operationPayload);
 * const fragments = appHost.getSnapshotFragments(desktopId);
 * ```
 */
export interface IAppHostService {
    // ─────────────────────────────────────────────────────────────
    //  App 安装
    // ─────────────────────────────────────────────────────────────

    /**
     * 安装 App
     * 
     * @param desktopId - 目标 Desktop
     * @param modulePath - App 模块路径 (ESM)
     * @param options - 安装选项
     * @returns 分配的 App ID
     * @throws {Error} E_NOT_FOUND 如果 Desktop 不存在
     */
    install(
        desktopId: DesktopID,
        modulePath: string,
        options?: AppInstallOptions
    ): Promise<AppID>;

    // ─────────────────────────────────────────────────────────────
    //  操作执行
    // ─────────────────────────────────────────────────────────────

    /**
     * 执行操作
     * 
     * 将操作载荷发送到指定 App 执行。
     * 
     * @param desktopId - Desktop ID
     * @param appId - 目标 App ID
     * @param payload - 操作载荷
     * @throws {Error} E_NOT_FOUND 如果 App 不存在
     */
    executeOperation(
        desktopId: DesktopID,
        appId: AppID,
        payload: OperationPayload
    ): Promise<void>;

    // ─────────────────────────────────────────────────────────────
    //  View 生命周期
    // ─────────────────────────────────────────────────────────────

    /**
     * 挂载 View
     */


    /**
     * 卸载 View
     */
    dismountView(desktopId: DesktopID, appId: AppID, viewId: ViewID): Promise<void>;

    // ─────────────────────────────────────────────────────────────
    //  状态查询
    // ─────────────────────────────────────────────────────────────

    /**
     * 获取所有 App 的 Snapshot Fragments
     * 
     * @param desktopId - Desktop ID
     * @returns 所有 App 的渲染片段
     */
    getSnapshotFragments(desktopId: DesktopID): SnapshotFragment[];

    /**
     * 获取 App 信息
     * 
     * @param desktopId - Desktop ID
     * @param appId - App ID
     * @returns App 元信息 (name 等) 或 undefined
     */
    getAppInfo(desktopId: DesktopID, appId: AppID): { name?: string } | undefined;

    /**
     * 检查 App 是否存在
     */
    hasApp(desktopId: DesktopID, appId: AppID): boolean;

    // ─────────────────────────────────────────────────────────────
    //  生命周期控制
    // ─────────────────────────────────────────────────────────────

    /**
     * 暂停指定 Desktop 的所有 App
     */
    pauseAll(desktopId: DesktopID): Promise<void>;

    /**
     * 恢复指定 Desktop 的所有 App
     */
    resumeAll(desktopId: DesktopID): Promise<void>;

    /**
     * 关闭指定 Desktop 的所有 App 并释放资源
     */
    closeAll(desktopId: DesktopID): Promise<void>;

    // ─────────────────────────────────────────────────────────────
    //  事件回调
    // ─────────────────────────────────────────────────────────────

    /**
     * 设置 Signal 发射器
     * 
     * 当 App 需要触发 UI 更新信号时 (如 DOM 变化)，
     * 通过此回调通知上层。
     * 
     * @param emitter - Signal 发射函数
     */
    setSignalEmitter(emitter: (desktopId: DesktopID, reason: string) => void): void;
}
