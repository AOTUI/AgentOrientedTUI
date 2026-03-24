import { useSyncExternalStore } from "preact/compat";
import { useAppRuntimeContext } from "./AppRuntimeProvider";

export function useAppRuntime() {
  return useAppRuntimeContext();
}

export function useRuntimeState<State, Selected>(
  selector: (state: State) => Selected,
): Selected {
  const runtime = useAppRuntimeContext();
  const getSnapshot = () => selector(runtime.store.getState() as State);

  return useSyncExternalStore(runtime.store.subscribe, getSnapshot, getSnapshot);
}

export function useRuntimeActions() {
  return useAppRuntimeContext().actions;
}
