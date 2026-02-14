/**
 * AOTUI SDK - Context Definitions
 *
 * [RFC-003] ViewContext Provider 拆分
 * [P4/P5 FIX] Types now imported from @aotui/runtime/spi (SSOT)
 *
 * 将原本的"上帝上下文" ViewContextInternal 拆分为多个独立的 Context，
 * 实现关注点分离和性能隔离。
 *
 * @module @aotui/sdk/contexts
 */
import { createContext } from "preact";
import type { IView } from "@aotui/runtime/spi";

// ═══════════════════════════════════════════════════════════════
//  [P4/P5 FIX] Import types from SPI (SSOT)
// ═══════════════════════════════════════════════════════════════

// Re-export types from SPI as the canonical source
export type {
  IViewMeta,
  IRefRegistry,
  IViewLinkRegistry,
  IMountableViewRegistry,
  IOperationRegistry,
  IDynamicViewRegistry,
  ITypeToolRegistry,
  IAppConfig,
  RegisterLinkOptionsPublic as RegisterLinkOptions,
  SimpleOperationHandler,
} from "@aotui/runtime/spi";

// Import for context creation (need the actual types)
import type {
  IViewMeta,
  IRefRegistry,
  IViewLinkRegistry,
  IMountableViewRegistry,
  IOperationRegistry,
  IDynamicViewRegistry,
  ITypeToolRegistry,
  IAppConfig,
} from "@aotui/runtime/spi";

/**
 * IView 的 Context 别名 (避免循环依赖)
 */
export type IViewForContext = IView;

// ═══════════════════════════════════════════════════════════════
//  1. ViewMetaContext - 公共元数据
//  这是唯一对外暴露给应用开发者的 Context
// ═══════════════════════════════════════════════════════════════

/**
 * View 元数据 Context
 *
 * 这是应用开发者的主要入口点。
 */
export const ViewMetaContext = createContext<IViewMeta | null>(null);
ViewMetaContext.displayName = "AOTUI.ViewMeta";

// ═══════════════════════════════════════════════════════════════
//  2. OperationRegistryContext - Operation 注册
//  由 <Operation> 组件专用
// ═══════════════════════════════════════════════════════════════

/**
 * Operation 注册表 Context
 */
export const OperationRegistryContext =
  createContext<IOperationRegistry | null>(null);
OperationRegistryContext.displayName = "AOTUI.OperationRegistry";

// ═══════════════════════════════════════════════════════════════
//  3. MountableViewRegistryContext - ViewLink 专用
// ═══════════════════════════════════════════════════════════════

/**
 * 可挂载视图注册表 Context
 */
export const MountableViewRegistryContext =
  createContext<IMountableViewRegistry | null>(null);
MountableViewRegistryContext.displayName = "AOTUI.MountableViewRegistry";

// ═══════════════════════════════════════════════════════════════
//  4. DynamicViewRegistryContext - ChildView 专用
// ═══════════════════════════════════════════════════════════════

/**
 * 动态子视图注册表 Context
 */
export const DynamicViewRegistryContext =
  createContext<IDynamicViewRegistry | null>(null);
DynamicViewRegistryContext.displayName = "AOTUI.DynamicViewRegistry";

// ═══════════════════════════════════════════════════════════════
//  5. RefRegistryContext - Ref 绑定
//  由 useArrayRef 等 Hooks 专用
// ═══════════════════════════════════════════════════════════════

/**
 * Ref 注册表 Context
 */
export const RefRegistryContext = createContext<IRefRegistry | null>(null);
RefRegistryContext.displayName = "AOTUI.RefRegistry";

// ═══════════════════════════════════════════════════════════════
//  6. AppConfigContext - 应用配置 (内部)
//  不对外暴露，通过 useAppEnv Hook 访问
// ═══════════════════════════════════════════════════════════════

/**
 * 应用配置 Context
 */
export const AppConfigContext = createContext<IAppConfig | null>(null);
AppConfigContext.displayName = "AOTUI.AppConfig";

// ═══════════════════════════════════════════════════════════════
//  [RFC-004] 统一 Runtime Context
// ═══════════════════════════════════════════════════════════════

export {
  ViewRuntimeContext,
  type ViewRuntimeContextValue,
} from "./view-runtime-context.js";

