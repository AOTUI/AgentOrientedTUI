import { useSyncExternalStore } from "react";
import type { HostLifecycleBridge, HostLifecycleState } from "./host-lifecycle";

export type RuntimeHostLifecycle = {
  state: HostLifecycleState;
  setAppActive(): void;
  setAppBackground(): void;
  focusScreen(): void;
  blurScreen(): void;
};

export function useRuntimeHostLifecycle(
  bridge: HostLifecycleBridge,
): RuntimeHostLifecycle {
  const state = useSyncExternalStore(
    bridge.subscribe,
    bridge.getState,
    bridge.getState,
  );

  return {
    state,
    setAppActive: bridge.setAppActive,
    setAppBackground: bridge.setAppBackground,
    focusScreen: bridge.focusScreen,
    blurScreen: bridge.blurScreen,
  };
}
