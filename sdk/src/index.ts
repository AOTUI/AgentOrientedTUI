/**
 * @aotui/sdk - AOTUI Developer SDK
 *
 * Build Agent-Oriented TUI Apps with Preact
 *
 * @example Type-Safe Tool API
 * @example Type-Safe Tool API
 * ```tsx
 * import { View, useArrayRef, defineParams, useViewTypeTool, createTUIApp, useState } from '@aotui/sdk'
 *
 * function HelpCenter() {
 *     const [articles, setArticles] = useState([])
 *     // Use useArrayRef for semantic lists
 *     const [listRef, itemRef] = useArrayRef('articles', articles, { itemType: 'article' })
 *     const [SearchTool] = useViewTypeTool(
 *         'HelpCenter',
 *         'search',
 *         {
 *             description: '搜索文章',
 *             params: defineParams({
 *                 keyword: { type: 'string', required: true, desc: '搜索关键词' }
 *             })
 *         },
 *         async (args) => ({ success: true, data: { keyword: args.keyword } })
 *     )
 *
 *     return (
 *         <View id="help_center" name="HelpCenter">
 *             <h1>帮助中心</h1>
 *             <h3>{listRef('文章列表')}</h3>
 *             <ul>
 *                 {articles.map((a, idx) => (
 *                     <li key={a.id}>
 *                         {itemRef(idx, a.title)}
 *                     </li>
 *                 ))}
 *             </ul>
 *             <SearchTool>搜索</SearchTool>
 *         </View>
 *     )
 * }
 *
 * export default createTUIApp({
 *     name: 'HelpCenter',
 *     component: HelpCenter
 * })
 * ```
 */

// ─────────────────────────────────────────────────────────────
//  Components
// ─────────────────────────────────────────────────────────────

export { View } from "./components/index.js";
export type { ViewProps } from "./components/index.js";

// Tool Params (SSOT in operation/)
export { defineParams } from "./operation/defineParams.js";
export type {
  OperationResult,
  OperationError,
  ParamDef,
  ParamSchema,
  ParamType,
  ParamBaseType,
  ParamConstraints,
  InferArgs,
} from "./operation/types.js";

// ─────────────────────────────────────────────────────────────
//  Hooks
// ─────────────────────────────────────────────────────────────

export {
  // Preact hooks (re-exported to avoid multi-instance issues)
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useReducer,
  // AOTUI hooks
  useViewContext,
  useMountableViewRegistry,
  useRefRegistry,
  useDynamicViewRegistry,
  // [C2] Reactive Store
  useSignalStore,
  // [Configuration Injection] App Config Hooks
  useAppConfig,
  useAppEnv,
  // [Persistence]
  usePersistentState,
  persistenceManager,
  // [RFC-002] Resource Reference Hooks
  useDataRef,
  useResourceRef,
  useArrayRef,
  // [RFC-003] Operation Hooks
  useViewTypeTool,  // View Type Tool Aggregation
  // [RFC-011] LLM Output Channel
  useLLMOutputChannel,
  useLLMOutputHistory,
} from "./hooks/index.js";
export type {
  // [RFC-003] Context Types
  IViewMeta,
  IMountableViewRegistry,
  IRefRegistry,
  IAppConfig,
  // [C2] Reactive Store
  SignalStore,
  // [RFC-002] Ref Types
  RefHandle,
  ArrayRefHandle,
  ListRefFormatter,
  ItemRefFormatter,
  TypeToolUI,  // View Type Tool Aggregation
  UseViewTypeToolResult,  // View Type Tool Aggregation
  TypeToolOptions,  // View Type Tool Aggregation
  TypeToolHandler,  // View Type Tool Aggregation
  // [RFC-011]
  ILLMOutputChannelContext,
  LLMOutputChannelOptions,
} from "./hooks/index.js";

// [P0 FIX] Re-export LLM Output Channel types for App developers
export type { LLMOutputEvent, LLMOutputListener } from "@aotui/runtime/spi";
export type { AppReinitializeContext } from "@aotui/runtime/spi";

// ─────────────────────────────────────────────────────────────
//  Adapter (Component Mode Only)
// ─────────────────────────────────────────────────────────────

// [RFC-027] Inline View for component mode
export { createInlineView } from "./adapter/index.js";
export type { InlineViewConfig } from "./adapter/index.js";

// ─────────────────────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────────────────────

export { escapeHtml, escapeJsonForAttr } from "./utils/index.js";
export {
  validateOperationName,
  validateAppId,
  validateViewId,
  validateFunctionName,
  assertValidOperationName,
} from "./utils/validation.js";

// ─────────────────────────────────────────────────────────────
//  [RFC-002] Global Ref Registry - INTERNAL ONLY
// ─────────────────────────────────────────────────────────────
/**
 * @internal
 * 
 * Ref Registry is now managed by AppKernel (runtime/worker-runtime/app-kernel).
 * The global registry functions are no longer exported as public API.
 * 
 * See: AppKernel.exportRefsToIndexMap() for the new implementation.
 */

// [RFC-027] Component-Based App Factory
export {
  createTUIApp,
  type TUIAppConfig,
  type TUIComponentAppFactory
} from './app-factory/createTUIApp.js';

// [RFC-027] App Runtime Context (for component-based apps)
export {
  AppRuntimeContext,
  useAppRuntimeContext,
  type AppRuntimeContextValue,
} from './context/AppRuntimeContext.js';

// ─────────────────────────────────────────────────────────────
//  Factory Utilities (Phase 2 Task 2.2)
// ─────────────────────────────────────────────────────────────

export {
  TUI_FACTORY,
  isFactory,
  isViewFactory,
  isAppFactory,
  createCallableFactory,
} from "./factory/index.js";
export type { Factory, FactoryType } from "./factory/index.js";

// ─────────────────────────────────────────────────────────────
//  Runtime Types Re-export
// ─────────────────────────────────────────────────────────────
/**
 * [P1 FIX] Re-export commonly needed Runtime types.
 *
 * This enables developers to import everything from @aotui/sdk:
 * ```typescript
 * import {
 *     ViewBasedApp,
 *     View, List, Item, Operation,
 *     type AppID, type ViewID, type OperationResult
 * } from '@aotui/sdk';
 * ```
 *
 * For advanced integration (Bridge, LLM tools, Kernel),
 * import directly from @aotui/runtime.
 */
export type {
  // ID Types
  AppID,
  ViewID,
  DesktopID,
  SnapshotID,
  OperationID,
  // App Interface
  IAOTUIApp,
  // View Interfaces
  // Context
  AppContext,
} from "@aotui/runtime/spi";

// Type guard for IViewContextMountable features
export { hasMountableSupport, AOTUIError } from "@aotui/runtime/spi";
