/**
 * AOTUI Runtime - Component Factory Interface (SPI)
 * 
 * [RFC-027-C] Factory Injection Pattern
 * 
 * **设计原则**:
 * 1. 完全解耦: Runtime不依赖SDK实现细节
 * 2. 接口契约: 明确的类型定义
 * 3. 职责分离: SDK负责渲染,Runtime负责管理
 * 4. 可测试性: 易于Mock和单元测试
 * 
 * @packageDocumentation
 */

import type { IView } from './app/index.js';
import type { IRefExporter, ITypeToolRegistry } from './app/index.js';
import type { ViewID } from './core/index.js';
import type { AppID } from './core/index.js';
import type { DesktopID } from './core/index.js';
import type { AppLaunchConfig } from './app/app-config.interface.js';

// ═══════════════════════════════════════════════════════════════
//  Runtime Context
// ═══════════════════════════════════════════════════════════════

/**
 * Runtime Context
 * 
 * Runtime向SDK提供的运行时能力。
 * SDK通过这些接口与Runtime交互，无需知道Runtime内部实现。
 */
export interface RuntimeContext {
    /** 应用ID */
    appId: AppID;

    /** 桌面ID */
    desktopId: DesktopID;

    /** App 启动配置 */
    launchConfig?: AppLaunchConfig;

    /**
     * 分配ViewID
     * 
     * @param key - View的唯一标识 (name_uniqueId)
     * @returns 分配的ViewID (view_0, view_1, ...)
     */
    allocateViewId: (key: string) => ViewID;

    /**
     * 注册View到Runtime
     * 
     * @param view - IView实例
     */
    registerView: (view: IView) => void;

    /**
     * 注销View
     * 
     * @param viewId - 要注销的ViewID
     */
    unregisterView: (viewId: ViewID) => void;

    /**
     * Ref导出器
     * 
     * SDK通过此接口导出语义引用(useRef, useArrayRef)
     */
    refExporter: IRefExporter;

    /**
     * Type Tool注册表 [RFC-020]
     * 
     * SDK通过此接口注册/注销Type Tools
     */
    typeTools: ITypeToolRegistry;

    /**
     * 标记为脏
     * 
     * 当View内容变化时调用，触发Runtime重新推送
     */
    markDirty: () => void;
}

// ═══════════════════════════════════════════════════════════════
//  Component Renderer
// ═══════════════════════════════════════════════════════════════

/**
 * Component Renderer
 * 
 * SDK返回给Runtime的渲染控制接口。
 * Runtime通过这些方法控制组件生命周期。
 */
export interface ComponentRenderer {
    /**
     * 渲染组件
     * 
     * 强制重新渲染组件树（通常用于状态恢复）
     */
    render: () => void;

    /**
     * 卸载组件
     * 
     * 清理所有组件、移除DOM、解绑事件
     */
    unmount: () => void;

    // [未来扩展]
    // pause?: () => void;    // 暂停组件更新
    // resume?: () => void;   // 恢复组件更新
    // getSnapshot?: () => any; // 获取组件状态快照
}

// ═══════════════════════════════════════════════════════════════
//  Component Factory
// ═══════════════════════════════════════════════════════════════

/**
 * Component Factory
 * 
 * SDK通过createTUIApp返回的工厂对象。
 * Runtime调用initializeComponent来初始化组件树。
 * 
 * **职责分离**:
 * - SDK: 创建Preact VNode、设置Context、处理渲染
 * - Runtime: 提供容器、注入运行时能力、管理生命周期
 */
export interface ComponentFactory {
    /**
     * 初始化组件
     * 
     * @param container - DOM容器（由Runtime创建）
     * @param context - 运行时上下文（Runtime能力注入）
     * @returns 渲染控制器
     * 
     * @example
     * ```tsx
     * const renderer = factory.initializeComponent(appContainer, {
     *     appId: 'app_0',
     *     desktopId: 'desktop_0',
     *     allocateViewId: (key) => this.allocateViewId(key),
     *     registerView: (view) => this.registerView(view),
     *     // ...
     * });
     * ```
     */
    initializeComponent(
        container: HTMLElement,
        context: RuntimeContext
    ): Promise<ComponentRenderer>;

    // [传统配置保留] 用于Operation路由等
    onOperation?: (op: any, id: string, ctx: any) => Promise<any>;
    onDelete?: () => Promise<void>;

    // [未来扩展]
    // getMetadata?: () => AppMetadata;
    // validateContext?: (context: RuntimeContext) => boolean;
}
