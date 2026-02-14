import { signal, effect } from "@preact/signals";
import { useMemo, useState, useEffect } from "./preact-hooks.js";

export interface SignalStore<T> {
  readonly value: T;
  set: (update: T | ((prev: T) => T)) => void;
}

/**
 * A simple state container using Signals for reactivity.
 *
 * @param initialState Initial state object
 * @returns Object with .value getter (reactive) and .set method
 */
export function useSignalStore<T>(initialState: T): SignalStore<T> {
  const s = useMemo(() => signal(initialState), []);

  // Force re-render on signal change to ensure component updates
  // (This is a safety net if signal auto-tracking isn't fully enabled in the environment)
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    return effect(() => {
      // Access value to track dependency
      const _ = s.value;
      forceUpdate((n) => n + 1);
    });
  }, [s]);

  return useMemo(
    () => ({
      get value() {
        return s.value;
      },
      set: (update: T | ((prev: T) => T)) => {
        if (typeof update === "function") {
          s.value = (update as (prev: T) => T)(s.value);
        } else {
          s.value = update;
        }
      },
    }),
    [s],
  );
}
