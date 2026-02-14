/**
 * AOTUI SDK - App Context
 *
 * RFC-003: Operation 作用域与生命周期设计
 *
 * 提供 App 级的 Context，用于：
 * 1. 注册 App-scoped Operation
 * 2. 共享 App 级状态
 *
 * @module @aotui/sdk/hooks/app-context
 */

import { createContext } from "preact";
import type { OperationResult } from "@aotui/runtime/spi";

// ─────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────

/**
 * App-scoped Operation Handler 类型
 */
export type AppOperationHandler = (
  args: Record<string, unknown>,
) => Promise<OperationResult> | OperationResult;

/**
 * App Operation 注册表接口
 * @internal
 */
export interface IAppOperationRegistry {
  /**
   * 注册 App-scoped Operation
   * @param name - Operation 名称
   * @param handler - 执行处理函数
   */
  registerAppOperation: (name: string, handler: AppOperationHandler) => void;

  /**
   * 注销 App-scoped Operation
   * @param name - Operation 名称
   */
  unregisterAppOperation: (name: string) => void;

  /**
   * 获取已注册的 App Operation handler
   * @param name - Operation 名称
   * @returns handler 或 undefined
   */
  getAppOperation: (name: string) => AppOperationHandler | undefined;
}

/**
 * App Context Value
 *
 * 提供给 App 内所有组件的上下文
 */
export interface AppContextValue extends IAppOperationRegistry {
  /** App ID */
  readonly appId: string;
  /** Desktop ID */
  readonly desktopId: string;
  /** 触发 App 级更新 */
  markAppDirty: () => void;
}

// ─────────────────────────────────────────────────────────────
//  Context
// ─────────────────────────────────────────────────────────────

/**
 * App Context
 *
 * 由 App 提供
 *
 * 注意：命名为 TUIAppContext 以避免与 Runtime 的 AppContext 冲突
 */
export const TUIAppContext = createContext<AppContextValue | null>(null);
