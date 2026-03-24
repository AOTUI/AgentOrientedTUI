import { useEffect, useState } from "preact/hooks";
import { useAppRuntimeContext } from "./AppRuntimeProvider";

export function useAppRuntime() {
  return useAppRuntimeContext();
}

export function useRuntimeState<State, Selected>(
  selector: (state: State) => Selected,
): Selected {
  const runtime = useAppRuntimeContext();
  const [, setVersion] = useState(0);

  useEffect(() => {
    return runtime.store.subscribe(() => {
      setVersion((version) => version + 1);
    });
  }, [runtime]);

  return selector(runtime.store.getState() as State);
}

export function useRuntimeActions() {
  return useAppRuntimeContext().actions;
}
