/**
 * Level 1: ViewContext Core Contract
 * 
 * Defines the minimal contract between Runtime and App (SDK).
 * This is the stable foundation for cross-boundary communication.
 */

import type { AppID, DesktopID, ViewID } from '../core/types.js';
import type { AppLaunchConfig } from './app-config.interface.js';

export interface IViewContextCore {
    /** The App ID this view belongs to */
    readonly appId: AppID;

    /** The Desktop ID (used for loading related data, e.g. history) */
    readonly desktopId: DesktopID;

    /** This View's unique ID */
    readonly viewId: ViewID;

    /**
     * The DOM container for this View.
     * 
     * Created by the App within its DOM tree. The View renders its content into this container.
     * Ensures "One App = One DOM".
     */
    readonly container: HTMLElement;

    /**
     * The App's Document object.
     * 
     * SDK uses this to create DOM elements, ensuring they belong to the correct Document.
     * Solves cross-Document operation issues (e.g. linkedom).
     */
    readonly document: Document;

    /**
     * App 启动配置
     * 
     * 由 Runtime 在 App 启动时注入，包含环境变量和初始状态。
     * SDK 通过此字段显式获取配置，而非依赖 globalThis。
     * 
     * @example
     * ```tsx
     * const ctx = useViewContext();
     * const topicId = ctx.appConfig?.env?.AOTUI_TopicID;
     * ```
     */
    readonly appConfig?: AppLaunchConfig;

    /**
     * Ref Exporter (Refactoring: Explicit Dependency)
     * 
     * Allows SDK to register refs to the Runtime without relying on globals.
     * [RFC-002] Ref Registry Refactoring
     */
    readonly refExporter?: import('./ref-exporter.interface.js').IRefExporter;
}

