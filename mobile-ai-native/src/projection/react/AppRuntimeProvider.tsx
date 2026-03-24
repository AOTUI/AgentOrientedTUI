/** @jsxImportSource preact */
import { createContext } from "preact";
import type { ComponentChildren } from "preact";
import { useContext } from "preact/hooks";
import type { ReactAppRuntime } from "./createReactAppRuntime";

export type AppRuntime<State = unknown, Event = unknown> = ReactAppRuntime<
  State,
  Event
>;

const AppRuntimeContext = createContext<AppRuntime | null>(null);

export function AppRuntimeProvider(props: {
  runtime: AppRuntime;
  children: ComponentChildren;
}) {
  return (
    <AppRuntimeContext.Provider value={props.runtime}>
      {props.children}
    </AppRuntimeContext.Provider>
  );
}

export function useAppRuntimeContext() {
  const runtime = useContext(AppRuntimeContext);
  if (!runtime) {
    throw new Error("AppRuntimeProvider is missing from the component tree");
  }

  return runtime;
}
