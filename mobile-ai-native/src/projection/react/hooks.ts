import { useSyncExternalStore } from "preact/compat";
import { useAppRuntimeContext } from "./AppRuntimeProvider";
import type { TraceState } from "../../core/types";

export function useAppRuntime() {
  return useAppRuntimeContext();
}

export function useRuntimeState<State, Selected>(
  selector: (state: State) => Selected,
): Selected {
  const runtime = useAppRuntimeContext();
  const getSnapshot = () => selector(runtime.store.getState() as State);

  return useSyncExternalStore(runtime.store.subscribe, getSnapshot);
}

export function useRuntimeActions() {
  return useAppRuntimeContext().actions;
}

export function useRuntimeTrace<Selected>(
  selector: (trace: TraceState) => Selected,
): Selected {
  const runtime = useAppRuntimeContext();
  const getSnapshot = () => selector(runtime.traceStore.getState());

  return useSyncExternalStore(runtime.traceStore.subscribe, getSnapshot);
}
