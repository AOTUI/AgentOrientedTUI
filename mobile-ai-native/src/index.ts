export const VERSION = "0.0.0";

export { createStore } from "./core/state/createStore";
export { createSnapshotBundle } from "./core/snapshot/createSnapshotBundle";
export { defineAction } from "./core/action/defineAction";
export { createActionRuntime } from "./core/action/createActionRuntime";
export { createToolBridge } from "./tool/createToolBridge";
export { useDataRef } from "./ref/useDataRef";
export { useArrayRef } from "./ref/useArrayRef";
export { renderTUI } from "./projection/tui/renderTUI";
export { createInboxApp } from "./demo/inbox/createInboxApp";
