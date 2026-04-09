import { useRuntimeActions, useRuntimeState } from "../react/hooks";

export function useAppState<State>() {
  return {
    state: useRuntimeState((state) => state as State),
  };
}

export function useActions() {
  return useRuntimeActions();
}
