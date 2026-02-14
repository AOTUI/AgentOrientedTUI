/**
 * AOTUI SDK - App Runtime Context
 * 
 * [RFC-027] App层级的Runtime上下文,提供给View组件使用
 * 
 * 职责:
 * - 暴露viewId分配接口 (allocateViewId)
 * - 暴露View注册接口 (registerView/unregisterView)
 * - 提供RefExporter访问 (registerRef/unregisterRef)
 * - 传递App/Desktop元数据 (appId, desktopId)
 */

import { createContext, useContext } from 'preact/compat';
import type { AppID, DesktopID, ViewID, IView, IRefExporter, ITypeToolRegistry, AppLaunchConfig } from '@aotui/runtime/spi';

// ═══════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════

/**
 * App Runtime Context Value
 * 
 * 由AppKernel在initializeFromComponent时创建并提供
 */
export interface AppRuntimeContextValue {
    /** App ID */
    appId: AppID;

    /** Desktop ID */
    desktopId: DesktopID;

    /** App 启动配置 */
    launchConfig?: AppLaunchConfig;

    /**
     * 分配viewId (层序遍历递增)
     * 
     * @param key - View唯一键 (name或name_uniqueId)
     * @returns 分配的viewId (如view_0, view_1...)
     */
    allocateViewId: (key: string) => ViewID;

    /**
     * 注册IView实例到AppKernel
     * 
     * @param view - IView实例
     */
    registerView: (view: IView) => void;

    /**
     * 注销IView实例
     * 
     * @param viewId - View ID
     */
    unregisterView: (viewId: ViewID) => void;

    /**
     * RefExporter访问 (用于useRef/useArrayRef)
     */
    refExporter: IRefExporter;

    /**
     * Type Tool Registry访问 (用于useViewTypeTool) [RFC-020]
     */
    typeTools: ITypeToolRegistry;

    /**
     * ViewRegistry访问 (用于View组件ID冲突检测)
     * 
     * @optional 如果为空View组件将跳过ID冲突检测
     */
    viewRegistry?: {
        has(viewId: ViewID): boolean;
    };

    /**
     * 标记App为脏状态 (触发重新渲染)
     */
    markDirty: () => void;
}

// ═══════════════════════════════════════════════════════════════
//  Context
// ═══════════════════════════════════════════════════════════════

/**
 * App Runtime Context
 * 
 * 由AppKernel的Provider在根组件包裹时提供
 */
export const AppRuntimeContext = createContext<AppRuntimeContextValue | null>(null);

// [RFC-027-C] Factory Injection Pattern:
// Context不再通过globalThis/Symbol注册，而是由Factory内部直接使用。

// ═══════════════════════════════════════════════════════════════
//  Hook
// ═══════════════════════════════════════════════════════════════

/**
 * 使用App Runtime Context
 * 
 * @throws 如果不在AppRuntimeContext.Provider内调用
 */
export function useAppRuntimeContext(): AppRuntimeContextValue {
    const ctx = useContext(AppRuntimeContext);

    if (!ctx) {
        throw new Error(
            '[AOTUI SDK] useAppRuntimeContext must be used within AppRuntimeContext.Provider.\n\n' +
            'This is an internal error. Please contact framework maintainers if you see this message.'
        );
    }

    return ctx;
}
