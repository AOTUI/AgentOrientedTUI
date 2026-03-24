/** @jsxImportSource preact */
import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { ActionResult, Store, ToolDefinition } from "../../core/types";
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
  return {
    store: value.store,
    actionRuntime: value.actionRuntime,
    traceStore: {
      getState() {
        return { entries: [] };
      },
      subscribe() {
        return () => {};
      },
    },
    snapshotRegistry: {
      get() {
        return undefined;
      },
      set() {},
      clear() {},
    },
    toolBridge: {
      listTools() {
        return value.actionRuntime.listVisibleTools();
      },
      getSnapshotBundle() {
        throw new Error("Snapshot rendering is not available through AppProvider");
      },
      executeTool(
        name: string,
        input: Record<string, unknown>,
        _snapshotId: string,
      ) {
        return value.actionRuntime.executeAction(name, input);
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
  const value = { store: props.store, actionRuntime: props.actionRuntime };

  return (
    <AppContext.Provider value={value}>
      <AppRuntimeProvider runtime={createCompatibilityRuntime(value)}>
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
