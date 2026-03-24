export type StateReducer<State, Event> = (state: State, event: Event) => State;

export type Store<State, Event> = {
  getState(): State;
  emit(event: Event): void;
  subscribe(listener: () => void): () => void;
};
