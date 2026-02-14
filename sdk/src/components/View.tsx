/**
 * AOTUI SDK - View Component (RFC-027 Enhanced + View Type Mechanism)
 *
 * 组件模式: 在createTUIApp的AppRuntimeContext中使用
 *
 * View Type机制改造:
 * - id prop改为必填，由开发者手动指定
 * - 新增type prop，用于同类View的Tool聚合
 * - 移除uniqueId（breaking change，不向后兼容）
 * 
 * 渲染为: <div id="fd_0" data-view-type="FileDetail">...</div>
 * Transformer转换为: <view id="fd_0" type="FileDetail" name="File: auth.ts">...</view>
 */
import { ComponentChildren, h } from "preact";
import { useMemo, useEffect, useLayoutEffect, useRef as usePreactRef, useContext } from "preact/compat";
import { useViewContext } from "../hooks/useViewContext.js";
import { AppRuntimeContext } from "../context/AppRuntimeContext.js";
import { ViewRuntimeContext } from "../contexts/index.js";
import { createInlineView } from "../adapter/createInlineView.js";
import type { ViewID } from "@aotui/runtime/spi";
import { createViewId } from "@aotui/runtime/spi";  // ✅ Import factory function

export interface ViewProps {
  /** 
   * View ID (required, manually specified by developer)
   * 
   * Naming rules:
   * - Only alphanumeric characters and underscore (_)
   * - 2-15 characters long
   * - Must be unique within the app
   * 
   * Examples:
   * - Single instance: "workspace", "chat", "settings"
   * - Multiple instances: "fd_0", "fd_1", "user_123"
   */
  id: string;

  /**
   * View type (optional, defaults to id)
   * 
   * Used for grouping Views of the same type and Tools aggregation.
   * Multiple views can share the same type.
   * 
   * Examples:
   * - type="FileDetail" for all file detail views
   * - type="UserProfile" for all user profile views
   */
  type?: string;

  /**
   * Display name (optional, defaults to id)
   * 
   * Human-readable name shown in Snapshot
   */
  name?: string;

  /** Child elements */
  children?: ComponentChildren;

  /**
   * Optional close handler for system-initiated dismount.
   * Use to update state and unmount this View.
   */
  onClose?: () => void;
}

/**
 * View组件
 */
export function View({ id, type, name, children, onClose }: ViewProps) {
  // Validate ID format
  if (!id) {
    throw new Error(
      '[AOTUI SDK] View "id" prop is required.\n' +
      'Example: <View id="workspace" type="Workspace">\n' +
      'Naming rules: alphanumeric and underscore (_) only, 2-15 characters'
    );
  }

  if (!/^[a-zA-Z0-9_]{2,15}$/.test(id)) {
    throw new Error(
      `[AOTUI SDK] Invalid View ID "${id}".\n` +
      'ID must be 2-15 characters, alphanumeric and underscore (_) only.\n' +
      'Examples: "workspace", "fd_0", "user_123"'
    );
  }

  // 尝试获取AppRuntimeContext (组件模式)
  const appContext = useContext(AppRuntimeContext);

  // 如果在组件模式下
  if (!appContext) {
    throw new Error(`[AOTUI SDK] Empty AppRuntimeContext`);
  }

  return h(ComponentModeView, { id, type, name, children, onClose });
}



/**
 * 组件模式View (RFC-027新模式 + View Type机制)
 */
function ComponentModeView({ id, type, name, children, onClose }: ViewProps) {
  const appContext = useContext(AppRuntimeContext)!;

  // Derive type and display name
  const viewType = type || id;
  const displayName = name || id;

  // Use developer-specified ID directly (with type branding)
  const viewId = createViewId(id);  // ✅ 确保类型安全

  // 容器ref (用于创建InlineView)
  const containerRef = usePreactRef<HTMLDivElement>(null);

  // Operation注册表
  const operationsRef = usePreactRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (!onClose || !containerRef.current) {
      return;
    }

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { viewId?: ViewID } | undefined;
      if (detail?.viewId && detail.viewId !== viewId) {
        return;
      }
      onClose();
    };

    const node = containerRef.current;
    node.addEventListener('aotui:view-close', handler as EventListener);
    return () => {
      node.removeEventListener('aotui:view-close', handler as EventListener);
    };
  }, [onClose, viewId]);

  // 注册/注销IView实例
  // [CRITICAL] 使用useLayoutEffect而非useEffect
  // 
  // 时序要求：
  // - Runtime在初次渲染后立即查询View
  // - useEffect是异步的，会导致VIEW_NOT_FOUND错误
  // - useLayoutEffect在DOM更新后、浏览器绘制前同步执行
  // 
  // 执行顺序：
  // 1. ComponentModeView render → 创建<div ref={containerRef}>
  // 2. React提交DOM更新 → containerRef.current指向div
  // 3. useLayoutEffect同步执行 → registerView(view) ✅
  // 4. 浏览器绘制
  // 5. Runtime查询view_0 → 找到 ✅
  useLayoutEffect(() => {
    if (!containerRef.current) return;

    // Check for ID conflicts BEFORE creating view
    if (appContext.viewRegistry && appContext.viewRegistry.has(viewId)) {
      throw new Error(
        `[AOTUI SDK] View ID "${viewId}" already exists!\n` +
        `Please ensure all View IDs are unique within the app.\n` +
        `Tip: Use prefixes like fd_0, fd_1 for multiple instances of same type.`
      );
    }

    // 创建轻量级IView实例
    const view = createInlineView({
      id: viewId,
      name: displayName,
      type: viewType,  // ✅ 传递type信息
      container: containerRef.current,
      operations: operationsRef.current,
    });

    // 注册到AppKernel
    appContext.registerView(view);

    // ✅ 立即调用onMount,设置组件模式View的mounted状态
    // Inline View的onMount不需要参数,只设置mounted标志
    view.onMount({} as any);

    return () => {
      // ✅ cleanup时调用onDismount
      view.onDismount();
      appContext.unregisterView(viewId);
    };
  }, [viewId, displayName, viewType]);

  // 构建ViewRuntimeContext (供子组件使用)
  const viewRuntimeContext = useMemo(() => ({
    meta: {
      viewId: viewId,
      viewType: viewType,  // ✅ 传递type信息
      appId: appContext.appId,
      desktopId: appContext.desktopId,
      markDirty: appContext.markDirty,
    },
    operations: {
      registerOperation: (opName: string, handler: any) => {
        operationsRef.current.set(opName, handler);
      },
      unregisterOperation: (opName: string) => {
        operationsRef.current.delete(opName);
      },
    },
    refs: {
      registerRef: (refId: string, data: object) => {
        appContext.refExporter.registerRef(viewId, refId, data);
      },
      unregisterRef: (refId: string) => {
        appContext.refExporter.unregisterRef(viewId, refId);
      },
    },
    typeTools: appContext.typeTools, // [RFC-020] Expose Type Tool Registry
    // 其他context字段可能需要stub实现
    mountable: {
      registerLink: undefined,
      unregisterLink: undefined,
      getBoundViewId: undefined,
    },
    dynamic: {
      registerChildView: () => {
        throw new Error('[AOTUI SDK] registerChildView not supported in component mode');
      },
      unregisterChildView: () => {
        throw new Error('[AOTUI SDK] unregisterChildView not supported in component mode');
      },
    },
    config: appContext.launchConfig ?? {},
    llmOutput: {
      subscribe: () => () => { },
      getHistory: () => [],
    },
  }), [viewId, viewType, appContext.launchConfig]);

  // 渲染
  return h(
    ViewRuntimeContext.Provider,
    { value: viewRuntimeContext },
    h(
      'div',
      {
        ref: containerRef,
        id: viewId,
        'data-view-id': viewId,
        'data-view-type': viewType,  // ✅ 添加type属性
        'data-view-name': displayName,
        view: displayName
      },
      children
    )
  );
}
