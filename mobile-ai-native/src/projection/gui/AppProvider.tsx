/** @jsxImportSource preact */
import { createContext } from "preact";
import { useContext, useMemo } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type {
  ActionResult,
  SnapshotBundle,
  Store,
  ToolDefinition,
} from "../../core/types";
import { AppRuntimeProvider, type AppRuntime } from "../react/AppRuntimeProvider";

type LegacyAppContextValue = {
  store: Store<unknown, unknown>;
  actionRuntime: {
    executeAction(
      name: string,
      input: Record<string, unknown>,
    ): Promise<ActionResult>;
    listVisibleTools(): ToolDefinition[];
  };
};

const AppContext = createContext<LegacyAppContextValue | null>(null);

function createCompatibilityRuntime(
  value: LegacyAppContextValue,
): AppRuntime<unknown, unknown> {
  let nextTraceId = 1;

  return {
    store: value.store,
    actionRuntime: value.actionRuntime,
    traceStore: {
      getState() {
        return {
          entries: [],
          recent: null,
        };
      },
      subscribe() {
        return () => {};
      },
      record(entry) {
        return {
          id: `compat_trace_${nextTraceId++}`,
          actionName: entry.actionName,
          status: entry.status,
          summary: entry.summary,
          recordedAt: Date.now(),
        };
      },
    },
    snapshotRegistry: {
      create(snapshot: SnapshotBundle) {
        return snapshot;
      },
      lookup() {
        return undefined;
      },
      markStale() {},
    },
    toolBridge: {
      listTools() {
        return value.actionRuntime.listVisibleTools();
      },
      getSnapshotBundle() {
        throw new Error("Snapshot rendering is not available through AppProvider");
      },
      executeTool(
        _name: string,
        _input: Record<string, unknown>,
        _snapshotId: string,
      ) {
        return Promise.reject(
          new Error(
            "Snapshot-scoped tool execution is not available through AppProvider",
          ),
        );
      },
    },
    actions: {
      callAction(name: string, input: Record<string, unknown>) {
        return value.actionRuntime.executeAction(name, input);
      },
      getVisibleTools() {
        return value.actionRuntime.listVisibleTools();
      },
    },
  };
}

export function AppProvider(props: {
  store: LegacyAppContextValue["store"];
  actionRuntime: LegacyAppContextValue["actionRuntime"];
  children: ComponentChildren;
}) {
  const value = useMemo(
    () => ({ store: props.store, actionRuntime: props.actionRuntime }),
    [props.store, props.actionRuntime],
  );
  const runtime = useMemo(() => createCompatibilityRuntime(value), [value]);

  return (
    <AppContext.Provider value={value}>
      <AppRuntimeProvider runtime={runtime}>
        {props.children}
      </AppRuntimeProvider>
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within AppProvider");
  }

  return context;
}
