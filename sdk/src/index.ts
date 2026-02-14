/**
 * @aotui/sdk - AOTUI Developer SDK
 *
 * Build Agent-Oriented TUI Apps with Preact
 *
 * @example Type-Safe Operation API
 * @example Type-Safe Operation API
 * ```tsx
 * import { View, useArrayRef, Operation, createTUIApp, useState } from '@aotui/sdk'
 *
 * function HelpCenter() {
 *     const [articles, setArticles] = useState([])
 *     // Use useArrayRef for semantic lists
 *     const [listRef, itemRef] = useArrayRef('articles', articles, { itemType: 'article' })
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
 *             <Operation
 *                 name="search"
 *                 description="搜索文章"
 *                 params={{
 *                     keyword: { type: 'string', required: true, desc: '搜索关键词' }
 *                 }}
 *                 onExecute={async (args) => {
 *                     // args.keyword 自动推断为 string
 *                     console.log('Searching:', args.keyword)
 *                     return { success: true }
 *                 }}
 *             >
 *                 搜索
 *             </Operation>
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

// [Phase 2] Reactive Router
export { Router, Route, useRouter, useNavigate, useLocation, useParams } from "./router/index.js";
export type { RouterProps, RouteProps, Location, Navigator } from "./router/index.js";

// [Phase 2] Layout Kit
export { SplitPane, Box } from "./components/layout/index.js";
export type { SplitPaneProps, BoxProps } from "./components/layout/index.js";

// Operation Component (v3 - Type Safe)
// [SSOT] Types are now defined in operation/types.ts
export { Operation, defineParams } from "./components/index.js";
export type {
  OperationProps,
  OperationHandler,
  OperationResult,
  OperationError,
  // [P0 FIX] New name for handler context
  OperationHandlerContext,
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
  // [RFC-003] Specialized Registry Hooks
  useOperationRegistry,
  useMountableViewRegistry,
  useRefRegistry,
  useDynamicViewRegistry,
  // [RFC-003] Independent Contexts
  ViewMetaContext,
  OperationRegistryContext,
  MountableViewRegistryContext,
  RefRegistryContext,
  AppConfigContext,
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
  useAppOperation,
  TUIAppContext,
  // [RFC-011] LLM Output Channel
  useLLMOutputChannel,
  useLLMOutputHistory,
  // [Milestone 1] System Event Hook
  useExternalEvent,
} from "./hooks/index.js";
export type {
  // [RFC-003] Context Types
  IViewMeta,
  IOperationRegistry,
  IMountableViewRegistry,
  IRefRegistry,
  IAppConfig,
  // [P1 FIX] SimpleOperationHandler is internal, not exported at top level
  // Use OperationHandler from components for public API
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
  AppOperationOptions,
  AppOperationUI,
  AppOperationUIProps,
  UseAppOperationResult,
  AppContextValue,
  IAppOperationRegistry,
  // [RFC-011]
  ILLMOutputChannelContext,
  LLMOutputChannelOptions,
} from "./hooks/index.js";

// [P0 FIX] Re-export LLM Output Channel types for App developers
export type { LLMOutputEvent, LLMOutputListener } from "@aotui/runtime/spi";

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
