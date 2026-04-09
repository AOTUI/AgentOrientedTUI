import type { ComponentChild } from "preact";
import type { ZodTypeAny } from "zod";
export type {
  TraceRecord,
  TraceState,
  TraceStatus,
  TraceStore,
} from "./trace/types";

export type StateReducer<State, Event> = (state: State, event: Event) => State;

export type StoreListener = () => void;
export type StoreUnsubscribe = () => void;

export type Store<State, Event> = {
  getState(): State;
  emit(event: Event): void;
  subscribe(listener: StoreListener): StoreUnsubscribe;
};

export type RefIndexEntry = {
  readonly type: string;
  readonly value: unknown;
};

export type ToolMetadata = Readonly<Record<string, unknown>>;

export type ToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ZodTypeAny;
  readonly meta: ToolMetadata;
  readonly viewType?: string;
};

export type ViewTypeToolDefinition = ToolDefinition & {
  readonly viewType: string;
};

export type ViewFragment = {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly markup: string;
};

export type StaticViewCatalogEntry = {
  readonly type: string;
  readonly description: string;
  readonly enterFrom?: readonly string[];
  readonly actions: readonly string[];
};

export type MountedViewDescriptor<State = unknown> = {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly render: (state: State) => ComponentChild;
};

export type SnapshotAssemblerInput<State = unknown> = {
  readonly rootView: ViewFragment;
  readonly mountedViews: readonly ViewFragment[];
  readonly refIndex: Readonly<Record<string, RefIndexEntry>>;
  readonly visibleTools: readonly ToolDefinition[];
  readonly tui?: string;
};

export type SnapshotBundle = {
  readonly snapshotId: string;
  readonly generatedAt: number;
  readonly markup: string;
  readonly views: readonly ViewFragment[];
  readonly tui: string;
  readonly refIndex: Readonly<Record<string, RefIndexEntry>>;
  readonly visibleTools: readonly ToolDefinition[];
};

export type SnapshotStatus = "active" | "stale";

export type SnapshotRegistryEntry = {
  readonly snapshot: SnapshotBundle;
  readonly status: SnapshotStatus;
};

export type SnapshotRegistry = {
  create(snapshot: SnapshotBundle): SnapshotBundle;
  lookup(snapshotId: string): SnapshotRegistryEntry | undefined;
  markStale(snapshotId: string): void;
  markAllStale?(): void;
};

export type ActionResult<T = unknown> = {
  success: boolean;
  mutated?: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};
