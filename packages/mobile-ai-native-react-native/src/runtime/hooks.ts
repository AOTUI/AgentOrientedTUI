import { useSyncExternalStore } from "react";
import type { SnapshotBundle, TraceState } from "@aotui/mobile-ai-native";
import { useAppRuntimeContext } from "./AppRuntimeProvider";

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

export function useRuntimeSnapshot<Selected>(
  selector: (snapshot: SnapshotBundle) => Selected,
): Selected {
  const runtime = useAppRuntimeContext();
  const getSnapshot = () => selector(runtime.toolBridge.getSnapshotBundle());

  return useSyncExternalStore(runtime.store.subscribe, getSnapshot);
}
