# Mobile AI-Native App Framework Technical Design

> Based on the discussion log in [2026-03-23-mobile-ai-native-framework-design.md](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/docs/superpowers/specs/2026-03-23-mobile-ai-native-framework-design.md).
>
> This document turns the design consensus into a concrete technical plan for framework architecture and v1 API shape.
>
> Follow-up runtime hardening requirements from AI Calendar are captured in [2026-03-24-ai-calendar-framework-gap-analysis.md](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/docs/superpowers/specs/2026-03-24-ai-calendar-framework-gap-analysis.md).

## 1. Goal

Build a single-app AI-native mobile framework for iPhone where:

- human users operate the app through GUI
- LLM agents operate the same app through tools
- both paths converge on the same domain action layer
- all meaningful state changes flow through one canonical state system
- GUI reacts to:
  - app state changes
  - LLM action trace summaries
- TUI is explicitly authored for the LLM, not auto-generated

This framework is not a port of the current desktop AOTUI runtime.
It is a new mobile-first architecture that keeps the useful ideas and drops the desktop-specific machinery.

## 2. Non-Goals

V1 will not do these things:

- run current desktop TUI apps on iOS
- preserve API compatibility with the current `runtime` / `sdk`
- auto-generate full TUI from GUI
- introduce a heavy permission system beyond state-driven tool visibility
- redesign the agent loop itself

The mobile agent loop is assumed to already exist via Agent Driver.

## 3. First Principles

The framework should obey these rules:

1. One source of truth.
   `State` is the only canonical truth.

2. One business action layer.
   GUI controls and TUI tools are only two entry points.
   The real business capability lives in `Action`.

3. No hidden state mutation.
   State changes must be explicit and traceable.

4. Effects are impure, so they do not mutate state.
   Effects must report back through `Event`.

5. Projections are not truth.
   GUI, TUI, and trace summaries are all projections over core state and runtime records.

6. TUI is a product surface, not a debug dump.
   Developers write it intentionally because the LLM needs a carefully shaped interface.

## 4. System Overview

The framework is made of seven parts:

1. `State Store`
   Holds app shell state and feature slices.

2. `Action Runtime`
   Validates action input, checks visibility, runs handlers, coordinates effects, emits events, and returns structured results.

3. `Event Reducer Layer`
   Applies domain events to state.

4. `Effect Runtime`
   Runs async or platform side effects and reports back through events.

5. `GUI Projection`
   React Native JSX for human-facing UI.

6. `TUI Projection`
   Semantic / HTML-like JSX for LLM-facing perception and tool hints.

7. `Trace Runtime`
   Captures structured LLM action trace and derives human-readable summaries for GUI.

The core flow looks like this:

```text
Human -> GUI Control -> Action -> (Effect?) -> Event -> State -> GUI/TUI refresh
LLM   -> Tool        -> Action -> (Effect?) -> Event -> State -> GUI/TUI refresh
```

Two legal sub-flows exist:

```text
Pure local action:
Action -> Event -> State

Side-effect action:
Action -> Effect -> Event -> State
```

## 5. Core Runtime Model

### 5.1 State

The framework uses mixed topology:

- `AppShellState`
  Global concerns such as navigation shell, current screen, global banners, current or recent AI summary.

- `FeatureStateSlice`
  Business-domain slices such as inbox, search, editor, draft composer, filters, or task detail.

The rule is simple:

- if a piece of state affects GUI, TUI, tool visibility, or AI trace visibility, it belongs in framework state
- if it is purely temporary and render-only, it may stay local to a component

Example:

```ts
type AppState = {
  shell: {
    currentTab: "home" | "inbox" | "settings";
    currentAiSummary: string | null;
  };
  inbox: {
    query: string;
    isLoading: boolean;
    items: MessageSummary[];
    selectedMessageId: string | null;
  };
  trace: {
    current: TraceSummary | null;
    recent: TraceSummary | null;
    historyCount: number;
  };
};
```

### 5.2 Action

`Action` is the public business entry point.

It is used by:

- GUI controls
- LLM tools

It is not the same thing as a button click.
A button click is just one way to trigger an action.

Minimum public shape:

- `name`
- `schema`
- `meta`
- `visibility`
- `description`
- `handler`

`schema` is a real runtime validator, not just documentation. In the hardened runtime it is carried through to tool definitions as `inputSchema`, and `meta` is preserved as free-form tool metadata for host and product hints.

Example:

```ts
const searchMessages = defineAction({
  name: "searchMessages",
  description: "Search inbox messages by keyword.",
  schema: z.object({
    query: z.string().min(1),
  }),
  visibility: (state) => state.shell.currentTab === "inbox",
  async handler(ctx, input) {
    ctx.trace.update("Searching inbox");
    await ctx.runEffect("searchInbox", { query: input.query });
    return {
      success: true,
      message: `Started search for "${input.query}"`,
    };
  },
});
```

### 5.3 Event

`Event` is the only thing allowed to drive state transition.

Effects cannot write state directly.
Handlers cannot write state directly.

Examples:

```ts
type AppEvent =
  | { type: "InboxSearchStarted"; query: string }
  | { type: "InboxSearchSucceeded"; query: string; items: MessageSummary[] }
  | { type: "InboxSearchFailed"; query: string; reason: string }
  | { type: "CurrentTabChanged"; tab: AppState["shell"]["currentTab"] }
  | { type: "AiTraceUpdated"; summary: TraceSummary | null };
```

Reducer shape:

```ts
function reduce(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case "CurrentTabChanged":
      return {
        ...state,
        shell: { ...state.shell, currentTab: event.tab },
      };
    case "InboxSearchStarted":
      return {
        ...state,
        inbox: {
          ...state.inbox,
          query: event.query,
          isLoading: true,
        },
      };
    case "InboxSearchSucceeded":
      return {
        ...state,
        inbox: {
          ...state.inbox,
          query: event.query,
          isLoading: false,
          items: event.items,
        },
      };
    case "InboxSearchFailed":
      return {
        ...state,
        inbox: {
          ...state.inbox,
          isLoading: false,
        },
      };
    default:
      return state;
  }
}
```

### 5.4 Effect

`Effect` is the only place allowed to touch the outside world.

Examples:

- network request
- storage
- device permission
- deep link
- native module call

Effects do not mutate state.
They must emit events back into the runtime.
They can also report structured success or failure to the action handler through `EffectResult`, which lets the handler decide whether to surface a recoverable failure event, return an error result, or continue.

Example:

```ts
const effects = {
  async searchInbox(ctx, input: { query: string }) {
    ctx.emit({ type: "InboxSearchStarted", query: input.query });

    try {
      const items = await api.searchMessages(input.query);
      ctx.emit({ type: "InboxSearchSucceeded", query: input.query, items });
    } catch (error) {
      ctx.emit({
        type: "InboxSearchFailed",
        query: input.query,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
```

### 5.5 Result

`Result` is for the caller.
`Event` is for the state system.

This split matters because tools need immediate structured feedback even when state evolution is event-driven.

Example:

```ts
type ActionResult<T = unknown> = {
  success: boolean;
  mutated?: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};
```

## 6. Handler Contract

The action handler is the main business orchestration point.

It may:

- read current state
- emit events
- run effects
- write trace records
- return structured result

It may not:

- mutate state directly

Recommended handler context:

```ts
type ActionContext<State, Event> = {
  getState(): Readonly<State>;
  emit(event: Event): void;
  runEffect<Name extends keyof EffectMap>(
    name: Name,
    input: EffectInput<EffectMap[Name]>
  ): Promise<EffectResult>;
  trace: {
    update(summary: string): void;
  };
};
```

Note:

- the public developer experience should feel function-based
- internally the framework can compile actions into a richer runtime object model
- `getState`, `emit`, and `trace` are also exposed to effect handlers through `EffectContext`
- actions can emit structured trace lifecycle records through the runtime, and the host can subscribe to them with `useRuntimeTrace()`

## 7. Tool Model

### 7.1 Mapping

Default:

- one domain action -> one tool

Allowed advanced case:

- many actions -> one higher-level tool

V1 should optimize for the simple default case.

### 7.2 Visibility

Tool visibility is state-driven.

For v1:

- `visible === callable`
- `invisible === unavailable`

No separate permission layer is introduced yet.

Example:

```ts
visibility: (state) =>
  state.shell.currentTab === "inbox" && !state.inbox.isLoading
```

### 7.3 Schema

Action schema mainly serves:

- LLM tool calling
- runtime validation
- action boundary validation
- snapshot-scoped tool metadata generation

GUI should continue to use normal React Native props and form state.

## 8. GUI Projection

GUI is written in React Native JSX.
It consumes state and triggers actions.
The hardened host path is `createReactAppRuntime()` -> `AppRuntimeProvider` -> `useRuntimeState()` / `useRuntimeTrace()`.

It should react to two things:

- `State`
- `LLM Action Trace`

Example:

```tsx
function InboxScreen() {
  const state = useRuntimeState((runtimeState) => runtimeState);
  const { callAction } = useRuntimeActions();

  return (
    <Screen>
      <SearchBar
        value={state.inbox.query}
        onSubmit={(query) => callAction("searchMessages", { query })}
      />

      <TabBar
        currentTab={state.shell.currentTab}
        onChange={(tab) => callAction("switchTab", { tab })}
      />

      {state.trace.recent && (
        <AiActivityBanner summary={state.trace.recent.summary} />
      )}

      <MessageList items={state.inbox.items} />
    </Screen>
  );
}
```

## 9. TUI Projection

TUI is explicitly authored using semantic / HTML-like JSX.

Its job is:

1. expose LLM-facing state and structure
2. hint currently relevant tool entry points

Its job is not:

- to be a full procedural agent coach
- to be auto-generated from GUI

TUI should render from the same runtime snapshot that produced the visible tools. The read model is an atomic `SnapshotBundle` containing `tui`, `refIndex`, and `visibleTools`, and tool execution must be tied back to the exact `snapshotId` that produced it.

Example:

```tsx
function InboxTUIView() {
  const state = useRuntimeState((runtimeState) => runtimeState);
  const { getVisibleTools } = useRuntimeActions();
  const tools = getVisibleTools();

  return (
    <screen name="Inbox">
      <section title="Current Tab">
        <text>{state.shell.currentTab}</text>
      </section>

      <section title="Search State">
        <text>Query: {state.inbox.query || "(empty)"}</text>
        <text>Loading: {String(state.inbox.isLoading)}</text>
      </section>

      <section title="Messages">
        {state.inbox.items.map((item) => (
          <item key={item.id}>{item.subject}</item>
        ))}
      </section>

      <section title="Available Tools">
        {tools.map((tool) => (
          <tool key={tool.name} name={tool.name}>
            {tool.description}
          </tool>
        ))}
      </section>
    </screen>
  );
}
```

Because TUI is handwritten, the framework must later provide drift detection or consistency checks between GUI and TUI.

### 9.1 Why AOTUI Snapshot + IndexMap Must Be Preserved

Current AOTUI already solved a very important problem:

- the LLM needs to see readable content
- but tools should operate on real domain objects, not brittle UI text

So AOTUI uses two things together:

1. `Snapshot Markup`
   What the LLM reads.

2. `IndexMap`
   A machine index from `ref_id` to real data.

The key idea is:

- TUI shows a human-readable label
- inside that label there is a semantic handle
- when the LLM calls a tool with that handle, runtime resolves it back to the real object

In current AOTUI, this contract is described in the system instruction as:

- `(content)[type:ref_id]`
- tool calls pass only `ref_id`
- runtime resolves `ref_id` from `IndexMap`

See:

- [runtime/src/adapters/system-instruction.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/adapters/system-instruction.ts#L92)
- [runtime/src/engine/system/dispatcher.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/engine/system/dispatcher.ts#L21)

This is not just a display trick.
It is a semantic pointer protocol between:

- what the LLM sees
- what the tool accepts
- what the runtime executes

In the hardened mobile runtime, the same idea is preserved through `SnapshotBundle.refIndex` plus `snapshotId`, with stale snapshot detection handled by the snapshot registry rather than by guessing against the latest render.

### 9.2 What Current AOTUI Actually Does

Under the hood, current AOTUI has three separate steps:

1. SDK marks data with refs
   The SDK hooks format content into TUI markers and register `ref_id -> data`.
   See:
   - [sdk/src/hooks/useRef.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/sdk/src/hooks/useRef.ts#L47)
   - [sdk/src/hooks/useArrayRef.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/sdk/src/hooks/useArrayRef.ts#L76)

2. Worker exports refs into snapshot `IndexMap`
   Worker snapshot generation merges DOM transformer output with ref registry export.
   See:
   - [runtime/src/worker-runtime/index.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/worker-runtime/index.ts#L678)
   - [runtime/src/worker-runtime/app-kernel/AppKernel.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/worker-runtime/app-kernel/AppKernel.ts#L392)
   - [runtime/src/engine/view/snapshot/formatter.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/engine/view/snapshot/formatter.ts#L136)

3. Dispatcher resolves tool args back to real objects
   When a tool argument is a string ref, runtime looks it up in the current snapshot namespace.
   See:
   - [runtime/src/engine/system/dispatcher.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/runtime/src/engine/system/dispatcher.ts#L25)

So the old chain is:

```text
TUI marker -> ref_id -> IndexMap -> tool arg resolution -> real domain object
```

This is the part we should migrate.
What we should not migrate is the old desktop-specific path:

- DOM observer
- DOM transform as the primary source of truth
- worker-side HTML parsing as the main semantic extraction mechanism

The new mobile framework is `state-first`, so refs should be built from TUI projection and state, not scraped back out of DOM.

### 9.3 Migration Principle for Mobile AI-Native

In the mobile framework, we should preserve the protocol but move its center of gravity:

- old AOTUI:
  `DOM/markup transform -> Snapshot + IndexMap`

- new mobile AI-native:
  `State + handwritten TUI projection -> SnapshotBundle`

That means the new framework should have a first-class runtime object like:

```ts
type SnapshotBundle = {
  tui: string;
  toolHints: VisibleToolHint[];
  refIndex: RefIndex;
};
```

Where:

```ts
type RefIndex = Record<string, RefIndexEntry>;

type RefIndexEntry = {
  type: string;
  value: unknown;
  view?: string;
  feature?: string;
  displayText?: string;
};
```

The important shift is this:

- `refIndex` is no longer a side-product of DOM transform
- it is an intentional output of TUI projection

In plain language:

- the developer writes what the LLM should see
- the developer marks which parts are semantic references
- the runtime collects those references into an index
- tool execution can later resolve them safely

### 9.4 Canonical Data Marker Model

Current AOTUI has a small historical inconsistency:

- system instruction describes markers as `(content)[type:ref_id]`
- some SDK helpers currently emit markdown-link-like strings such as `[content](refId)` or `[content](Type:refId)`

We should not carry this ambiguity into mobile v1.

The new framework should define a canonical internal model first:

```ts
type DataRefToken = {
  kind: "data_ref";
  refId: string;
  refType: string;
  content: string;
};
```

Then let the TUI renderer choose one canonical text syntax.

Recommended v1 canonical syntax:

```text
(Fix login bug)[todo:pending[0]]
```

Why this is better than reusing generic markdown link syntax:

- it reads as a special semantic token, not a normal hyperlink
- it matches the existing AOTUI system instruction
- it is easier to explain to the model
- it leaves less room for parser ambiguity

So for mobile v1:

- internal truth = structured `DataRefToken`
- rendered TUI = `(content)[type:ref_id]`
- tool input = only `ref_id`
- runtime resolution target = `refIndex[ref_id]`

### 9.5 Developer-Facing Data Ref API

Because TUI is handwritten, the framework should give developers an explicit API to mark data.

Naming rule:

- `useDataRef` is the single-object semantic primitive
- `useArrayRef` is the array-structure semantic primitive
- future helpers should continue to be named by data structure, not by visual presentation
- `useDataRef` should return a formatter
- `useArrayRef` should bind the array itself, not a higher-level list wrapper object
- canonical parameter order should be `(type, data, refId)`

This naming is better than `useTUIRef` because the real idea is not "a TUI helper".
The real idea is "turn domain data into semantic references that TUI and tool calling can share".

Important nuance:

- from the developer's point of view, `useDataRef` returns a formatter that produces a marker string
- from the framework's point of view, each formatter call also registers `ref_id -> serialized snapshot payload` into the current `refIndex`
- list-level refs produced by `useArrayRef` should also register into `refIndex`
- when `useArrayRef` binds `messages`, `refIndex["messages"]` should store a serializable snapshot of the whole array

So the public API stays simple, but the runtime contract is still structured underneath.

Cost note:

- list-level refs are allowed because some tools may need to operate on a whole collection
- but they are not free
- registering a list ref may put a much larger payload into `refIndex` than item-level refs
- framework docs should explicitly warn developers about this cost
- default guidance should be: prefer item refs for large collections, use list refs only when whole-list semantics are truly needed

Authoring note:

- minor API surface details like parameter ordering should be decided directly by the framework design
- user discussion should stay focused on architectural boundaries, not low-value micro-decisions

Example:

```tsx
function InboxTUIView() {
  const state = useRuntimeState((runtimeState) => runtimeState);
  const pinnedRef = useDataRef("message", state.inbox.items[0], "messages[0]");
  const [listRef, itemRef] = useArrayRef("message", state.inbox.items, "messages");

  return (
    <screen name="Inbox">
      <section title="Messages">
        <text>{listRef("Inbox messages")}</text>
        {state.inbox.items.map((item, index) => (
          <item key={item.id}>
            {itemRef(index, item.subject)}
          </item>
        ))}
      </section>

      <section title="Pinned">
        <item>{pinnedRef("Pinned message")}</item>
      </section>
    </screen>
  );
}
```

Possible runtime return:

```ts
const bundle = renderTUI();

bundle.tui;
// - (Welcome back)[message:messages[0]]

bundle.refIndex["messages[0]"];
// { type: "message", value: { id: "m1", subject: "Welcome back" } }  // serialized snapshot payload
```

This preserves the most valuable part of AOTUI, but in a more direct mobile-first shape.

### 9.6 Tool Argument Resolution in Mobile

The action runtime should support ref-first tool arguments the same way AOTUI does.

Rule:

- if a tool parameter is declared as a domain reference
- and the caller passes a string `ref_id`
- runtime resolves it from the same `SnapshotBundle.refIndex` that the LLM saw
- action handler receives the reconstructed argument payload for that snapshot

Suggested conceptual flow:

```text
LLM sees: (Welcome back)[message:messages[0]]
LLM calls: openMessage({ message: "messages[0]" }, snapshotId)
Runtime resolves: snapshotBundle.refIndex["messages[0]"] -> serialized snapshot payload
Action receives: { message: { id: "m1", subject: "Welcome back", ... } }
```

This matters because it keeps tool APIs:

- semantic
- stable
- independent from UI widget ids
- independent from brittle text matching

And it also fixes a subtle but important time problem:

- screens can change after the LLM reads them
- live object references may already be gone
- but the tool call still needs the arguments from the snapshot the LLM actually saw

So the correct rule is:

- `refIndex` stores immutable serializable snapshot payloads
- tool execution resolves against the originating `snapshotId`
- runtime never guesses by looking at the latest UI state

### 9.7 New Framework Rule: SnapshotBundle Is a Runtime Contract

For the new mobile framework, `SnapshotBundle` should be a first-class runtime contract, not an incidental render artifact.

It should contain at least:

```ts
type SnapshotBundle = {
  snapshotId: string;
  tui: string;
  refIndex: RefIndex;
  visibleTools: ToolDefinition[];
  generatedAt: number;
};
```

This bundle becomes the single LLM-facing read model.

That means:

- Agent Driver reads `tui`
- tool discovery reads `visibleTools`
- tool argument resolution reads `refIndex`

All three must come from the same render tick.

That last sentence is very important.
If they come from different moments in time, the LLM can see a ref that no longer exists.

So the framework must treat:

- TUI text
- tool list
- ref index

as one atomic snapshot.

## 10. LLM Action Trace

Trace must be dual-layered:

1. `Structured Trace`
   For runtime, debug, replay, and audit.

2. `Human Summary`
   For GUI display.

V1 UX requirement:

- GUI shows final result changes
- GUI also shows current or recent AI action
- full history is persisted and expandable

Suggested trace record:

```ts
type TraceStatus = "started" | "in_progress" | "succeeded" | "failed";

type LLMActionTraceRecord = {
  id: string;
  actionName: string;
  toolName?: string;
  status: TraceStatus;
  startedAt: number;
  updatedAt: number;
  input?: unknown;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
  summary: string;
};
```

## 11. Framework API Sketch

### 11.1 App Definition

```ts
const app = defineAiNativeApp({
  initialState,
  reduce,
  effects,
  actions: [
    switchTab,
    searchMessages,
    openMessage,
  ],
  gui: AppGUI,
  tui: AppTUI,
});
```

### 11.2 State Hook

```ts
const state = useRuntimeState((runtimeState) => runtimeState);
```

State consumers should use selector-based reads.
If the app needs to mutate state, it should do so through actions.

### 11.3 Action Hook

```ts
const { callAction, getVisibleTools } = useRuntimeActions();

await callAction("searchMessages", { query: "invoice" });
const tools = getVisibleTools();
```

### 11.4 Tool Bridge

The agent loop should not know app internals.
It only needs a stable adapter like:

```ts
type ToolBridge = {
  listTools(): ToolDefinition[];
  executeTool(name: string, input: unknown, snapshotId: string): Promise<ActionResult>;
  getTUI(): string;
  getSnapshotBundle(): SnapshotBundle;
};
```

The bridge is derived from framework state, action metadata, and TUI projection.
`getTUI()` is a convenience view.
`getSnapshotBundle()` is the real runtime contract because tool execution also needs the current `refIndex`.

## 12. Runtime Execution Steps

For a visible tool call:

1. Agent Driver asks framework for visible tools
2. Framework derives them from current state + action visibility
3. Framework renders one atomic `SnapshotBundle`
4. LLM reads `tui` and chooses a tool
5. LLM calls a tool with the originating `snapshotId`
6. Framework validates tool input with action schema
7. Framework loads that exact `SnapshotBundle`
8. Framework resolves any ref-first parameters from that bundle's `refIndex`
9. Framework invokes action handler
10. Handler may:
   - emit local event directly
   - or run effect, which later emits event
11. Reducer applies event to state
12. GUI projection re-renders
13. TUI projection re-renders
14. Trace projection updates
15. Caller receives structured result

## 13. Suggested V1 Package Boundaries

The framework can start as five modules:

1. `core/state`
   App state container, reducer loop, event application.

2. `core/action`
   `defineAction`, validation, visibility, action runtime, result handling.

3. `core/effect`
   Effect registry and effect execution context.

4. `projection/gui`
   React Native integration hooks and providers.

5. `projection/tui`
   Semantic JSX renderer, data ref markers, `SnapshotBundle` builder, visible tool extraction.

Optional sixth module:

6. `trace`
   Structured action trace store and GUI summary derivation.

## 14. V1 Scope

V1 should be deliberately small.

Must-have:

- app state store
- event reducer
- effect runtime
- action registry
- state-driven tool visibility
- structured result contract
- handwritten TUI projection
- semantic data markers + `refIndex`
- GUI trace summary + expandable trace history
- tool bridge for Agent Driver

Do not include yet:

- permission matrix
- multi-app host
- automatic TUI generation
- full projection diffing engine
- speculative action execution
- multi-agent coordination

## 15. Biggest Risks

### Risk 1: GUI/TUI drift

Because TUI is handwritten, GUI and TUI can diverge over time.

Mitigation:

- add authoring-time checks later
- add lint or test helpers to assert key business states are exposed in TUI

### Risk 1.5: TUI / refIndex drift

If TUI text and `refIndex` are not produced from the same render tick, the LLM can see stale refs.

Mitigation:

- treat `SnapshotBundle` as atomic
- validate that every emitted data marker has a matching `refIndex` entry
- reject tool calls that reference missing or stale refs with explicit runtime errors

### Risk 2: Handler bloat

If handlers become too large, actions turn into God functions.

Mitigation:

- encourage small effects
- encourage helper services per feature
- keep reducer logic pure and simple

### Risk 3: State over-centralization

If everything is forced into global state, React ergonomics will suffer.

Mitigation:

- keep the dual rule:
  business-visible state goes into framework state
  render-only helper state may stay local

## 16. Recommendation

The best v1 implementation direction is:

- keep state/event/effect flow strict
- keep action authoring small and function-friendly
- keep GUI idiomatic to React Native
- keep TUI explicit and semantic
- preserve AOTUI's `Snapshot + IndexMap` idea as a mobile-first `SnapshotBundle + refIndex`
- keep visibility simple: visible means callable
- keep trace dual-layered: structured underneath, human summary on top

This gives the project a framework architecture that is:

- understandable
- React-friendly
- LLM-friendly
- auditable
- small enough to build in stages

without smuggling desktop runtime assumptions into mobile.

## 17. Immediate Next Step

The single most important next step is not more API naming discussion.
It is proving one end-to-end vertical slice.

In plain language:

- can the framework render one `SnapshotBundle`
- can the LLM call one tool with a `ref_id` and `snapshotId`
- can runtime resolve that call against the exact snapshot the LLM saw
- can that action change state
- can GUI and TUI both update from the same new state

That is the spine of the whole framework.

If this spine works, many later details are just refinement.
If this spine does not work, every other design discussion is decoration.

The first vertical slice should be deliberately tiny:

1. one feature slice
   for example: inbox or todo list

2. one `useDataRef`
   for a single object

3. one `useArrayRef`
   for a small collection

4. one visible tool
   for example: `openMessage` or `markTodoDone`

5. one pure local action
   `Action -> Event -> State`

6. one side-effect action
   `Action -> Effect -> Event -> State`

7. one GUI screen
   that visibly changes

8. one handwritten TUI screen
   that exposes refs and tool hints

Success means:

- the LLM can act on the app through refs, not guessed ids
- GUI visibly reflects the result
- the action trace is visible
- stale snapshot calls fail cleanly

This should be the next artifact after the design spec:

- a concrete v1 implementation plan for this vertical slice
