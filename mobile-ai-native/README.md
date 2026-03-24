# @aotui/mobile-ai-native

This package is an alpha host-agnostic core for building Agent Native mobile apps.

It currently proves the smallest end-to-end loop of the framework:

`State -> SnapshotBundle -> Tool Call(ref_id + snapshotId) -> Action -> Event/Effect -> State -> GUI/TUI refresh`

If you want a practical build guide for a real iOS app, read [GUIDE.md](./GUIDE.md).

## What This Slice Proves

- one shared state system drives both GUI and TUI
- TUI is handwritten and can expose semantic refs with `useDataRef` and `useArrayRef`
- the framework builds one atomic `SnapshotBundle`
- tools execute against the exact `snapshotId` the LLM saw
- `refIndex` stores serializable snapshot payloads, not live object references
- one pure local action and one effect-driven action both work

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

## Why `refIndex` Stores Serializable Payloads

Screens can change after the LLM reads them.
Live object references may already be gone.

So `refIndex` stores serializable snapshot payloads.
When the LLM later calls a tool, the framework reconstructs the action input from the payload attached to that `snapshotId`.

## Current Status

This is not yet a full React Native runtime or iOS shell.

What it gives you today:

- shared state core
- semantic refs with `useDataRef` and `useArrayRef`
- atomic `SnapshotBundle`
- snapshot-scoped tool execution
- a working inbox vertical slice

What you still need for a production iOS app:

- a thin React Native host adapter
- real GUI components
- model orchestration and networking
- product-level trace UI and persistence

## Current Demo

The inbox demo exposes:

- `openMessage`
- `searchMessages`

and proves that GUI and TUI both refresh from the same state after tool execution.
