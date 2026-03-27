import { createSnapshotBundle } from "./core/snapshot/createSnapshotBundle";
import { VERSION } from "./version";

export { VERSION };

export { createStore } from "./core/state/createStore";
export { createSnapshotBundle };
export type {
  RefIndexEntry,
  MountedViewDescriptor,
  SnapshotBundle,
  ToolDefinition,
  StaticViewCatalogEntry,
  SnapshotAssemblerInput,
  ViewFragment,
} from "./core/types";
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
export { defineViewTypeTool } from "./core/action/defineViewTypeTool";
export { createActionRuntime } from "./core/action/createActionRuntime";
export { createToolBridge } from "./tool/createToolBridge";
export { useDataRef } from "./ref/useDataRef";
export { useArrayRef } from "./ref/useArrayRef";
export { View } from "./projection/tui/View";
export { createSnapshotAssembler } from "./projection/tui/createSnapshotAssembler";
export { renderTUI } from "./projection/tui/renderTUI";
export { createReactAppRuntime } from "./projection/react/createReactAppRuntime";
export type {
  ReactAppDefinition,
  ReactAppRuntime,
  RuntimeTrace,
} from "./projection/react/createReactAppRuntime";
export { AppRuntimeProvider } from "./projection/react/AppRuntimeProvider";
export { useAppRuntime, useRuntimeActions, useRuntimeState, useRuntimeTrace } from "./projection/react/hooks";
export { AppProvider } from "./projection/gui/AppProvider";
export { useAppState, useActions } from "./projection/gui/hooks";
export { createInboxApp } from "./demo/inbox/createInboxApp";
