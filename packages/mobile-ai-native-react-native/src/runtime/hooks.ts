import { useSyncExternalStore } from "react";
import type { SnapshotBundle, TraceState } from "@aotui/mobile-ai-native";
import { useAppRuntimeContext } from "./AppRuntimeProvider";

export function useRuntimeState<State, Selected>(
  selector: (state: State) => Selected,
): Selected {
  const runtime = useAppRuntimeContext();
  const getSnapshot = () => selector(runtime.state.getState() as State);

  return useSyncExternalStore(runtime.state.subscribe, getSnapshot);
}

export function useRuntimeActions() {
  return useAppRuntimeContext().actions as ReturnType<
    typeof useAppRuntimeContext
  >["actions"];
}

export function useRuntimeTrace<Selected>(
  selector: (trace: TraceState) => Selected,
): Selected {
  const runtime = useAppRuntimeContext();
  const getSnapshot = () => selector(runtime.trace.getState());

  return useSyncExternalStore(runtime.trace.subscribe, getSnapshot);
}

export function useRuntimeSnapshot<Selected>(
  selector: (snapshot: SnapshotBundle) => Selected,
): Selected {
  const runtime = useAppRuntimeContext();
  const getSnapshot = () => selector(runtime.snapshot.getSnapshot());

  return useSyncExternalStore(runtime.snapshot.subscribe, getSnapshot);
}
