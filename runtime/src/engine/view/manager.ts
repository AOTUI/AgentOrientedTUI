/**
 * ViewManager - View 生命周期管理
 * 
 * [H1 拆分 Phase 4] 从 Desktop 提取的 View 管理模块。
 * 
 * 职责:
 * - View 挂载/卸载 (mount/dismount)
 * - View 显示/隐藏 (show/hide)
 * 
 * 设计说明:
 * - ViewManager 通过 DesktopDOM 接口与 Desktop 交互
 * - View 操作通过 CustomEvent 分发到 App 容器
 */

import type { AppID, ViewID } from '../../spi/index.js';

/**
 * ViewManager - View 生命周期管理
 * 
 * [RFC-001 Phase 2] Worker-Only 架构下，View 管理主要由 Worker 内部处理。
 * 此类保留用于向后兼容或未来扩展，目前主要为空操作。
 */
export class ViewManager {

    // ========================================================================
    // View 生命周期方法
    // ========================================================================

    /**
     * 挂载 View
     */
    async mount(appId: AppID, viewId: ViewID): Promise<void> {
        // Worker App 应该通过 IPC 处理，进入此路径意味着非 Worker App 或错误
        console.warn(`[ViewManager] Legacy mount called for ${appId}:${viewId}. Ignored in Worker-Only mode.`);
    }

    /**
     * 卸载 View
     */
    async dismount(appId: AppID, viewId: ViewID): Promise<void> {
        // No-op
    }

    /**
     * 隐藏 View
     */
    async hide(appId: AppID, viewId: ViewID): Promise<void> {
        // No-op
    }

    /**
     * 显示 View
     */
    async show(appId: AppID, viewId: ViewID): Promise<void> {
        // No-op
    }

    /**
     * [RFC-006] Mount view via ViewLink
     */
    async mountByLink(appId: AppID, parentViewId: ViewID, linkId: string): Promise<void> {
        // Worker App 应该通过 IPC 处理，进入此路径意味着非 Worker App 或错误
        console.warn(`[ViewManager] Legacy mountByLink called for ${appId}:${parentViewId}:${linkId}. Ignored in Worker-Only mode.`);
    }
}

