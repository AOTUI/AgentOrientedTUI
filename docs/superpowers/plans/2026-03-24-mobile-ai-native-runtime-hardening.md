# Mobile AI-Native Runtime Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden `@aotui/mobile-ai-native` from an alpha protocol demo into a React Native / Expo-ready runtime core that AI Calendar can safely build on.

**Architecture:** Keep the current host-agnostic spine intact: shared `State`, shared `Action`, atomic `SnapshotBundle`, and snapshot-scoped tool execution. Add a formal React host adapter, true reactive GUI subscriptions, richer tool metadata, trace/effect lifecycle contracts, and explicit snapshot invalidation without letting business logic leak into the framework core.

**Tech Stack:** TypeScript, Preact core runtime, React-compatible host adapter APIs, Vitest, Happy DOM, Zod

---

## File Structure

### Files To Create

- `mobile-ai-native/src/projection/react/createReactAppRuntime.ts`
  React / React Native host runtime factory that wires store, action runtime, snapshot runtime, and trace runtime together.
- `mobile-ai-native/src/projection/react/AppRuntimeProvider.tsx`
  Formal host provider for React-family consumers.
- `mobile-ai-native/src/projection/react/hooks.ts`
  Reactive hooks such as `useRuntimeState`, `useRuntimeActions`, `useRuntimeSnapshot`, and `useRuntimeTrace`.
- `mobile-ai-native/src/core/snapshot/createSnapshotRegistry.ts`
  Bounded snapshot cache with explicit stale / not-found semantics.
- `mobile-ai-native/src/core/trace/types.ts`
  Shared trace lifecycle model.
- `mobile-ai-native/src/core/trace/createTraceStore.ts`
  Structured trace store for current + recent + history views.
- `mobile-ai-native/test/react-runtime.test.tsx`
  Host adapter and reactive GUI contract tests.
- `mobile-ai-native/test/snapshot-registry.test.ts`
  Snapshot invalidation, stale behavior, and bounded retention tests.
- `mobile-ai-native/test/trace-runtime.test.ts`
  Trace lifecycle tests.
- `mobile-ai-native/test/effect-runtime.test.ts`
  Effect contract and multi-event behavior tests.

### Files To Modify

- `mobile-ai-native/package.json`
  Add React host adapter dependencies and test utilities only if the implementation needs them.
- `mobile-ai-native/src/index.ts`
  Export new runtime host, trace, and snapshot registry APIs.
- `mobile-ai-native/src/core/types.ts`
  Expand `ToolDefinition`, `SnapshotBundle`, trace types, and runtime contracts.
- `mobile-ai-native/src/core/action/defineAction.ts`
  Carry richer tool metadata and ref-aware schema hints.
- `mobile-ai-native/src/core/action/createActionRuntime.ts`
  Emit trace lifecycle, expose richer tool definitions, and integrate snapshot invalidation hooks.
- `mobile-ai-native/src/core/effect/types.ts`
  Formalize effect context and lifecycle semantics.
- `mobile-ai-native/src/tool/createToolBridge.ts`
  Move from ad hoc `Map` caching to snapshot registry-backed execution with stale handling.
- `mobile-ai-native/src/projection/gui/AppProvider.tsx`
  Either deprecate or re-export the new runtime host provider cleanly.
- `mobile-ai-native/src/projection/gui/hooks.ts`
  Either deprecate or re-export React-compatible runtime hooks.
- `mobile-ai-native/src/demo/inbox/createInboxApp.tsx`
  Wire the demo through the real host runtime instead of the thin alpha provider.
- `mobile-ai-native/src/demo/inbox/actions.ts`
  Add richer tool metadata and trace-aware behavior.
- `mobile-ai-native/src/demo/inbox/effects.ts`
  Adopt the formal effect contract.
- `mobile-ai-native/src/demo/inbox/InboxGUI.tsx`
  Consume the reactive state hook and visible tool metadata.
- `mobile-ai-native/src/demo/inbox/InboxTUI.tsx`
  Validate that `visibleTools` and snapshot refs stay aligned.
- `mobile-ai-native/README.md`
  Document the runtime core boundary and React host adapter usage.
- `mobile-ai-native/GUIDE.md`
  Update the AI Calendar guide to reflect the hardened runtime API.

### Files To Leave Alone

- Business app `DrivenSource`
- AgentDriver loop
- App-specific state shapes beyond the inbox demo

Those remain app-owned, not framework-owned.

## Task 1: Build The Formal React Host Adapter

**Files:**
- Create: `mobile-ai-native/src/projection/react/createReactAppRuntime.ts`
- Create: `mobile-ai-native/src/projection/react/AppRuntimeProvider.tsx`
- Create: `mobile-ai-native/src/projection/react/hooks.ts`
- Modify: `mobile-ai-native/src/index.ts`
- Modify: `mobile-ai-native/src/projection/gui/AppProvider.tsx`
- Modify: `mobile-ai-native/src/projection/gui/hooks.ts`
- Test: `mobile-ai-native/test/react-runtime.test.tsx`

- [ ] **Step 1: Write the failing host adapter tests**

```tsx
it("re-renders a consumer when store state changes", async () => {
  const runtime = createReactAppRuntime(testApp);
  const seen: string[] = [];

  function Probe() {
    const tab = useRuntimeState((state) => state.shell.currentTab);
    seen.push(tab);
    return <text>{tab}</text>;
  }

  render(
    <AppRuntimeProvider runtime={runtime}>
      <Probe />
    </AppRuntimeProvider>,
  );

  await runtime.actions.callAction("changeTab", { tab: "settings" });

  expect(seen).toEqual(["home", "settings"]);
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `pnpm -C mobile-ai-native test:run -- test/react-runtime.test.tsx`
Expected: FAIL because `createReactAppRuntime`, `AppRuntimeProvider`, or `useRuntimeState` do not exist yet.

- [ ] **Step 3: Implement the minimal host runtime**

Key implementation points:

- `createReactAppRuntime()` owns:
  - `store`
  - `actionRuntime`
  - `traceStore`
  - `snapshotRegistry`
  - `toolBridge`
- `AppRuntimeProvider` exposes a stable runtime object, not a handful of loose props
- `useRuntimeState(selector)` uses a subscription-based contract, not plain `getState()`
- old `projection/gui/*` surface either re-exports the new host APIs or becomes a small compatibility shim

- [ ] **Step 4: Run the targeted test to verify it passes**

Run: `pnpm -C mobile-ai-native test:run -- test/react-runtime.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ai-native/src/index.ts \
  mobile-ai-native/src/projection/react/createReactAppRuntime.ts \
  mobile-ai-native/src/projection/react/AppRuntimeProvider.tsx \
  mobile-ai-native/src/projection/react/hooks.ts \
  mobile-ai-native/src/projection/gui/AppProvider.tsx \
  mobile-ai-native/src/projection/gui/hooks.ts \
  mobile-ai-native/test/react-runtime.test.tsx
git commit -m "feat: add react runtime host adapter"
```

## Task 2: Make GUI State Consumption Truly Reactive

**Files:**
- Modify: `mobile-ai-native/src/core/types.ts`
- Modify: `mobile-ai-native/src/core/state/createStore.ts`
- Modify: `mobile-ai-native/src/projection/react/hooks.ts`
- Modify: `mobile-ai-native/src/demo/inbox/InboxGUI.tsx`
- Test: `mobile-ai-native/test/react-runtime.test.tsx`
- Test: `mobile-ai-native/test/vertical-slice.e2e.test.tsx`

- [ ] **Step 1: Add a failing selector-stability test**

```tsx
it("only updates the selected slice when state changes", async () => {
  const runtime = createReactAppRuntime(testApp);
  const selected: string[] = [];

  function Probe() {
    const value = useRuntimeState((state) => state.inbox.query);
    selected.push(value);
    return <text>{value}</text>;
  }

  render(
    <AppRuntimeProvider runtime={runtime}>
      <Probe />
    </AppRuntimeProvider>,
  );

  await runtime.actions.callAction("searchMessages", { query: "docs" });

  expect(selected.at(-1)).toBe("docs");
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm -C mobile-ai-native test:run -- test/react-runtime.test.tsx test/vertical-slice.e2e.test.tsx`
Expected: FAIL because state consumption is still one-shot or stale.

- [ ] **Step 3: Implement reactive subscriptions**

Implementation notes:

- keep `Store.subscribe()` as the core primitive
- make `useRuntimeState()` subscribe through a React-compatible external store pattern
- allow selector-based reads so GUI components do not have to pull the entire runtime state
- update the inbox GUI demo to consume the new hook instead of the alpha `useAppState()`

- [ ] **Step 4: Re-run the focused tests**

Run: `pnpm -C mobile-ai-native test:run -- test/react-runtime.test.tsx test/vertical-slice.e2e.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ai-native/src/core/types.ts \
  mobile-ai-native/src/core/state/createStore.ts \
  mobile-ai-native/src/projection/react/hooks.ts \
  mobile-ai-native/src/demo/inbox/InboxGUI.tsx \
  mobile-ai-native/test/react-runtime.test.tsx \
  mobile-ai-native/test/vertical-slice.e2e.test.tsx
git commit -m "feat: add reactive runtime state hooks"
```

## Task 3: Expand Tool Metadata And Action Definitions

**Files:**
- Modify: `mobile-ai-native/src/core/types.ts`
- Modify: `mobile-ai-native/src/core/action/defineAction.ts`
- Modify: `mobile-ai-native/src/core/action/createActionRuntime.ts`
- Modify: `mobile-ai-native/src/tool/createToolBridge.ts`
- Modify: `mobile-ai-native/src/demo/inbox/actions.ts`
- Test: `mobile-ai-native/test/tool-bridge.test.ts`
- Test: `mobile-ai-native/test/vertical-slice.e2e.test.tsx`

- [ ] **Step 1: Write failing tool metadata tests**

```ts
it("lists visible tools with schema and metadata", () => {
  const tools = runtime.actions.listVisibleTools();

  expect(tools).toContainEqual(
    expect.objectContaining({
      name: "openMessage",
      description: expect.any(String),
      inputSchema: expect.any(Object),
      meta: expect.objectContaining({
        supportsRefs: true,
      }),
    }),
  );
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm -C mobile-ai-native test:run -- test/tool-bridge.test.ts test/vertical-slice.e2e.test.tsx`
Expected: FAIL because `ToolDefinition` only has `name` and `description`.

- [ ] **Step 3: Implement richer tool contracts**

Implementation notes:

- `defineAction()` should carry:
  - schema
  - description
  - visibility
  - tool metadata
- `listVisibleTools()` should expose:
  - `name`
  - `description`
  - `inputSchema`
  - `meta`
- keep the tool system state-driven
- do not introduce app-specific semantics into core

- [ ] **Step 4: Re-run the focused tests**

Run: `pnpm -C mobile-ai-native test:run -- test/tool-bridge.test.ts test/vertical-slice.e2e.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ai-native/src/core/types.ts \
  mobile-ai-native/src/core/action/defineAction.ts \
  mobile-ai-native/src/core/action/createActionRuntime.ts \
  mobile-ai-native/src/tool/createToolBridge.ts \
  mobile-ai-native/src/demo/inbox/actions.ts \
  mobile-ai-native/test/tool-bridge.test.ts \
  mobile-ai-native/test/vertical-slice.e2e.test.tsx
git commit -m "feat: add tool schemas and metadata"
```

## Task 4: Add Snapshot Registry And Stale Snapshot Semantics

**Files:**
- Create: `mobile-ai-native/src/core/snapshot/createSnapshotRegistry.ts`
- Modify: `mobile-ai-native/src/core/types.ts`
- Modify: `mobile-ai-native/src/core/snapshot/createSnapshotBundle.ts`
- Modify: `mobile-ai-native/src/tool/createToolBridge.ts`
- Test: `mobile-ai-native/test/snapshot-registry.test.ts`
- Test: `mobile-ai-native/test/tool-bridge.test.ts`

- [ ] **Step 1: Write the failing snapshot lifecycle tests**

```ts
it("marks a consumed snapshot as stale after a successful tool execution", async () => {
  const snapshot = bridge.getSnapshotBundle();

  const result = await bridge.executeTool(
    "openMessage",
    { message: "messages[0]" },
    snapshot.snapshotId,
  );

  expect(result.success).toBe(true);

  const staleResult = await bridge.executeTool(
    "openMessage",
    { message: "messages[0]" },
    snapshot.snapshotId,
  );

  expect(staleResult).toEqual(
    expect.objectContaining({
      success: false,
      error: expect.objectContaining({ code: "SNAPSHOT_STALE" }),
    }),
  );
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm -C mobile-ai-native test:run -- test/snapshot-registry.test.ts test/tool-bridge.test.ts`
Expected: FAIL because snapshots are still stored in a raw `Map` with no stale policy.

- [ ] **Step 3: Implement the registry**

Implementation notes:

- move snapshot storage behind a dedicated registry
- support:
  - create
  - lookup
  - mark stale
  - evict old snapshots
- treat `SnapshotBundle` as a read-screen credential
- after an accepted state-changing tool execution, mark the originating snapshot stale
- keep a very small bounded retention window for debugging only

- [ ] **Step 4: Re-run the focused tests**

Run: `pnpm -C mobile-ai-native test:run -- test/snapshot-registry.test.ts test/tool-bridge.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ai-native/src/core/snapshot/createSnapshotRegistry.ts \
  mobile-ai-native/src/core/types.ts \
  mobile-ai-native/src/core/snapshot/createSnapshotBundle.ts \
  mobile-ai-native/src/tool/createToolBridge.ts \
  mobile-ai-native/test/snapshot-registry.test.ts \
  mobile-ai-native/test/tool-bridge.test.ts
git commit -m "feat: add snapshot registry and stale handling"
```

## Task 5: Make Trace A First-Class Runtime Stream

**Files:**
- Create: `mobile-ai-native/src/core/trace/types.ts`
- Create: `mobile-ai-native/src/core/trace/createTraceStore.ts`
- Modify: `mobile-ai-native/src/core/types.ts`
- Modify: `mobile-ai-native/src/core/action/createActionRuntime.ts`
- Modify: `mobile-ai-native/src/projection/react/createReactAppRuntime.ts`
- Modify: `mobile-ai-native/src/projection/react/hooks.ts`
- Modify: `mobile-ai-native/src/demo/inbox/actions.ts`
- Test: `mobile-ai-native/test/trace-runtime.test.ts`
- Test: `mobile-ai-native/test/vertical-slice.e2e.test.tsx`

- [ ] **Step 1: Write the failing trace tests**

```ts
it("records action lifecycle from started to succeeded", async () => {
  await runtime.actions.callAction("searchMessages", { query: "invoice" });

  expect(runtime.trace.getRecent()).toEqual(
    expect.objectContaining({
      status: "succeeded",
      actionName: "searchMessages",
    }),
  );
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm -C mobile-ai-native test:run -- test/trace-runtime.test.ts test/vertical-slice.e2e.test.tsx`
Expected: FAIL because trace methods are still placeholders.

- [ ] **Step 3: Implement the trace runtime**

Implementation notes:

- define structured lifecycle states:
  - `started`
  - `updated`
  - `succeeded`
  - `failed`
- keep both:
  - structured records
  - a human-facing recent summary projection
- let action runtime emit trace records through a dedicated store
- make the host runtime expose trace subscription hooks

- [ ] **Step 4: Re-run the focused tests**

Run: `pnpm -C mobile-ai-native test:run -- test/trace-runtime.test.ts test/vertical-slice.e2e.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ai-native/src/core/trace/types.ts \
  mobile-ai-native/src/core/trace/createTraceStore.ts \
  mobile-ai-native/src/core/types.ts \
  mobile-ai-native/src/core/action/createActionRuntime.ts \
  mobile-ai-native/src/projection/react/createReactAppRuntime.ts \
  mobile-ai-native/src/projection/react/hooks.ts \
  mobile-ai-native/src/demo/inbox/actions.ts \
  mobile-ai-native/test/trace-runtime.test.ts \
  mobile-ai-native/test/vertical-slice.e2e.test.tsx
git commit -m "feat: add runtime trace lifecycle"
```

## Task 6: Formalize Effect Contracts

**Files:**
- Modify: `mobile-ai-native/src/core/effect/types.ts`
- Modify: `mobile-ai-native/src/core/action/createActionRuntime.ts`
- Modify: `mobile-ai-native/src/demo/inbox/effects.ts`
- Test: `mobile-ai-native/test/effect-runtime.test.ts`
- Test: `mobile-ai-native/test/vertical-slice.e2e.test.tsx`

- [ ] **Step 1: Write failing effect lifecycle tests**

```ts
it("allows an effect to emit multiple events and update trace", async () => {
  const result = await runtime.actions.callAction("searchMessages", {
    query: "roadmap",
  });

  expect(result.success).toBe(true);
  expect(runtime.store.getState().inbox.isLoading).toBe(false);
  expect(runtime.trace.getRecent()?.status).toBe("succeeded");
});
```

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `pnpm -C mobile-ai-native test:run -- test/effect-runtime.test.ts test/vertical-slice.e2e.test.tsx`
Expected: FAIL because effect contracts are still too loose.

- [ ] **Step 3: Implement the formal effect contract**

Implementation notes:

- effect context should explicitly expose:
  - `getState()`
  - `emit(event)`
  - `trace`
- document effect error semantics:
  - recoverable failure should become structured events and result errors
  - unexpected failure should still produce a failed trace record
- allow effects to emit multiple events over one action lifecycle

- [ ] **Step 4: Re-run the focused tests**

Run: `pnpm -C mobile-ai-native test:run -- test/effect-runtime.test.ts test/vertical-slice.e2e.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ai-native/src/core/effect/types.ts \
  mobile-ai-native/src/core/action/createActionRuntime.ts \
  mobile-ai-native/src/demo/inbox/effects.ts \
  mobile-ai-native/test/effect-runtime.test.ts \
  mobile-ai-native/test/vertical-slice.e2e.test.tsx
git commit -m "feat: formalize effect runtime contract"
```

## Task 7: Update Docs And Re-verify The Runtime Core

**Files:**
- Modify: `mobile-ai-native/README.md`
- Modify: `mobile-ai-native/GUIDE.md`
- Modify: `docs/superpowers/specs/2026-03-24-mobile-ai-native-framework-technical-design.md`
- Modify: `docs/superpowers/specs/2026-03-24-ai-calendar-framework-gap-analysis.md`

- [ ] **Step 1: Update docs to match the implemented runtime**

Document:

- the React / React Native host adapter
- reactive state consumption
- tool schemas and metadata
- snapshot invalidation semantics
- trace lifecycle
- effect contracts
- clear framework / business boundary

- [ ] **Step 2: Run the full package verification**

Run: `pnpm -C mobile-ai-native test:run`
Expected: PASS with all package tests green

- [ ] **Step 3: Run the build verification**

Run: `pnpm -C mobile-ai-native build`
Expected: PASS

- [ ] **Step 4: Review changed files**

Run: `git diff --stat`
Expected: only runtime-core hardening files and docs are touched

- [ ] **Step 5: Commit**

```bash
git add mobile-ai-native/README.md \
  mobile-ai-native/GUIDE.md \
  docs/superpowers/specs/2026-03-24-mobile-ai-native-framework-technical-design.md \
  docs/superpowers/specs/2026-03-24-ai-calendar-framework-gap-analysis.md
git commit -m "docs: document hardened mobile ai runtime core"
```

## Final Verification Checklist

- [ ] React host runtime exists and is the preferred GUI integration path
- [ ] GUI state hooks are subscription-based, not one-shot reads
- [ ] `visibleTools` expose schema and metadata
- [ ] snapshot registry returns deterministic `SNAPSHOT_NOT_FOUND` and `SNAPSHOT_STALE`
- [ ] successful state-changing tool calls stale the originating snapshot
- [ ] trace lifecycle is queryable by host and GUI
- [ ] effect runtime contract is explicit and tested
- [ ] full `mobile-ai-native` test suite passes
- [ ] `mobile-ai-native` builds successfully

## Notes For The Implementer

- Do not add calendar-specific logic to the framework core.
- Do not auto-generate TUI from GUI.
- Do not regress from semantic domain actions to UI click simulation.
- Keep the package useful as a runtime core, not as a full product shell.
