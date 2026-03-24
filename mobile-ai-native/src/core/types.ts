import type { ZodTypeAny } from "zod";

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
  inputSchema: ZodTypeAny;
  meta: ToolMetadata;
};

export type SnapshotBundle = {
  readonly snapshotId: string;
  readonly generatedAt: number;
  readonly tui: string;
  readonly refIndex: Record<string, RefIndexEntry>;
  readonly visibleTools: readonly ToolDefinition[];
};

export type SnapshotStatus = "active" | "stale";

export type SnapshotRegistryEntry = {
  snapshot: SnapshotBundle;
  status: SnapshotStatus;
};

export type SnapshotRegistry = {
  create(snapshot: SnapshotBundle): SnapshotBundle;
  lookup(snapshotId: string): SnapshotRegistryEntry | undefined;
  markStale(snapshotId: string): void;
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
