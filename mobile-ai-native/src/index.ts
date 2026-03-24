export const VERSION = "0.0.0";

export { createStore } from "./core/state/createStore";
export { createSnapshotBundle } from "./core/snapshot/createSnapshotBundle";
export type {
  EffectContext,
  EffectFailure,
  EffectHandler,
  EffectMap,
  EffectResult,
  EffectSuccess,
  EffectTrace,
} from "./core/effect/types";
export { defineAction } from "./core/action/defineAction";
export { createActionRuntime } from "./core/action/createActionRuntime";
export { createToolBridge } from "./tool/createToolBridge";
export { useDataRef } from "./ref/useDataRef";
export { useArrayRef } from "./ref/useArrayRef";
export { renderTUI } from "./projection/tui/renderTUI";
export { createReactAppRuntime } from "./projection/react/createReactAppRuntime";
export { AppRuntimeProvider } from "./projection/react/AppRuntimeProvider";
export { useAppRuntime, useRuntimeActions, useRuntimeState, useRuntimeTrace } from "./projection/react/hooks";
export { AppProvider } from "./projection/gui/AppProvider";
export { useAppState, useActions } from "./projection/gui/hooks";
export { createInboxApp } from "./demo/inbox/createInboxApp";
