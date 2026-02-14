/**
 * Worker Runtime SPI - 通用 Worker 基础设施接口
 * 
 * 本文件定义了 Worker 侧运行时的标准接口，用于支持多框架生态。
 * 
 * 设计原则：
 * 1. 框架无关：不依赖任何具体的 UI 框架（Preact, Vue, Solid）
 * 2. 职责分离：Worker Runtime 负责"管道"，App Adapter 负责"逻辑"
 * 3. 可测试性：接口可被 Mock，便于单元测试
 * 
 * @module @aotui/runtime/spi/worker-runtime
 */

import type { AppContext } from '../app/store.interface.js';
import type { OperationContext, OperationResult } from '../core/operations.js';
import type { AppID, DesktopID } from '../core/types.js';

// ============================================================================
// Worker Runtime Interface (通用基础设施)
// ============================================================================

/**
 * Worker 运行时接口
 * 
 * 职责：
 * - 初始化 Virtual DOM 环境 (LinkedOM)
 * - 处理 IPC 消息路由
 * - 提供 DOM 观察与同步能力
 * - 管理 App 生命周期框架
 */
export interface IWorkerRuntime {
    /**
     * 初始化 Worker 环境
     * @param config Worker 配置信息
     */
    initialize(config: WorkerRuntimeConfig): Promise<void>;

    /**
     * 加载并初始化 App
     * @param modulePath App 模块路径
     * @param adapter UI 框架适配器
     */
    loadApp(modulePath: string, adapter: IAppAdapter): Promise<void>;

    /**
     * 获取 Virtual DOM 环境
     */
    getDOMEnvironment(): WorkerDOMEnvironment;

    /**
     * 发送消息到主线程
     */
    sendMessage(message: WorkerMessage): void;

    /**
     * 启动 DOM 观察器
     * @param container 要观察的容器元素
     */
    observeDOM(container: Element): void;

    /**
     * 手动触发 DOM 同步
     */
    syncDOM(): void;

    /**
     * 关闭 Worker
     */
    shutdown(): Promise<void>;
}

/**
 * Worker Runtime 配置
 */
export interface WorkerRuntimeConfig {
    /** 应用 ID (Branded Type) */
    appId: AppID;
    /** Desktop ID (Branded Type) */
    desktopId: DesktopID;
    /**
     * DOM 更新节流时间 (ms)
     * @default 16
     */
    domUpdateThrottle?: number;
}

/**
 * Virtual DOM 环境
 * 
 * 提供 Worker 内的 DOM API 访问
 */
export interface WorkerDOMEnvironment {
    /** LinkedOM document 实例 */
    document: Document;
    /** LinkedOM window 实例 */
    window: Window;
    /**
     * App 根容器元素
     */
    container: HTMLElement;
}

/**
 * Worker 消息类型 (简化，详细定义在 worker-message.interface.ts)
 */
export interface WorkerMessage {
    type: string;
    [key: string]: unknown;
}

// ============================================================================
// App Adapter Interface (UI 框架适配器)
// ============================================================================

/**
 * App 适配器接口
 * 
 * 职责：
 * - 将 UI 框架挂载到 Virtual DOM
 * - 处理框架特定的生命周期
 * - 提供渲染回调机制
 * 
 * @template TApp App 实例类型（框架特定）
 */
export interface IAppAdapter<TApp = unknown> {
    /**
     * 适配器名称
     * 
     * @example "preact", "vue", "solid"
     */
    readonly name: string;

    /**
     * 初始化框架环境
     * 
     * 例如：设置 globalThis.document, 注册全局 API
     * 
     * @param env Virtual DOM 环境
     */
    setupEnvironment(env: WorkerDOMEnvironment): void;

    /**
     * 创建 App 实例
     * 
     * 从动态导入的模块中提取并创建 App
     * 
     * @param appModule 动态 import() 的模块对象
     * @returns App 实例
     */
    createApp(appModule: any): Promise<TApp>;

    /**
     * 挂载 App 到容器
     * 
     * @param app App 实例
     * @param context Runtime 提供的 App 上下文
     * @param container 挂载目标容器
     * @returns 挂载结果，包含生命周期钩子和操作处理器
     */
    mount(
        app: TApp,
        context: AppContext,
        container: HTMLElement
    ): Promise<AppAdapterMountResult>;

    /**
     * 卸载 App
     * 
     * @param app App 实例
     */
    unmount(app: TApp): Promise<void>;
}

/**
 * App 挂载结果
 * 
 * Adapter 在 mount() 后返回，用于连接 App 与 Worker Runtime
 */
export interface AppAdapterMountResult {
    /**
     * 生命周期钩子
     * 
     * 当 Runtime 调用对应生命周期方法时触发
     */
    lifecycle: {
        /** App 暂停 */
        onPause?: () => Promise<void>;
        /** App 恢复 */
        onResume?: () => Promise<void>;
        /** App 关闭 */
        onClose?: () => Promise<void>;
    };

    /**
     * 操作处理器
     * 
     * 当 Agent 或 Desktop 发起 Operation 时调用
     */
    onOperation: (
        context: OperationContext,
        operation: string,
        args: Record<string, unknown>
    ) => Promise<OperationResult>;

    /**
     * 渲染回调 (可选)
     * 
     * 当 App 调用 `markDirty()` 后，Runtime 会调用此回调。
     * 适用于需要手动触发渲染的情况（如 ViewBasedApp）。
     */
    onRender?: () => void;
}
