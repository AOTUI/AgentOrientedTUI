/**
 * AOTUI SDK - View Selector Hook
 *
 * [RFC-004] 带 Selector 的 Context Hook
 *
 * 只在 selector 返回值变化时触发 re-render，
 * 实现细粒度订阅，避免不必要的组件更新。
 *
 * @module @aotui/sdk/hooks/use-view-selector
 */
import { useContext, useRef } from "./preact-hooks.js";
import {
  ViewRuntimeContext,
  type ViewRuntimeContextValue,
} from "../contexts/view-runtime-context.js";

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
  // Skip: Error, getCallerLocation, createContextError, useXxx → caller is line 5
  const callerLine = lines[5]?.trim() || lines[4]?.trim() || lines[3]?.trim();
  if (!callerLine) return "unknown location";

  return callerLine;
}

/**
 * 创建带有位置信息的 Context 错误
 */
function createContextError(hookName: string): Error {
  const location = getCallerLocation();
  return new Error(
    `[AOTUI SDK] ${hookName} must be used within a View.\n` +
      `Called from: ${location}\n` +
      `Tip: Ensure your component is rendered inside a <View>.`,
  );
}

/**
 * 浅比较两个对象
 *
 * 用于 Selector 结果缓存判断
 */
function shallowEqual<T>(a: T, b: T): boolean {
  // 严格相等
  if (Object.is(a, b)) return true;

  // 非对象类型，已经在上面判断过了
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (a === null || b === null) return false;

  // 对象浅比较
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (
      !Object.is(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
      )
    ) {
      return false;
    }
  }

  return true;
}

// ═══════════════════════════════════════════════════════════════
//  公共 API
// ═══════════════════════════════════════════════════════════════

/**
 * 带 Selector 的 Context Hook
 *
 * [RFC-004] 核心创新 - 只在 selector 返回值变化时触发 re-render
 *
 * @param selector - 从完整 Context 中选择需要的部分
 * @param equalityFn - 自定义相等性比较函数 (默认浅比较)
 * @returns selector 选择的值
 *
 * @example
 * // 只订阅 viewId，其他字段变化不会触发 re-render
 * const viewId = useViewSelector(ctx => ctx.meta.viewId);
 *
 * // 选择多个字段使用浅比较
 * const { viewId, appId } = useViewSelector(ctx => ({
 *     viewId: ctx.meta.viewId,
 *     appId: ctx.meta.appId
 * }));
 */
export function useViewSelector<T>(
  selector: (ctx: ViewRuntimeContextValue) => T,
  equalityFn: (a: T, b: T) => boolean = shallowEqual,
): T {
  const ctx = useContext(ViewRuntimeContext);

  if (!ctx) {
    throw createContextError("useViewSelector");
  }

  // 缓存上一次的选择结果
  const previousRef = useRef<{ value: T; initialized: boolean }>({
    value: undefined as unknown as T,
    initialized: false,
  });

  // 执行 selector
  const selected = selector(ctx);

  // 首次初始化或值变化时更新缓存
  if (
    !previousRef.current.initialized ||
    !equalityFn(previousRef.current.value, selected)
  ) {
    previousRef.current = { value: selected, initialized: true };
  }

  return previousRef.current.value;
}

/**
 * 获取完整的 Runtime Context
 *
 * @internal 仅供 SDK 内部需要访问多个字段的场景
 */
export function useViewRuntimeContext(): ViewRuntimeContextValue {
  const ctx = useContext(ViewRuntimeContext);
  if (!ctx) {
    throw createContextError("useViewRuntimeContext");
  }
  return ctx;
}

// ═══════════════════════════════════════════════════════════════
//  类型导出
// ═══════════════════════════════════════════════════════════════

export type { ViewRuntimeContextValue };
