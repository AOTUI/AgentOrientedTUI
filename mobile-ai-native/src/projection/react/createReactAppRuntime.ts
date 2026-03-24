import { createActionRuntime } from "../../core/action/createActionRuntime";
import type { ActionDefinition } from "../../core/action/defineAction";
import { createSnapshotBundle } from "../../core/snapshot/createSnapshotBundle";
import { createSnapshotRegistry } from "../../core/snapshot/createSnapshotRegistry";
import { createStore } from "../../core/state/createStore";
import { createTraceStore } from "../../core/trace/createTraceStore";
import type { EffectMap } from "../../core/effect/types";
import type {
  ActionResult,
  SnapshotBundle,
  SnapshotRegistry,
  StateReducer,
  Store,
  ToolDefinition,
  TraceRecord,
  TraceState,
  TraceStore,
} from "../../core/types";
import { createToolBridge } from "../../tool/createToolBridge";

export type ReactAppDefinition<State, Event> = {
  initialState: State;
  reduce: StateReducer<State, Event>;
  actions: Array<ActionDefinition<State, Event, any>>;
  effects?: EffectMap<State, Event>;
  renderCurrentSnapshot?: () => SnapshotBundle;
};

export type ReactAppRuntime<State, Event> = {
  store: Store<State, Event>;
  actionRuntime: ReturnType<typeof createActionRuntime<State, Event>>;
  traceStore: TraceStore;
  trace: RuntimeTrace;
  snapshotRegistry: SnapshotRegistry;
  toolBridge: ReturnType<typeof createToolBridge>;
  actions: {
    callAction(
      name: string,
      input: Record<string, unknown>,
    ): Promise<ActionResult>;
    getVisibleTools(): ToolDefinition[];
  };
};

export type RuntimeTrace = {
  getState(): TraceState;
  getEntries(): TraceRecord[];
  getRecent(): TraceRecord | undefined;
  subscribe(listener: () => void): () => void;
};

export function createReactAppRuntime<State, Event>(
  app: ReactAppDefinition<State, Event>,
): ReactAppRuntime<State, Event> {
  const store = createStore({
    initialState: app.initialState,
    reduce: app.reduce,
  });
  const traceStore = createTraceStore();

  const actionRuntime = createActionRuntime({
    store,
    actions: app.actions,
    traceStore,
    effects: app.effects,
  });
  const snapshotRegistry = createSnapshotRegistry({ maxEntries: 2 });
  const renderCurrentSnapshot =
    app.renderCurrentSnapshot ??
    (() =>
      createSnapshotBundle({
        tui: "",
        refIndex: {},
        visibleTools: actionRuntime.listVisibleTools(),
      }));

  const toolBridge = createToolBridge({
    actionRuntime,
    snapshotRegistry,
    renderCurrentSnapshot,
  });

  return {
    store,
    actionRuntime,
    traceStore,
    trace: {
      getState() {
        return traceStore.getState();
      },
      getEntries() {
        return traceStore.getState().entries;
      },
      getRecent() {
        return traceStore.getState().recent ?? undefined;
      },
      subscribe(listener) {
        return traceStore.subscribe(listener);
      },
    },
    snapshotRegistry,
    toolBridge,
    actions: {
      callAction(name, input) {
        return actionRuntime.executeAction(name, input);
      },
      getVisibleTools() {
        return actionRuntime.listVisibleTools();
      },
    },
  };
}
