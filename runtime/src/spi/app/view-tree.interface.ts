/**
 * SPI Layer - IViewTree Interface
 * 
 * Defines the contract for View tree management.
 * SDK should depend on this interface, not the Engine implementation.
 * 
 * [B1 FIX] Extracted from engine/view/types.ts to SPI layer
 * for proper dependency inversion.
 * 
 * [RFC-011] Extended with ViewLink and Mountable methods.
 */

import type { ViewID } from '../core/types.js';
import type { IView, IViewContext } from './view.interface.js';
import type { LinkEntry } from './view-link.types.js';

// ============================================================================
// ViewNode - View 树节点
// ============================================================================

/**
 * View 树节点
 * 
 * 封装 View 及其在树中的位置信息
 */
export interface ViewNode {
    /** View 实例 */
    readonly view: IView;

    /** 父节点 ID (根节点为 null) */
    readonly parentId: ViewID | null;

    /** 子节点 ID 列表 */
    readonly childIds: readonly ViewID[];

    /** 是否已 mount */
    mounted: boolean;
}

// ============================================================================
// MountableViewEntry - 可挂载视图条目
// ============================================================================

/**
 * [RFC-006] Mountable View Entry
 * 
 * 存储尚未实例化的可挂载视图信息。
 * 当 ViewLink 注册时，只缓存工厂和属性；
 * 当 Agent 调用 mount_view 时，才实际创建 View 实例。
 */
export interface MountableViewEntry {
    /** View 工厂函数 */
    factory: (viewId: string, props?: Record<string, unknown>) => IView;
    /** 初始化属性 */
    props?: Record<string, unknown>;
    /** 父视图 ID */
    parentId: ViewID;
    /** 显示标签 */
    label?: string;
}

// ============================================================================
// ViewContextFactory - View 上下文工厂
// ============================================================================

/**
 * ViewContext 工厂函数类型
 * 
 * 由 App 提供，用于为每个 View 创建运行上下文。
 */
export type ViewContextFactory = (viewId: ViewID) => IViewContext;

// ============================================================================
// IViewTree - View 树接口
// ============================================================================

/**
 * View 树接口
 * 
 * 维护 App 的完整 View 层级结构。
 * 
 * [P1 FIX] SDK 必须实现此接口来管理其内部 View 状态。
 * Runtime 不提供此接口的实现，而是通过 DOM Snapshot 获取 View 结构。
 * 
 * SSOT (Single Source of Truth):
 * - SDK: 只有 ViewTree 实体，管理 View 实例生命周期。
 * - Runtime: 通过 DOM 投影观察 View 结构。
 * 
 * View 树结构示例:
 * ```
 * - [Navigation](view:view_0, mounted)
 *     - [Conversations](view:view_1, mounted)
 *         - [Johnny Chat](view:view_3, mounted)
 *         - [Group Chat](view:view_4)
 *     - [Contacts](view:view_2)
 * ```
 */
export interface IViewTree {
    /** 根节点 ID */
    readonly rootId: ViewID | null;

    // ═══════════════════════════════════════════════════════════════
    //  基础 View 管理
    // ═══════════════════════════════════════════════════════════════

    /**
     * 获取节点
     */
    getNode(viewId: ViewID): ViewNode | undefined;

    /**
     * 获取 View
     */
    getView(viewId: ViewID): IView | undefined;

    /**
     * 添加 View 到树
     * 
     * @param view - View 实例
     * @param parentId - 父节点 ID (根节点传 null)
     */
    addView(view: IView, parentId: ViewID | null): void;

    /**
     * 移除 View (及其子树)
     */
    removeView(viewId: ViewID): void;

    /**
     * Mount View
     * 
     * 调用 view.onMount() 并标记为 mounted
     */
    mountView(viewId: ViewID): Promise<void>;

    /**
     * Dismount View
     * 
     * 先 dismount 所有子 View，再调用 view.onDismount()
     */
    dismountView(viewId: ViewID): Promise<void>;

    /**
     * 获取所有已 mount 的 View
     */
    getMountedViews(): IView[];

    /**
     * 获取 View 的完整路径 (从根到此节点)
     */
    getPath(viewId: ViewID): ViewID[];

    /**
     * 获取子 View
     */
    getChildren(viewId: ViewID): IView[];

    /**
     * 渲染 View Tree 状态
     * 
     * 输出 TUI 格式:
     * ```
     * ## Application View Tree
     * - [Navigation](view:view_0, mounted)
     *     - [Conversations](view:view_1, mounted)
     *     - [Contacts](view:view_2)
     * ```
     */
    renderTree(): string;

    /**
     * 渲染所有已 mount 的 View 内容
     */
    renderMountedViews(): string;

    // ═══════════════════════════════════════════════════════════════
    //  [RFC-006] Mountable View API (Legacy)
    // ═══════════════════════════════════════════════════════════════

    /**
     * 注册可挂载视图 (V1 Legacy)
     * 
     * @param viewId - 预生成的 View ID
     * @param parentId - 父视图 ID
     * @param factory - View 工厂函数
     * @param props - 初始化属性
     * @param label - 显示标签
     */
    registerMountableView(
        viewId: ViewID,
        parentId: ViewID,
        factory: (viewId: string, props?: Record<string, unknown>) => IView,
        props?: Record<string, unknown>,
        label?: string
    ): void;

    /**
     * 注销可挂载视图
     */
    unregisterMountableView(viewId: ViewID): void;

    /**
     * 获取可挂载视图条目
     */
    getMountableEntry(viewId: ViewID): MountableViewEntry | undefined;

    /**
     * 挂载已注册的可挂载视图
     */
    mountMountableView(viewId: ViewID): Promise<void>;

    /**
     * 检查是否为已注册但未实例化的可挂载视图
     */
    isMountableView(viewId: ViewID): boolean;

    /**
     * 获取父视图下所有未挂载的子视图 ID
     */
    getMountableChildren(parentId: ViewID): ViewID[];

    // ═══════════════════════════════════════════════════════════════
    //  [RFC-006] ViewLink API (V2)
    // ═══════════════════════════════════════════════════════════════

    /**
     * 分配唯一的 LinkID
     * 
     * @param parentId - 父视图 ID
     * @param prefix - ID 前缀 (通常是 viewType)
     * @returns 生成的 LinkID (如 "Chat_0")
     */
    allocateLinkId(parentId: ViewID, prefix: string): string;

    /**
     * 注册 ViewLink
     * 
     * @param parentId - 父视图 ID
     * @param entry - Link 条目数据
     */
    registerLink(parentId: ViewID, entry: LinkEntry): void;

    /**
     * 注销 ViewLink
     * 
     * @param parentId - 父视图 ID
     * @param linkId - Link ID
     */
    unregisterLink(parentId: ViewID, linkId: string): void;

    /**
     * 获取绑定的 ViewID
     * 
     * 通过 ViewType + UniqueID 组合查找已挂载的 View。
     * 用于跨 Snapshot 的视图匹配。
     * 
     * @param viewType - 视图类型
     * @param uniqueId - 唯一标识符
     * @returns 已绑定的 ViewID，未找到返回 undefined
     */
    getBoundViewId(viewType: string, uniqueId: string): ViewID | undefined;

    /**
     * 通过 ViewLink 挂载视图
     * 
     * 当 Agent 执行 mount(parent_view, link_id) 时调用。
     * 
     * @param parentId - 父视图 ID
     * @param linkId - Link ID
     * @returns 挂载后的 ViewID
     */
    mountByLink(parentId: ViewID, linkId: string): Promise<ViewID>;

    /**
     * 获取父视图下所有 Link 条目
     * 
     * @param parentId - 父视图 ID
     * @returns Link 条目列表
     */
    getLinksInParent(parentId: ViewID): LinkEntry[];

    /**
     * 重置 Link 计数器
     * 
     * 在每次渲染周期开始时调用。
     * 
     * @param parentId - 父视图 ID
     */
    resetLinkCounters(parentId: ViewID): void;

    /**
     * 清除父视图下所有 Links
     * 
     * 当父视图被卸载时调用。
     * 
     * @param parentId - 父视图 ID
     */
    clearLinksForParent(parentId: ViewID): void;

    // ═══════════════════════════════════════════════════════════════
    //  [RFC-027] Component Mode View Registration
    // ═══════════════════════════════════════════════════════════════

    /**
     * 注册组件模式View (from SDK's View component)
     * 
     * Component-mode Views:
     * - Are registered directly without parent (flat structure)
     * - Manage their own mounted state via React lifecycle
     * - Don't participate in traditional ViewTree hierarchy
     * 
     * This method unifies View storage, making ViewTree the single source of truth
     * for both traditional-mode and component-mode Views.
     * 
     * @param view - IView instance created by createInlineView()
     */
    registerComponentView(view: IView): void;

    /**
     * 注销组件模式View
     * 
     * Called when SDK View component unmounts (via useLayoutEffect cleanup)
     * 
     * @param viewId - View ID to unregister
     */
    unregisterComponentView(viewId: ViewID): void;
}
