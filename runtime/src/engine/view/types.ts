/**
 * AOTUI View 类型定义
 * 
 * View 是 App 的 UI 组件，每个 View 有自己的:
 * - 唯一 ID (由 Runtime 分配)
 * - 数据状态
 * - 操作集合 (operations)
 * - 渲染逻辑
 * 
 * View 形成树状结构，例如:
 * - [Navigation](view:view_0, mounted)
 *     - [Conversations](view:view_1, mounted)
 *         - [Johnny Chat](view:view_3, mounted)
 *     - [Contacts](view:view_2)
 */

import { ViewID, AppID, DesktopID, IView, IViewContext } from '../../spi/index.js';

// [H1 FIX] Re-export IView and IViewContext from SPI for backward compatibility
export type { IView, IViewContext };

// Re-export ViewID for convenience
export type { ViewID } from '../../spi/index.js';

// ============================================================================
// ViewContext - View 运行上下文 (Local Alias for Existing Code)
// ============================================================================

/**
 * View 运行上下文
 * 
 * 提供 View 运行所需的能力
 * 
 * [H1 FIX] This is a local alias for IViewContext from SPI.
 * New code should use IViewContext directly.
 * 
 * [Plan A] 添加 container 字段支持 one app = one dom
 * [Plan B] 添加 document 字段确保 DOM 隔离
 */
export interface ViewContext {
    /** 所属 App ID (Branded Type) */
    readonly appId: AppID;

    /** 所属 Desktop ID (用于加载相关数据，如历史消息) (Branded Type) */
    readonly desktopId: DesktopID;

    /** 此 View 的 ID */
    readonly viewId: ViewID;

    /**
     * [Plan A] View 的 DOM 容器
     * 
     * 由 App 在其 DOM 树中创建，View 渲染内容到此容器。
     */
    readonly container: HTMLElement;

    /**
     * [Plan B] App 的 Document 对象
     */
    readonly document: Document;

    /** 
     * 通知 UI 更新
     * View 状态变化后调用此方法触发重新渲染
     */
    notifyUpdate(): void;

    /**
     * 请求 mount 子 View
     * 
     * @example
     * // Agent 执行: mount view --id view_3
     * await context.mountChildView('view_3');
     */
    mountChildView(viewId: ViewID): Promise<void>;

    /**
     * 请求 dismount 子 View
     */
    dismountChildView(viewId: ViewID): Promise<void>;
}

// [H1 FIX] IView interface is now defined in SPI (spi/view.interface.ts)
// Re-exported at line 20 for backward compatibility

// [H1 FIX] ViewNode interface removed to resolve conflict with SPI re-export.
// See line 119 for the re-export.

// ============================================================================
// IViewTree - Re-exported from SPI (B1 FIX)
// ============================================================================

/**
 * [B1 FIX] IViewTree is now defined in SPI layer.
 * Re-exported here for backward compatibility within Engine.
 */
export type {
    IViewTree,
    ViewNode, // Consolidated export
    ViewNode as ViewNodeFromSPI,
    ViewContextFactory
} from '../../spi/index.js';

