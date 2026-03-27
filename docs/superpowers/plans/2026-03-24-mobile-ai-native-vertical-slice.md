# Mobile AI-Native Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one end-to-end vertical slice that proves the mobile AI-native framework spine works: `State -> SnapshotBundle -> Tool Call(ref_id + snapshotId) -> Action -> Event/Effect -> State -> GUI/TUI refresh`.

**Architecture:** Create a new root package `mobile-ai-native/` that contains the new framework core instead of modifying current `sdk/` or `runtime/` directly. Keep the first slice host-agnostic and test it with Preact + Happy DOM so we can validate the protocol before introducing a real React Native host.

**Tech Stack:** TypeScript, Vitest, Preact, Happy DOM, Zod

---

## File Structure

### New package

- `mobile-ai-native/package.json`
  Package manifest and test/build scripts.
- `mobile-ai-native/tsconfig.json`
  TypeScript config for the new package.
- `mobile-ai-native/src/index.ts`
  Public exports for the vertical slice.

### Core runtime

- `mobile-ai-native/src/core/types.ts`
  Shared framework types: `AppState`, `ActionResult`, `SnapshotBundle`, `RefIndexEntry`, `ToolDefinition`.
- `mobile-ai-native/src/core/state/createStore.ts`
  Event-driven state store and subscription model.
- `mobile-ai-native/src/core/action/defineAction.ts`
  Public `defineAction()` helper and metadata typing.
- `mobile-ai-native/src/core/action/createActionRuntime.ts`
  Action execution, visibility checks, schema validation, effect coordination, trace updates.
- `mobile-ai-native/src/core/effect/types.ts`
  Effect interfaces and context types.
- `mobile-ai-native/src/core/snapshot/createSnapshotBundle.ts`
  Build atomic `SnapshotBundle` objects with `snapshotId`, `tui`, `refIndex`, `visibleTools`.
- `mobile-ai-native/src/core/ref/ref-index.ts`
  Ref index collector and serializable payload helpers.

### Ref authoring APIs

- `mobile-ai-native/src/ref/useDataRef.ts`
  Single-object ref hook returning formatter.
- `mobile-ai-native/src/ref/useArrayRef.ts`
  Array ref hook returning `[listRef, itemRef]`.
- `mobile-ai-native/src/ref/RefContext.tsx`
  Render-scoped ref registration context.

### Projections and bridge

- `mobile-ai-native/src/projection/tui/renderTUI.tsx`
  Render handwritten TUI to string while collecting refs.
- `mobile-ai-native/src/projection/gui/AppProvider.tsx`
  Shared provider for state/action access in GUI and TUI.
- `mobile-ai-native/src/projection/gui/hooks.ts`
  `useAppState()` and `useActions()`.
- `mobile-ai-native/src/tool/createToolBridge.ts`
  `listTools()`, `getSnapshotBundle()`, `executeTool(name, input, snapshotId)`.

### Vertical slice demo

- `mobile-ai-native/src/demo/inbox/state.ts`
  `InboxState`, reducer, initial state.
- `mobile-ai-native/src/demo/inbox/actions.ts`
  `switchTab`, `openMessage`, `searchMessages`.
- `mobile-ai-native/src/demo/inbox/effects.ts`
  Fake async search effect.
- `mobile-ai-native/src/demo/inbox/InboxGUI.tsx`
  Human-facing projection.
- `mobile-ai-native/src/demo/inbox/InboxTUI.tsx`
  LLM-facing handwritten TUI with `useDataRef` and `useArrayRef`.
- `mobile-ai-native/src/demo/inbox/createInboxApp.tsx`
  Wires state, actions, effects, GUI, TUI, tool bridge together.

### Tests

- `mobile-ai-native/test/ref-hooks.test.tsx`
  `useDataRef` / `useArrayRef` marker and ref index behavior.
- `mobile-ai-native/test/snapshot-bundle.test.tsx`
  Atomic snapshot generation and `snapshotId`.
- `mobile-ai-native/test/tool-bridge.test.tsx`
  Tool listing, visibility, and snapshot-scoped resolution.
- `mobile-ai-native/test/vertical-slice.e2e.test.tsx`
  One end-to-end flow proving GUI/TUI update from the same state.

## Task 1: Scaffold the New Package

**Files:**
- Create: `mobile-ai-native/package.json`
- Create: `mobile-ai-native/tsconfig.json`
- Create: `mobile-ai-native/src/index.ts`
- Create: `mobile-ai-native/test/smoke.test.ts`

- [ ] **Step 1: Write the failing smoke test**

```ts
import { describe, expect, it } from "vitest";
import { VERSION } from "../src/index";

describe("mobile-ai-native package", () => {
  it("exports a public entry point", () => {
    expect(VERSION).toBe("0.0.0");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile-ai-native && pnpm test -- --run test/smoke.test.ts`
Expected: FAIL with module resolution error for `../src/index`

- [ ] **Step 3: Add minimal package scaffold**

```json
{
  "name": "@aotui/mobile-ai-native",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest",
    "test:run": "vitest --run"
  },
  "dependencies": {
    "preact": "^10.28.1",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "happy-dom": "^20.5.3",
    "typescript": "^5.9.3",
    "vitest": "^3.2.4"
  }
}
```

```ts
export const VERSION = "0.0.0";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile-ai-native && pnpm test -- --run test/smoke.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ai-native/package.json mobile-ai-native/tsconfig.json mobile-ai-native/src/index.ts mobile-ai-native/test/smoke.test.ts
git commit -m "feat: scaffold mobile ai-native package"
```

## Task 2: Build the Event-Driven Core Store

**Files:**
- Create: `mobile-ai-native/src/core/types.ts`
- Create: `mobile-ai-native/src/core/state/createStore.ts`
- Test: `mobile-ai-native/test/store.test.ts`

- [ ] **Step 1: Write the failing store test**

```ts
import { describe, expect, it } from "vitest";
import { createStore } from "../src/core/state/createStore";

describe("createStore", () => {
  it("applies events through the reducer", () => {
    const store = createStore({
      initialState: { count: 0 },
      reduce(state, event: { type: "Incremented" }) {
        if (event.type === "Incremented") return { count: state.count + 1 };
        return state;
      },
    });

    store.emit({ type: "Incremented" });
    expect(store.getState()).toEqual({ count: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile-ai-native && pnpm test -- --run test/store.test.ts`
Expected: FAIL with `createStore` missing

- [ ] **Step 3: Implement the minimal store**

```ts
export function createStore<State, Event>(config: {
  initialState: State;
  reduce(state: State, event: Event): State;
}) {
  let state = config.initialState;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,
    emit(event: Event) {
      state = config.reduce(state, event);
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile-ai-native && pnpm test -- --run test/store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ai-native/src/core/types.ts mobile-ai-native/src/core/state/createStore.ts mobile-ai-native/test/store.test.ts
git commit -m "feat: add event-driven store"
```

## Task 3: Implement Ref APIs and Snapshot Bundle Generation

**Files:**
- Create: `mobile-ai-native/src/core/ref/ref-index.ts`
- Create: `mobile-ai-native/src/ref/RefContext.tsx`
- Create: `mobile-ai-native/src/ref/useDataRef.ts`
- Create: `mobile-ai-native/src/ref/useArrayRef.ts`
- Create: `mobile-ai-native/src/core/snapshot/createSnapshotBundle.ts`
- Create: `mobile-ai-native/src/projection/tui/renderTUI.tsx`
- Test: `mobile-ai-native/test/ref-hooks.test.tsx`
- Test: `mobile-ai-native/test/snapshot-bundle.test.tsx`

- [ ] **Step 1: Write the failing ref hook tests**

```tsx
it("useDataRef returns a formatter and registers serialized payload", () => {
  const message = { id: "m1", subject: "Welcome back" };
  const bundle = renderTUITestApp(() => {
    const ref = useDataRef("message", message, "messages[0]");
    return <text>{ref("Pinned message")}</text>;
  });

  expect(bundle.tui).toContain("(Pinned message)[message:messages[0]]");
  expect(bundle.refIndex["messages[0]"]).toEqual({
    type: "message",
    value: { id: "m1", subject: "Welcome back" },
  });
});

it("useArrayRef registers both list and item refs", () => {
  const messages = [{ id: "m1" }, { id: "m2" }];
  const bundle = renderTUITestApp(() => {
    const [listRef, itemRef] = useArrayRef("message", messages, "messages");
    return (
      <screen>
        <text>{listRef("All messages")}</text>
        <text>{itemRef(1, "Second")}</text>
      </screen>
    );
  });

  expect(bundle.refIndex["messages"]).toEqual({
    type: "message[]",
    value: [{ id: "m1" }, { id: "m2" }],
  });
  expect(bundle.refIndex["messages[1]"]).toEqual({
    type: "message",
    value: { id: "m2" },
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mobile-ai-native && pnpm test -- --run test/ref-hooks.test.tsx test/snapshot-bundle.test.tsx`
Expected: FAIL with missing ref APIs and renderer

- [ ] **Step 3: Implement the minimal ref collector and snapshot bundle**

```ts
export type RefIndexEntry = {
  type: string;
  value: unknown;
};

export function createRefCollector() {
  const refIndex: Record<string, RefIndexEntry> = {};

  return {
    register(refId: string, entry: RefIndexEntry) {
      refIndex[refId] = structuredClone(entry);
    },
    snapshot() {
      return structuredClone(refIndex);
    },
  };
}
```

```tsx
export function useDataRef(type: string, data: object, refId: string) {
  const registry = useRefRegistry();
  return (content: string) => {
    registry.register(refId, { type, value: data });
    return `(${content})[${type}:${refId}]`;
  };
}
```

```tsx
export function useArrayRef(type: string, data: object[], refId: string) {
  const registry = useRefRegistry();

  const listRef = (content: string) => {
    registry.register(refId, { type: `${type}[]`, value: data });
    return `(${content})[${type}[]:${refId}]`;
  };

  const itemRef = (index: number, content: string) => {
    registry.register(`${refId}[${index}]`, { type, value: data[index] });
    return `(${content})[${type}:${refId}[${index}]]`;
  };

  return [listRef, itemRef] as const;
}
```

- [ ] **Step 4: Implement atomic snapshot bundle creation**

```ts
export function createSnapshotBundle(input: {
  tui: string;
  refIndex: Record<string, RefIndexEntry>;
  visibleTools: ToolDefinition[];
}) {
  return {
    snapshotId: `snap_${Date.now()}`,
    generatedAt: Date.now(),
    tui: input.tui,
    refIndex: input.refIndex,
    visibleTools: input.visibleTools,
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd mobile-ai-native && pnpm test -- --run test/ref-hooks.test.tsx test/snapshot-bundle.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add mobile-ai-native/src/core/ref/ref-index.ts mobile-ai-native/src/ref/RefContext.tsx mobile-ai-native/src/ref/useDataRef.ts mobile-ai-native/src/ref/useArrayRef.ts mobile-ai-native/src/core/snapshot/createSnapshotBundle.ts mobile-ai-native/src/projection/tui/renderTUI.tsx mobile-ai-native/test/ref-hooks.test.tsx mobile-ai-native/test/snapshot-bundle.test.tsx
git commit -m "feat: add ref hooks and snapshot bundle"
```

## Task 4: Implement Action Runtime and Snapshot-Scoped Tool Bridge

**Files:**
- Create: `mobile-ai-native/src/core/action/defineAction.ts`
- Create: `mobile-ai-native/src/core/action/createActionRuntime.ts`
- Create: `mobile-ai-native/src/core/effect/types.ts`
- Create: `mobile-ai-native/src/tool/createToolBridge.ts`
- Test: `mobile-ai-native/test/tool-bridge.test.ts`

- [ ] **Step 1: Write the failing tool bridge tests**

```ts
it("lists only visible tools from current state", () => {
  const bridge = createTestBridge({ currentTab: "inbox" });
  expect(bridge.listTools().map((tool) => tool.name)).toEqual(["openMessage", "searchMessages"]);
});

it("resolves ref args from the originating snapshot", async () => {
  const bridge = createTestBridge();
  const snapshot = bridge.getSnapshotBundle();

  const result = await bridge.executeTool(
    "openMessage",
    { message: "messages[0]" },
    snapshot.snapshotId,
  );

  expect(result.success).toBe(true);
  expect(result.data).toEqual({ openedMessageId: "m1" });
});

it("rejects stale snapshot ids", async () => {
  const bridge = createTestBridge();
  const result = await bridge.executeTool("openMessage", { message: "messages[0]" }, "snap_old");
  expect(result.success).toBe(false);
  expect(result.error?.code).toBe("SNAPSHOT_NOT_FOUND");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mobile-ai-native && pnpm test -- --run test/tool-bridge.test.ts`
Expected: FAIL with missing action runtime and tool bridge

- [ ] **Step 3: Implement minimal `defineAction()` and action runtime**

```ts
export function defineAction<State, Input>(config: {
  name: string;
  description: string;
  schema: z.ZodType<Input>;
  visibility(state: State): boolean;
  handler(ctx: ActionContext<State>, input: Input): Promise<ActionResult> | ActionResult;
}) {
  return config;
}
```

```ts
export async function executeAction(...) {
  const parsed = action.schema.parse(input);
  if (!action.visibility(store.getState())) {
    return { success: false, error: { code: "ACTION_NOT_VISIBLE", message: "Tool is not currently visible" } };
  }
  return action.handler(ctx, parsed);
}
```

- [ ] **Step 4: Implement snapshot-scoped tool bridge**

```ts
export function createToolBridge(...) {
  const snapshots = new Map<string, SnapshotBundle>();

  return {
    listTools() { ... },
    getSnapshotBundle() {
      const snapshot = renderCurrentSnapshot();
      snapshots.set(snapshot.snapshotId, snapshot);
      return snapshot;
    },
    async executeTool(name, input, snapshotId) {
      const snapshot = snapshots.get(snapshotId);
      if (!snapshot) {
        return { success: false, error: { code: "SNAPSHOT_NOT_FOUND", message: "Snapshot expired or missing" } };
      }
      const resolved = resolveRefArgs(input, snapshot.refIndex);
      return executeAction(name, resolved);
    },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd mobile-ai-native && pnpm test -- --run test/tool-bridge.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add mobile-ai-native/src/core/action/defineAction.ts mobile-ai-native/src/core/action/createActionRuntime.ts mobile-ai-native/src/core/effect/types.ts mobile-ai-native/src/tool/createToolBridge.ts mobile-ai-native/test/tool-bridge.test.ts
git commit -m "feat: add snapshot-scoped tool bridge"
```

## Task 5: Build the Inbox Vertical Slice Demo

**Files:**
- Create: `mobile-ai-native/src/demo/inbox/state.ts`
- Create: `mobile-ai-native/src/demo/inbox/actions.ts`
- Create: `mobile-ai-native/src/demo/inbox/effects.ts`
- Create: `mobile-ai-native/src/demo/inbox/InboxGUI.tsx`
- Create: `mobile-ai-native/src/demo/inbox/InboxTUI.tsx`
- Create: `mobile-ai-native/src/demo/inbox/createInboxApp.tsx`
- Create: `mobile-ai-native/src/projection/gui/AppProvider.tsx`
- Create: `mobile-ai-native/src/projection/gui/hooks.ts`
- Test: `mobile-ai-native/test/vertical-slice.e2e.test.tsx`

- [ ] **Step 1: Write the failing vertical slice test**

```tsx
it("keeps GUI and TUI in sync after a tool call", async () => {
  const app = createInboxApp({
    initialMessages: [{ id: "m1", subject: "Welcome back", opened: false }],
  });

  const firstSnapshot = app.bridge.getSnapshotBundle();
  expect(firstSnapshot.tui).toContain("(Welcome back)[message:messages[0]]");
  expect(app.gui.getVisibleSubjects()).toEqual(["Welcome back"]);

  const result = await app.bridge.executeTool(
    "openMessage",
    { message: "messages[0]" },
    firstSnapshot.snapshotId,
  );

  expect(result.success).toBe(true);
  expect(app.gui.getOpenedMessageId()).toBe("m1");
  expect(app.gui.getRecentTrace()).toContain("Opened message");

  const secondSnapshot = app.bridge.getSnapshotBundle();
  expect(secondSnapshot.tui).toContain("Opened: true");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile-ai-native && pnpm test -- --run test/vertical-slice.e2e.test.tsx`
Expected: FAIL with missing inbox demo app

- [ ] **Step 3: Implement demo state, reducer, and actions**

```ts
type InboxEvent =
  | { type: "MessageOpened"; messageId: string }
  | { type: "SearchStarted"; query: string }
  | { type: "SearchSucceeded"; query: string; items: Message[] };
```

```ts
const openMessage = defineAction({
  name: "openMessage",
  description: "Open a message from the inbox.",
  schema: z.object({ message: z.custom<MessageSnapshot>() }),
  visibility: (state) => state.shell.currentTab === "inbox",
  handler(ctx, input) {
    ctx.emit({ type: "MessageOpened", messageId: input.message.id });
    ctx.trace.success(`Opened message ${input.message.subject}`);
    return { success: true, data: { openedMessageId: input.message.id } };
  },
});
```

- [ ] **Step 4: Implement GUI and handwritten TUI**

```tsx
function InboxTUI() {
  const { state } = useAppState();
  const [messagesRef, messageRef] = useArrayRef("message", state.inbox.items, "messages");

  return (
    <screen name="Inbox">
      <text>{messagesRef("Inbox messages")}</text>
      {state.inbox.items.map((item, index) => (
        <item key={item.id}>{messageRef(index, item.subject)}</item>
      ))}
      <text>Opened: {String(Boolean(state.inbox.openedMessageId))}</text>
    </screen>
  );
}
```

- [ ] **Step 5: Implement one async effect action**

```ts
const searchMessages = defineAction({
  name: "searchMessages",
  description: "Search inbox messages by query.",
  schema: z.object({ query: z.string().min(1) }),
  visibility: (state) => state.shell.currentTab === "inbox",
  async handler(ctx, input) {
    await ctx.runEffect("searchMessages", input);
    return { success: true, message: `Started search for ${input.query}` };
  },
});
```

- [ ] **Step 6: Run the vertical slice test to verify it passes**

Run: `cd mobile-ai-native && pnpm test -- --run test/vertical-slice.e2e.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add mobile-ai-native/src/demo/inbox mobile-ai-native/src/projection/gui/AppProvider.tsx mobile-ai-native/src/projection/gui/hooks.ts mobile-ai-native/test/vertical-slice.e2e.test.tsx
git commit -m "feat: add inbox vertical slice demo"
```

## Task 6: Add Failure Cases and Guard Rails

**Files:**
- Modify: `mobile-ai-native/test/tool-bridge.test.ts`
- Modify: `mobile-ai-native/test/vertical-slice.e2e.test.tsx`
- Modify: `mobile-ai-native/src/tool/createToolBridge.ts`
- Modify: `mobile-ai-native/src/core/snapshot/createSnapshotBundle.ts`

- [ ] **Step 1: Write failing tests for stale refs and visibility**

```ts
it("rejects ref ids missing from the snapshot bundle", async () => {
  const bridge = createTestBridge();
  const snapshot = bridge.getSnapshotBundle();
  const result = await bridge.executeTool(
    "openMessage",
    { message: "messages[99]" },
    snapshot.snapshotId,
  );
  expect(result.success).toBe(false);
  expect(result.error?.code).toBe("REF_NOT_FOUND");
});

it("hides tools when state says invisible", () => {
  const bridge = createTestBridge({ currentTab: "settings" });
  expect(bridge.listTools()).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd mobile-ai-native && pnpm test -- --run test/tool-bridge.test.ts test/vertical-slice.e2e.test.tsx`
Expected: FAIL with missing guard behavior

- [ ] **Step 3: Implement explicit error handling**

```ts
if (!(refId in snapshot.refIndex)) {
  return {
    success: false,
    error: { code: "REF_NOT_FOUND", message: `Reference ${refId} not found in snapshot ${snapshotId}` },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mobile-ai-native && pnpm test -- --run test/tool-bridge.test.ts test/vertical-slice.e2e.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ai-native/src/tool/createToolBridge.ts mobile-ai-native/src/core/snapshot/createSnapshotBundle.ts mobile-ai-native/test/tool-bridge.test.ts mobile-ai-native/test/vertical-slice.e2e.test.tsx
git commit -m "feat: add snapshot guard rails"
```

## Task 7: Document the Vertical Slice and Verify the Package

**Files:**
- Create: `mobile-ai-native/README.md`
- Modify: `mobile-ai-native/src/index.ts`

- [ ] **Step 1: Write the failing documentation smoke check**

```ts
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";

it("documents snapshot-scoped tool execution", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  expect(readme).toContain("snapshotId");
  expect(readme).toContain("useDataRef");
  expect(readme).toContain("useArrayRef");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile-ai-native && pnpm test -- --run test/readme.test.ts`
Expected: FAIL because `README.md` is missing

- [ ] **Step 3: Write the package README**

Document:

- what the vertical slice proves
- the `SnapshotBundle` contract
- `useDataRef` / `useArrayRef`
- `executeTool(name, input, snapshotId)`
- why `refIndex` stores serializable snapshot payloads

- [ ] **Step 4: Run the full package test suite**

Run: `cd mobile-ai-native && pnpm test:run`
Expected: PASS

- [ ] **Step 5: Build the package**

Run: `cd mobile-ai-native && pnpm build`
Expected: PASS with TypeScript output and no type errors

- [ ] **Step 6: Commit**

```bash
git add mobile-ai-native/README.md mobile-ai-native/src/index.ts mobile-ai-native/test
git commit -m "docs: document mobile ai-native vertical slice"
```

## Exit Criteria

The vertical slice is complete only when all of these are true:

- `SnapshotBundle` is generated atomically with `snapshotId`, `tui`, `refIndex`, and `visibleTools`
- `useDataRef` and `useArrayRef` both generate markers and register serializable snapshot payloads
- tool execution resolves refs against the exact snapshot the LLM saw
- one pure local action and one async effect action both work
- GUI and TUI both reflect the same post-action state
- stale `snapshotId` and missing `ref_id` fail cleanly
- the package builds and all tests pass

## Notes for Execution

- Do not add a real React Native dependency in this slice.
  The point of this slice is to prove the framework protocol, not the iOS host.
- Do not try to preserve compatibility with current `@aotui/sdk` hook signatures.
  This is a new package and a new contract.
- Keep the demo feature intentionally tiny.
  If the inbox slice starts to grow, cut scope instead of adding more abstractions.
