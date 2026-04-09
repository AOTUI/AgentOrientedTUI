import type {
  StateReducer,
  Store,
  StoreListener,
  StoreUnsubscribe,
} from "../types";

export function createStore<State, Event>(config: {
  initialState: State;
  reduce: StateReducer<State, Event>;
}): Store<State, Event> {
  let state = config.initialState;
  const listeners = new Set<StoreListener>();

  return {
    getState() {
      return state;
    },
    emit(event: Event) {
      state = config.reduce(state, event);
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: StoreListener): StoreUnsubscribe {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
  };
}
