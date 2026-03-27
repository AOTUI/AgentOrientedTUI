import {
  createReactAppRuntime,
  type ReactAppDefinition,
  type RuntimeTrace,
  type SnapshotBundle,
} from "@aotui/mobile-ai-native";

export type ReactNativeAppDefinition<State, Event> = ReactAppDefinition<
  State,
  Event
>;

export type ReactNativeAppRuntime<State, Event> = {
  actions: {
    callAction(
      name: string,
      input: Record<string, unknown>,
    ): ReturnType<
      ReturnType<typeof createReactAppRuntime<State, Event>>["actions"]["callAction"]
    >;
    getVisibleTools(): ReturnType<
      ReturnType<typeof createReactAppRuntime<State, Event>>["actions"]["getVisibleTools"]
    >;
  };
  state: {
    getState(): State;
    subscribe(listener: () => void): () => void;
  };
  trace: RuntimeTrace;
  snapshot: {
    getSnapshot(): SnapshotBundle;
    subscribe(listener: () => void): () => void;
  };
};

export function createReactNativeAppRuntime<State, Event>(
  app: ReactNativeAppDefinition<State, Event>,
): ReactNativeAppRuntime<State, Event> {
  const coreRuntime = createReactAppRuntime(app);
  let currentSnapshot = coreRuntime.toolBridge.getSnapshotBundle();
  const snapshotListeners = new Set<() => void>();

  const emitSnapshot = () => {
    for (const listener of snapshotListeners) {
      listener();
    }
  };

  const refreshSnapshot = () => {
    currentSnapshot = coreRuntime.toolBridge.getSnapshotBundle();
    emitSnapshot();
  };

  coreRuntime.store.subscribe(() => {
    refreshSnapshot();
  });

  return {
    actions: {
      callAction(name, input) {
        return coreRuntime.actions.callAction(name, input);
      },
      getVisibleTools() {
        return coreRuntime.actions.getVisibleTools();
      },
    },
    state: {
      getState() {
        return coreRuntime.store.getState() as State;
      },
      subscribe(listener) {
        return coreRuntime.store.subscribe(listener);
      },
    },
    trace: coreRuntime.trace,
    snapshot: {
      getSnapshot() {
        return currentSnapshot;
      },
      subscribe(listener) {
        snapshotListeners.add(listener);
        return () => {
          snapshotListeners.delete(listener);
        };
      },
    },
  };
}
