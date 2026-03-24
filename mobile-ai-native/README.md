# @aotui/mobile-ai-native

This package is the hardened runtime core for building Agent Native mobile apps.

It now includes the React / React Native host adapter, reactive runtime hooks, tool metadata, snapshot invalidation, and trace/effect lifecycle contracts needed for a real mobile host.

It proves the framework loop end to end:

`State -> SnapshotBundle -> Tool Call(ref_id + snapshotId) -> Action -> Event/Effect -> State -> GUI/TUI refresh`

If you want a practical build guide for a real iOS app, read [GUIDE.md](./GUIDE.md).

## What This Slice Proves

- one shared state system drives both GUI and TUI
- React-family hosts consume state through `createReactAppRuntime`, `AppRuntimeProvider`, `useRuntimeState`, `useRuntimeActions`, and `useRuntimeTrace`
- TUI is handwritten and can expose semantic refs with `useDataRef` and `useArrayRef`
- the framework builds one atomic `SnapshotBundle`
- tools execute against the exact `snapshotId` the LLM saw
- `refIndex` stores serializable snapshot payloads, not live object references
- tool definitions carry `inputSchema` and `meta`
- mutated tool results stale the originating snapshot, even when the result is a recoverable failure
- trace entries record the action lifecycle: `started`, `updated`, `succeeded`, and `failed`

## Core Contract

The LLM does not operate on guessed ids.
It sees semantic markers like:

```text
(Welcome back)[message:messages[0]]
```

Then it calls a tool with:

```ts
await bridge.executeTool("openMessage", { message: "messages[0]" }, snapshotId);
```

The runtime resolves that `ref_id` from the `SnapshotBundle.refIndex` for the same `snapshotId`.

The React host adapter path is:

- `createReactAppRuntime()` owns the store, action runtime, snapshot registry, trace store, and tool bridge
- `AppRuntimeProvider` publishes that runtime through context
- `useRuntimeState(selector)` subscribes to store updates with `useSyncExternalStore`
- `useRuntimeTrace(selector)` subscribes to the trace store the same way

That means GUI consumers react to state and trace changes without pulling the whole runtime object into component state.

## Ref APIs

### `useDataRef`

Use for a single object:

```tsx
const pinnedRef = useDataRef("message", message, "messages[0]");
<text>{pinnedRef("Pinned message")}</text>;
```

### `useArrayRef`

Use for an array:

```tsx
const [listRef, itemRef] = useArrayRef("message", messages, "messages");
<text>{listRef("Inbox messages")}</text>;
<item>{itemRef(0, "Welcome back")}</item>;
```

## SnapshotBundle

The LLM-facing read model is:

```ts
type SnapshotBundle = {
  snapshotId: string;
  generatedAt: number;
  tui: string;
  refIndex: Record<string, { type: string; value: unknown }>;
  visibleTools: ToolDefinition[];
};
```

This is intentionally atomic:

- `tui`
- `visibleTools`
- `refIndex`

must all come from the same render tick.

Tool definitions are part of that same snapshot and now include:

- `name`
- `description`
- `inputSchema` as a Zod schema
- `meta` for host/app-specific hints

## Why `refIndex` Stores Serializable Payloads

Screens can change after the LLM reads them.
Live object references may already be gone.

So `refIndex` stores serializable snapshot payloads.
When the LLM later calls a tool, the framework reconstructs the action input from the payload attached to that `snapshotId`.

## Current Status

This package is the core, not the full app shell.

What it gives you today:

- shared state core
- semantic refs with `useDataRef` and `useArrayRef`
- atomic `SnapshotBundle`
- snapshot-scoped tool execution
- a React-family host adapter with reactive hooks
- structured trace and effect contracts
- a working inbox vertical slice

What you still need for a production iOS app:

- real GUI components
- model orchestration and networking
- product-level trace UI and persistence

## Current Demo

The inbox demo exposes:

- `openMessage`
- `searchMessages`

and proves that GUI and TUI both refresh from the same state after tool execution.

## Runtime Boundaries

Keep the framework and app responsibilities separated:

- framework owns the store, action runtime, snapshot registry, trace runtime, tool bridge, and host adapter
- business apps own state shape, domain actions, handwritten TUI, and app-specific effect behavior
- actions can read state, emit events, run effects, and update trace summaries
- effects can read state, emit events, and report structured success or failure, but they do not write state directly
