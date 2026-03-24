export type StateReducer<State, Event> = (state: State, event: Event) => State;

export type Store<State, Event> = {
  getState(): State;
  emit(event: Event): void;
  subscribe(listener: () => void): () => void;
};

export type RefIndexEntry = {
  type: string;
  value: unknown;
};

export type ToolDefinition = {
  name: string;
  description: string;
};

export type SnapshotBundle = {
  snapshotId: string;
  generatedAt: number;
  tui: string;
  refIndex: Record<string, RefIndexEntry>;
  visibleTools: ToolDefinition[];
};
