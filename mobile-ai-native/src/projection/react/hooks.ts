import { useEffect, useRef, useState } from "preact/hooks";
import { useAppRuntimeContext } from "./AppRuntimeProvider";

export function useAppRuntime() {
  return useAppRuntimeContext();
}

export function useRuntimeState<State, Selected>(
  selector: (state: State) => Selected,
): Selected {
  const runtime = useAppRuntimeContext();
  const selectorRef = useRef(selector);
  selectorRef.current = selector;
  const [selected, setSelected] = useState(() =>
    selector(runtime.store.getState() as State),
  );

  useEffect(() => {
    function updateSelected() {
      setSelected(selectorRef.current(runtime.store.getState() as State));
    }

    updateSelected();
    return runtime.store.subscribe(updateSelected);
  }, [runtime]);

  return selected;
}

export function useRuntimeActions() {
  return useAppRuntimeContext().actions;
}
