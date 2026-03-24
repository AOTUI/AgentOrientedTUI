/** @jsxImportSource preact */
import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { ComponentChildren } from "preact";

type AppContextValue = {
  store: {
    getState(): unknown;
  };
  actionRuntime: {
    executeAction(name: string, input: Record<string, unknown>): Promise<unknown>;
    listVisibleTools(): Array<{ name: string; description: string }>;
  };
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider(props: {
  store: AppContextValue["store"];
  actionRuntime: AppContextValue["actionRuntime"];
  children: ComponentChildren;
}) {
  return (
    <AppContext.Provider
      value={{ store: props.store, actionRuntime: props.actionRuntime }}
    >
      {props.children}
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
