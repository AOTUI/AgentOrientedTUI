/**
 * SPI Layer - ViewLink Types
 * 
 * [RFC-006] ViewLink/View ID 解耦设计的核心类型定义。
 * 
 * 三层 ID 体系：
 * - ViewID: App 全局唯一，Runtime BFS 分配 (view_0, view_1, ...)
 * - LinkID: 父 View 内唯一，开发者 prefix + SDK 自动索引 (CD_0, CD_1, ...)
 * - UniqueID: 开发者提供的业务 ID，用于跨快照匹配 (conversation:conv_456)
 * 
 * @module @aotui/runtime/spi/app/view-link
 */

import type { ViewID } from '../core/types.js';
import type { IView } from './view.interface.js';

// ============================================================================
// Core Types
// ============================================================================

/**
 * ViewLink 注册信息
 * 
 * 当 ViewLink 组件渲染时，向 Runtime 注册此信息。
 * 包含创建 View 所需的所有数据。
 */
export interface LinkEntry {
    /**
     * LinkID - 父 View 内唯一
     * 
     * 格式: `${prefix}_${index}` 或显式指定
     * 示例: "ConversationDetail_0", "settings_panel"
     */
    linkId: string;

    /**
     * UniqueID - 业务唯一标识
     * 
     * 由开发者基于业务数据提供，用于跨快照匹配 ViewLink 和 View。
     * 匹配键: ViewType + UniqueID
     * 
     * 示例: "conv_456", "order_789"
     */
    uniqueId: string;

    /**
     * View 类型名称
     * 
     * 来自 IViewFactory.displayName
     * 与 uniqueId 组合形成跨快照匹配键
     */
    viewType: string;

    /**
     * 父 View ID
     */
    parentViewId: ViewID;

    /**
     * View 工厂函数
     */
    factory: (viewId: string, props?: Record<string, unknown>) => IView;

    /**
     * 传递给 View 的 Props (对 Agent 隐藏)
     */
    props?: Record<string, unknown>;

    /**
     * 显示标签 (用于 ViewTree 渲染)
     */
    label?: string;
}

/**
 * View 绑定信息
 * 
 * 当 View 通过 ViewLink 被 mount 时，记录绑定关系。
 * 用于幂等 mount 和跨快照匹配。
 */
export interface ViewBinding {
    /**
     * 分配的 ViewID
     */
    viewId: ViewID;

    /**
     * 绑定的 UniqueID
     */
    uniqueId: string;

    /**
     * View 类型名称
     */
    viewType: string;

    /**
     * 父 View ID
     */
    parentViewId: ViewID;
}

/**
 * 匹配键：ViewType + UniqueID
 * 
 * 用于在 Map 中查找绑定关系
 */
export type BindingKey = `${string}:${string}`;

/**
 * 创建匹配键
 */
export function createBindingKey(viewType: string, uniqueId: string): BindingKey {
    return `${viewType}:${uniqueId}` as BindingKey;
}

// ============================================================================
// Mount Operation Types
// ============================================================================

/**
 * Mount 操作参数 (V2)
 * 
 * [RFC-006] 新的 mount 操作需要指定父 View 和 LinkID
 */
export interface MountViewArgsV2 {
    /**
     * App ID
     */
    app_id: string;

    /**
     * 父 View ID (ViewLink 所在的 View)
     */
    parent_view: string;

    /**
     * Link ID (父 View 内唯一)
     */
    link_id: string;
}

/**
 * Mount 操作结果
 */
export interface MountViewResult {
    /**
     * 挂载的 View ID
     */
    viewId: ViewID;

    /**
     * 执行的动作
     * - MOUNTED: 新创建并挂载
     * - ALREADY_MOUNTED: 已存在，幂等返回
     */
    action: 'MOUNTED' | 'ALREADY_MOUNTED';
}

/**
 * Dismount 操作参数 (不变)
 */
export interface DismountViewArgs {
    app_id: string;
    view_id: string;
}
