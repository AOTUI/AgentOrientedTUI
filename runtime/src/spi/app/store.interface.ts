/**
 * SPI Layer - App Context
 * 
 * App 运行上下文定义。
 * 
 * [C3 简化] 移除了 IAppStore/IAppStoreFactory。
 * AOTUI 是 de-visualized TUI，App 无独立状态。
 * 业务数据持久化由 Product Layer 负责。
 */

import type { DesktopID, AppID } from '../core/types.js';

// ============================================================================
// App 上下文 (简化版)
// ============================================================================

/**
 * App 运行上下文
 * 
 * 在 App.onOpen() 时由 Desktop 创建并传入。
 * 提供 App 运行所需的环境信息和能力。
 * 
 * [设计说明]
 * - AOTUI App 的状态 = DOM 内容，由 Desktop.serialize() 管理
 * - 业务数据持久化由 Product Layer 负责 (如 messageService)
 * - 不再提供 per-app store，简化 API
 */
export interface AppContext {
    /** 所属 Desktop ID */
    readonly desktopId: DesktopID;

    /** 当前 App ID */
    readonly appId: AppID;



    /**
     * [Option D] 标记该 App 需要更新
     * 
     * 不立即触发 UpdateSignal，而是等待 DOM_UPDATE 到达后才发送。
     * 这解决了 signal 变化 → notifyUpdate → snapshot 读取旧 DOM 的竞态问题。
     * 
     * [Approach D] 同时触发 forceRender 回调进行同步渲染。
     */
    markDirty(): void;

    /**
     * [Approach D] 注册渲染回调
     * 
     * ViewBasedApp 在 onOpen 时注册此回调，当 markDirty() 被调用时
     * Worker 会同步调用此回调以强制 Preact 重渲染。
     * 
     * @param callback 渲染回调函数 (通常是 renderAllViews)
     */
    onRender(callback: () => void): void;
}
