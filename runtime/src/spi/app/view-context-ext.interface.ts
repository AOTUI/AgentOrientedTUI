/**
 * Level 3: ViewContext Extension Contract
 * 
 * [RFC-006] ViewLink/View ID 解耦设计
 * 
 * Defines extension capabilities for advanced features (e.g., Mountable Views, Re-indexing).
 * These are optional capabilities that a Context implementation MAY support.
 */

import type { ViewID } from '../core/types.js';
import type { IView } from './view.interface.js';
import type { LinkEntry } from './view-link.types.js';

// ============================================================================
// ViewLink Registration Options
// ============================================================================

/**
 * ViewLink 注册选项
 */
export interface RegisterLinkOptions {
    /**
     * LinkID 前缀 (用于列表)
     * 
     * SDK 会自动生成: `${prefix}_${index}`
     * 不提供时使用 viewType 作为前缀
     */
    prefix?: string;

    /**
     * 显示标签
     */
    label?: string;
}

// ============================================================================
// IViewContextMountable Interface
// ============================================================================

/**
 * Extension for ViewLink mechanism (Mountable Views).
 * 
 * [RFC-006] 重新设计的 ViewLink API：
 * - registerLink: 注册 ViewLink (返回 linkId)
 * - unregisterLink: 注销 ViewLink
 * - 保留旧 API 用于向后兼容
 */
export interface IViewContextMountable {
    // ═══════════════════════════════════════════════════════════════
    //  [RFC-006] New API
    // ═══════════════════════════════════════════════════════════════

    /**
     * 注册一个 ViewLink
     * 
     * @param uniqueId - 业务唯一标识 (跨快照稳定)
     * @param viewType - View 类型名称 (IViewFactory.displayName)
     * @param factory - View 工厂函数
     * @param props - 传递给 View 的 Props
     * @param options - 注册选项
     * @returns 分配的 LinkID (父 View 内唯一)
     */
    registerLink(
        uniqueId: string,
        viewType: string,
        factory: (viewId: string, props?: Record<string, unknown>) => IView,
        props?: Record<string, unknown>,
        options?: RegisterLinkOptions
    ): string;

    /**
     * 注销一个 ViewLink
     * 
     * @param linkId - 要注销的 LinkID
     */
    unregisterLink(linkId: string): void;

    /**
     * 获取已绑定的 ViewID (如果有)
     * 
     * 用于 ViewLink 渲染时检查是否已有 mount 的 View
     * 
     * @param viewType - View 类型名称
     * @param uniqueId - 业务唯一标识
     * @returns ViewID 或 undefined
     */
    getBoundViewId(viewType: string, uniqueId: string): ViewID | undefined;


    // ═══════════════════════════════════════════════════════════════
    //  Legacy API (Back-compat)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @deprecated Use registerLink instead
     */
    registerMountableView(
        factory: (viewId: string, props?: Record<string, unknown>) => IView,
        props?: Record<string, unknown>,
        label?: string
    ): string;

    /**
     * @deprecated Use unregisterLink instead
     */
    unregisterMountableView(viewId: string): void;

    /**
     * @deprecated No longer supported in V2
     */
    subscribeToReindex(callback: (idMapping: Map<string, string>) => void): () => void;
}

/**
 * Type guard to check if a context supports Mountable View extensions.
 */
export function hasMountableSupport(ctx: unknown): ctx is IViewContextMountable {
    return (
        typeof ctx === 'object' &&
        ctx !== null &&
        typeof (ctx as any).registerLink === 'function' &&
        typeof (ctx as any).unregisterLink === 'function' &&
        typeof (ctx as any).getBoundViewId === 'function'
    );
}



