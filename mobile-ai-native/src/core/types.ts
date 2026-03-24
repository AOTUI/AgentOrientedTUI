export type StateReducer<State, Event> = (state: State, event: Event) => State;

export type StoreListener = () => void;
export type StoreUnsubscribe = () => void;

export type Store<State, Event> = {
  getState(): State;
  emit(event: Event): void;
  subscribe(listener: StoreListener): StoreUnsubscribe;
};

export type RefIndexEntry = {
  type: string;
  value: unknown;
};

export type ToolMetadata = Record<string, unknown>;

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: unknown;
  meta: ToolMetadata;
};

export type SnapshotBundle = {
  snapshotId: string;
  generatedAt: number;
  tui: string;
  refIndex: Record<string, RefIndexEntry>;
  visibleTools: ToolDefinition[];
};

export type ActionResult<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};
