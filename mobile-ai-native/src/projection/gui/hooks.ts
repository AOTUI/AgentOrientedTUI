import { useAppContext } from "./AppProvider";

export function useAppState<State>() {
  const { store } = useAppContext();

  return {
    state: store.getState() as State,
  };
}

export function useActions() {
  const { actionRuntime } = useAppContext();

  return {
    callAction(name: string, input: Record<string, unknown>) {
      return actionRuntime.executeAction(name, input);
    },
    getVisibleTools() {
      return actionRuntime.listVisibleTools();
    },
  };
}
