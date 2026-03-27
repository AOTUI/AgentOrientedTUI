# @aotui/mobile-ai-native

This package is the hardened runtime core for building agent-native mobile apps.

It is the **core**, not the full React Native host layer.
React Native / Expo mounting now lives in [`@aotui/mobile-ai-native-react-native`](../packages/mobile-ai-native-react-native/README.md).

It provides the state store, action runtime, trace lifecycle, snapshot registry, and tool bridge needed for a real mobile host.

The current snapshot model is view-based:

`State -> static Root view + state-derived mounted views -> SnapshotBundle -> Tool Call(ref_id + snapshotId) -> Action -> Event/Effect -> State -> GUI/TUI refresh`

## What This Slice Proves

- one shared state system drives both GUI and TUI
- the root view is static navigation knowledge, not runtime state
- business views are mounted from current state and represent runtime reality
- tools are scoped by `viewType` and then filtered by `visibility(state)`
- the framework builds one atomic `SnapshotBundle`
- snapshot markup is composed from ordered `<View>` fragments
- tools execute against the exact `snapshotId` the LLM saw
- `refIndex` stores serializable snapshot payloads, not live object references
- mutated tool results stale the originating snapshot, even when the result is recoverable
- trace entries record the action lifecycle: `started`, `updated`, `succeeded`, and `failed`

## SnapshotBundle

The LLM-facing read model is:

```ts
type SnapshotBundle = {
  snapshotId: string;
  generatedAt: number;
  markup: string;
  views: readonly ViewFragment[];
  tui: string;
  refIndex: Record<string, RefIndexEntry>;
  visibleTools: readonly ToolDefinition[];
};
```

Current behavior to keep in mind:

- `markup` is the composed xml+markdown snapshot built from ordered `<View>` fragments
- `views` preserves the ordered fragment list, with the `Root` fragment first
- `tui` is retained as a compatibility readout and may differ from `markup`, but it should be produced from the same snapshot generation pass
- `refIndex` and `visibleTools` are produced and frozen alongside snapshot creation

The bundle is intended to be atomic:

- `markup`
- `views`
- `tui`
- `refIndex`
- `visibleTools`

Today the runtime hard-validates `markup` against `views`, then freezes the associated `tui`, `refIndex`, and `visibleTools` outputs generated on that same snapshot path.

## RootView And Mounted Views

`RootView` is the conceptual navigation role, and the current runtime emits it as a fragment with `type: "Root"`.

It explains:

- what view types exist
- how to enter them
- what each view type is for

It does not try to narrate runtime state.

Mounted business views are the runtime reality.

They are derived from current state and describe:

- which concrete views are mounted right now
- what state each mounted view is showing
- what refs and actions are relevant in that state

That means the LLM should read the static root first, then read the mounted business views for the live app state.

## Tool Model

Tools are defined against a semantic `viewType`, then filtered by current state.

That gives the runtime this rule:

`visibleTools = tools for currently relevant viewTypes + visibility(state)`

So a tool can exist in the app, be mounted to a view type, and still be hidden when the current state does not allow it.

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

For tools that declare `meta.supportsRefs === true`, the bridge resolves top-level string inputs as either exact `ref_id` values or canonical marker strings from that snapshot's `refIndex`.
It does not infer nested field refs or field-level ref metadata.

The low-level React-family host path inside the core is still present because the adapter composes it, but product code should prefer the dedicated RN adapter package.

The adapter-facing runtime path is:

- `createReactAppRuntime()` owns the store, action runtime, snapshot registry, trace store, and tool bridge
- `AppRuntimeProvider` publishes that runtime through context
- `useRuntimeState(selector)` subscribes to store updates with `useSyncExternalStore`
- `useRuntimeTrace(selector)` subscribes to the trace store the same way
- `createReactNativeAppRuntime()` in the adapter package wraps that core runtime and exposes `runtime.ai.getSnapshot()` / `runtime.ai.executeTool(...)` for host-safe tool execution

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

## Current Status

This package is the core, not the full app shell.

What it gives you today:

- shared state core
- semantic refs with `useDataRef` and `useArrayRef`
- atomic `SnapshotBundle`
- static root navigation plus state-derived mounted business views
- snapshot-scoped tool execution
- a pure core that can now be mounted by the dedicated RN / Expo adapter
- structured trace and effect contracts

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
- snapshot coherence is enforced for the textual view representation, so `markup`, `views`, and `tui` must agree for the same render tick; `refIndex` and `visibleTools` are built and frozen alongside that snapshot path but are not yet cross-validated field-by-field
