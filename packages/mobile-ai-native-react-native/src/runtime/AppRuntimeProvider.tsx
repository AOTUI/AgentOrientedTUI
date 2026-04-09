import {
  createContext,
  createElement,
  useContext,
  type ReactNode,
} from "react";
import type { ReactNativeAppRuntime } from "./createReactNativeAppRuntime";

export type AppRuntime<State = unknown, Event = unknown> =
  ReactNativeAppRuntime<State, Event>;

const AppRuntimeContext = createContext<AppRuntime | null>(null);

export function AppRuntimeProvider(props: {
  runtime: AppRuntime;
  children?: ReactNode;
}) {
  return createElement(
    AppRuntimeContext.Provider,
    { value: props.runtime },
    props.children,
  );
}

export function useAppRuntimeContext() {
  const runtime = useContext(AppRuntimeContext);
  if (!runtime) {
    throw new Error("AppRuntimeProvider is missing from the component tree");
  }

  return runtime;
}
