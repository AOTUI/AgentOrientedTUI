import { createActionRuntime } from "../../core/action/createActionRuntime";
import type { ActionDefinition } from "../../core/action/defineAction";
import { createSnapshotBundle } from "../../core/snapshot/createSnapshotBundle";
import { createStore } from "../../core/state/createStore";
import type {
  ActionResult,
  SnapshotBundle,
  StateReducer,
  Store,
} from "../../core/types";
import { createToolBridge } from "../../tool/createToolBridge";

type EffectMap<State, Event> = Record<
  string,
  (
    ctx: { getState(): State; emit(event: Event): void },
    input: unknown,
  ) => Promise<void> | void
>;

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
  traceStore: {
    getState(): { entries: string[] };
    subscribe(listener: () => void): () => void;
  };
  snapshotRegistry: {
    get(snapshotId: string): SnapshotBundle | undefined;
    set(snapshot: SnapshotBundle): void;
    clear(): void;
  };
  toolBridge: ReturnType<typeof createToolBridge>;
  actions: {
    callAction(
      name: string,
      input: Record<string, unknown>,
    ): Promise<ActionResult>;
    getVisibleTools(): Array<{ name: string; description: string }>;
  };
};

function createTraceStore() {
  return {
    getState() {
      return { entries: [] };
    },
    subscribe() {
      return () => {};
    },
  };
}

function createSnapshotRegistry() {
  const snapshots = new Map<string, SnapshotBundle>();

  return {
    get(snapshotId: string) {
      return snapshots.get(snapshotId);
    },
    set(snapshot: SnapshotBundle) {
      snapshots.set(snapshot.snapshotId, snapshot);
    },
    clear() {
      snapshots.clear();
    },
  };
}

export function createReactAppRuntime<State, Event>(
  app: ReactAppDefinition<State, Event>,
): ReactAppRuntime<State, Event> {
  const store = createStore({
    initialState: app.initialState,
    reduce: app.reduce,
  });

  const actionRuntime = createActionRuntime({
    store,
    actions: app.actions,
    effects: app.effects,
  });
  const traceStore = createTraceStore();
  const snapshotRegistry = createSnapshotRegistry();
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
    renderCurrentSnapshot() {
      const snapshot = renderCurrentSnapshot();
      snapshotRegistry.set(snapshot);
      return snapshot;
    },
  });

  return {
    store,
    actionRuntime,
    traceStore,
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
