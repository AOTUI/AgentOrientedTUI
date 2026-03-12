/**
 * AOTUI SDK - useViewContext Hook
 *
 * [RFC-003] 使用独立 Context 实现关注点分离
 * [RFC-004] 使用 Selector 模式实现细粒度订阅
 *
 * 每个 Hook 只从统一 Context 中选择需要的部分,
 * 实现 Re-render 隔离和类型安全。
 */
import { useContext } from './preact-hooks.js';

// [RFC-004] Selector Hook
import { useViewSelector } from "./use-view-selector.js";

import {
  // 类型
  type IViewMeta,
  type IMountableViewRegistry,
  type IDynamicViewRegistry,
  type IRefRegistry,
  type IAppConfig,
} from "../contexts/index.js";

// 向后兼容的类型别名
export type ViewContextPublic = IViewMeta;

// ═══════════════════════════════════════════════════════════════
//  辅助函数
// ═══════════════════════════════════════════════════════════════

/**
 * 从堆栈追踪中提取调用位置，用于更好的错误信息
 */
function getCallerLocation(): string {
  const stack = new Error().stack;
  if (!stack) return "unknown location";

  const lines = stack.split("\n");
  // Skip: Error, getCallerLocation, throwContextError, useXxx → caller is line 5
  const callerLine = lines[4]?.trim() || lines[3]?.trim();
  if (!callerLine) return "unknown location";

  return callerLine;
}

function throwContextError(hookName: string, contextName: string): never {
  const location = getCallerLocation();
  throw new Error(
    `[AOTUI SDK] ${hookName} must be used within a View.\n` +
    `Called from: ${location}\n` +
    `Missing Context: ${contextName}\n` +
      `Tip: Ensure your component is rendered inside a <View>.`,
  );
}

// ═══════════════════════════════════════════════════════════════
//  公共 API - [RFC-004] 使用 Selector 模式重构
// ═══════════════════════════════════════════════════════════════

/**
 * 获取当前 View 的元数据 (公共 API)
 *
 * [RFC-004] 使用 Selector 模式，只订阅 meta 字段
 *
 * @throws Error 如果在 View 外部使用
 * @returns IViewMeta (viewId, appId, desktopId, markDirty)
 *
 * @example
 * function MyComponent() {
 *     const { viewId, markDirty } = useViewContext();
 *     // Use markDirty() to trigger UI updates after state changes
 * }
 */
export function useViewContext(): IViewMeta {
  // [RFC-004] 使用 Selector 模式，只订阅 meta 字段
  // 当 operations, refs 等其他字段变化时不会触发 re-render
  return useViewSelector((ctx) => ctx.meta);
}

// ═══════════════════════════════════════════════════════════════
//  专用 Registry Hooks (ISP - Interface Segregation Principle)
//  [RFC-004] 每个 Hook 只从统一 Context 中选择需要的部分
// ═══════════════════════════════════════════════════════════════

/**
 * 获取可挂载视图注册表 (内部 API)
 *
 * [RFC-004] 使用 Selector 只订阅 mountable 字段
 *
 * @internal 仅供 `<ViewLink>` 组件使用
 */
export function useMountableViewRegistry(): IMountableViewRegistry {
  return useViewSelector((ctx) => ctx.mountable);
}

/**
 * 获取动态子视图注册表 (内部 API)
 *
 * [RFC-004] 使用 Selector 只订阅 dynamic 字段
 *
 * @internal 仅供 `<ChildView>` 组件使用
 */
export function useDynamicViewRegistry(): IDynamicViewRegistry {
  return useViewSelector((ctx) => ctx.dynamic);
}

/**
 * 获取 Ref 注册表 (内部 API)
 *
 * [RFC-004] 使用 Selector 只订阅 refs 字段
 *
 * @internal 仅供 `useArrayRef` 等 Hooks 使用
 */
export function useRefRegistry(): IRefRegistry {
  return useViewSelector((ctx) => ctx.refs);
}

/**
 * 获取应用配置 (内部 API)
 *
 * [RFC-004] 使用 Selector 只订阅 config 字段
 *
 * @internal
 */
export function useAppConfig(): IAppConfig {
  // config 可以为空，返回空对象
  return useViewSelector((ctx) => ctx.config) ?? {};
}
