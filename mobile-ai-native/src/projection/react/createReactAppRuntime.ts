import { createActionRuntime } from "../../core/action/createActionRuntime";
import type { ActionDefinition } from "../../core/action/defineAction";
import { createSnapshotBundle } from "../../core/snapshot/createSnapshotBundle";
import { createSnapshotRegistry } from "../../core/snapshot/createSnapshotRegistry";
import { createStore } from "../../core/state/createStore";
import { createTraceStore } from "../../core/trace/createTraceStore";
import { createSnapshotAssembler } from "../tui/createSnapshotAssembler";
import { renderViewFragment } from "../tui/renderViewFragment";
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
  getRelevantViewTypes?: (state: State) => readonly string[];
  renderCurrentSnapshot?: (context: {
    state: State;
    visibleTools: readonly ToolDefinition[];
  }) => SnapshotBundle;
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
  const getRelevantViewTypes = app.getRelevantViewTypes;

  const actionRuntime = createActionRuntime({
    store,
    actions: app.actions,
    traceStore,
    effects: app.effects,
    getRelevantViewTypes: getRelevantViewTypes
      ? () => getRelevantViewTypes(store.getState())
      : undefined,
  });
  const snapshotRegistry = createSnapshotRegistry({ maxEntries: 2 });
  const renderCurrentSnapshot =
    app.renderCurrentSnapshot ??
    (() =>
      createSnapshotAssembler({
        rootView: renderViewFragment({
          id: "root",
          type: "Root",
          name: "Navigation",
          children: "No custom snapshot renderer configured.",
        }),
        mountedViews: [],
        refIndex: {},
        visibleTools: actionRuntime.listVisibleTools(),
      }));

  const toolBridge = createToolBridge({
    actionRuntime,
    snapshotRegistry,
    renderCurrentSnapshot() {
      return renderCurrentSnapshot({
        state: store.getState(),
        visibleTools: actionRuntime.listVisibleTools(),
      });
    },
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
      async callAction(name, input) {
        const result = await actionRuntime.executeAction(name, input);
        if (result.mutated) {
          snapshotRegistry.markAllStale?.();
        }

        return result;
      },
      getVisibleTools() {
        return actionRuntime.listVisibleTools();
      },
    },
  };
}
