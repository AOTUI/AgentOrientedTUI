/**
 * AOTUI SDK Hooks
 *
 * React-style hooks for AOTUI View development
 *
 * [重要] 应用开发者必须从 SDK 导入这些 hooks，而不是直接从 preact/hooks 导入。
 * 这确保所有 hooks 使用同一个 Preact 实例，避免多实例冲突。
 *
 * [C2 Architecture] useSignalStore 用于响应式数据管理
 * [RFC-002] useDataRef, useArrayRef 用于资源引用系统
 */

// Re-export Preact hooks to ensure single Preact instance
export {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useReducer,
} from "preact/hooks";

export {
  type IViewMeta,
  type IMountableViewRegistry,
  type IRefRegistry,
  type IAppConfig,
} from "../contexts/index.js";

export {
  ViewRuntimeContext,
  type ViewRuntimeContextValue,
} from "../contexts/view-runtime-context.js";

export { useViewSelector, useViewRuntimeContext } from "./use-view-selector.js";

// AOTUI Hooks
export {
  useViewContext,
  useMountableViewRegistry,
  useRefRegistry,
  useDynamicViewRegistry,
} from "./useViewContext.js";

// [C2] Reactive Store Hook
export { useSignalStore, type SignalStore } from "./useSignalStore.js";

// [Configuration Injection] App Config Hooks
export { useAppConfig, useAppEnv } from "./useAppConfig.js";

// [Persistence] App state persistence
export { usePersistentState } from "./usePersistentState.js";
export { persistenceManager } from "./persistence-manager.js";

// Primary data-ref hook (preferred): useDataRef
// Backward-compatible alias: useResourceRef
export { useDataRef, useRef as useResourceRef, type RefHandle } from "./useRef.js";
export {
  useArrayRef,
  type ArrayRefHandle,
  type ListRefFormatter,
  type ItemRefFormatter,
} from "./useArrayRef.js";

// Also export RegisterLinkOptions from contexts
export { type RegisterLinkOptions } from "../contexts/index.js";

// [RFC-011] LLM Output Channel Hooks
export {
  useLLMOutputChannel,
  useLLMOutputHistory,
  type LLMOutputChannelOptions,
} from "./useLLMOutputChannel.js";

// [RFC-011] LLM Output Channel Context Type
export { type ILLMOutputChannelContext } from "../contexts/view-runtime-context.js";

// [View Type Aggregation] Type-level Tool Hook
export {
  useViewTypeTool,
  type TypeToolOptions,
  type TypeToolHandler,
  type TypeToolUI,
  type TypeToolUIProps,
  type UseViewTypeToolResult,
} from "./useViewTypeTool.js";
