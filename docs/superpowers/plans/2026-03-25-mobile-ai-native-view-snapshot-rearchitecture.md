# Mobile AI-Native View Snapshot Rearchitecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `mobile-ai-native` snapshot generation from a single TUI string into a view-based xml+markdown runtime contract with a static `RootView`, state-derived mounted business views, and `ViewType`-scoped tool exposure.

**Architecture:** Keep the AOTUI-style authoring model at the top: developers still compose semantic `View`s and attach tools to `ViewType`s. Replace the desktop-style `ViewTree` mechanics underneath with a lighter mobile runtime: static `RootView` + state-derived mounted views + one atomic snapshot assembler that emits ordered `<View>` fragments, `refIndex`, and visible tools from the same render tick.

**Tech Stack:** TypeScript, Preact JSX for semantic TUI authoring, Vitest, existing `mobile-ai-native` state/action/effect runtime.

---

## File Structure

### Existing files to modify

- `mobile-ai-native/src/core/types.ts`
  Add first-class view fragment, view catalog, mounted view projection, and new snapshot bundle shape.
- `mobile-ai-native/src/index.ts`
  Export the new view/snapshot APIs.
- `mobile-ai-native/src/projection/tui/renderTUI.tsx`
  Replace single-node rendering with view-aware rendering helpers or narrow it into a backward-compatible wrapper.
- `mobile-ai-native/src/tool/createToolBridge.ts`
  Read the new snapshot shape and list visible tools from view-aware runtime data.
- `mobile-ai-native/src/core/action/createActionRuntime.ts`
  Support `ViewType`-scoped tool listing from current relevant/mounted view types plus `visibility(state)`.
- `mobile-ai-native/src/demo/inbox/InboxTUI.tsx`
  Split the current one-piece TUI into a static `RootView` plus mounted business views.
- `mobile-ai-native/src/demo/inbox/createInboxApp.tsx`
  Switch demo snapshot generation to the new assembler path.
- `mobile-ai-native/README.md`
  Document the new snapshot model and authoring flow.
- `mobile-ai-native/GUIDE.md`
  Update usage guidance to explain static `RootView`, mounted views, and `ViewType`-scoped tools.
- `docs/superpowers/specs/2026-03-24-mobile-ai-native-framework-technical-design.md`
  Keep the implementation notes aligned if any detail changes during execution.

### New files to create

- `mobile-ai-native/src/projection/tui/View.tsx`
  Minimal semantic `View` authoring primitive for mobile snapshot composition.
- `mobile-ai-native/src/projection/tui/types.ts`
  Local view projection types if keeping `core/types.ts` smaller is cleaner.
- `mobile-ai-native/src/projection/tui/renderViewFragment.tsx`
  Render a single semantic view into `{ id, type, name, markup }`.
- `mobile-ai-native/src/projection/tui/renderSnapshotDocument.ts`
  Wrap ordered view fragments into final xml+markdown markup.
- `mobile-ai-native/src/projection/tui/createSnapshotAssembler.ts`
  Produce one atomic `SnapshotBundle` from `RootView`, mounted views, `refIndex`, and visible tools.
- `mobile-ai-native/src/core/action/defineViewTypeTool.ts`
  Developer-facing definition helper for `ViewType`-scoped tools.
- `mobile-ai-native/test/view-snapshot.test.tsx`
  Verify ordered `<View>` fragment rendering and root-first assembly.
- `mobile-ai-native/test/view-type-tools.test.ts`
  Verify `ViewType`-scoped tool visibility rules.

### Existing tests to update

- `mobile-ai-native/test/public-api.test.ts`
  Ensure new public exports are present.
- `mobile-ai-native/test/snapshot-bundle.test.ts`
  Validate new `SnapshotBundle` shape and atomic bundle creation.
- `mobile-ai-native/test/tool-bridge.test.ts`
  Ensure bridge still resolves refs and respects stale semantics with the new bundle format.
- `mobile-ai-native/test/vertical-slice.e2e.test.tsx`
  Prove `RootView + mounted views + tool execution + GUI refresh` end to end.

## Task 1: Define the New View-Centric Runtime Types

**Files:**
- Modify: `mobile-ai-native/src/core/types.ts`
- Modify: `mobile-ai-native/src/index.ts`
- Test: `mobile-ai-native/test/public-api.test.ts`
- Test: `mobile-ai-native/test/snapshot-bundle.test.ts`

- [ ] **Step 1: Write the failing type/export tests**

Add tests that expect:

```ts
expectTypeOf<SnapshotBundle>().toMatchTypeOf<{
  snapshotId: string;
  markup: string;
  views: readonly ViewFragment[];
  refIndex: Record<string, RefIndexEntry>;
  visibleTools: readonly ToolDefinition[];
}>();
```

and assert public exports for:

```ts
expect(packageExports).toHaveProperty("View");
expect(packageExports).toHaveProperty("defineViewTypeTool");
expect(packageExports).toHaveProperty("createSnapshotAssembler");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -C mobile-ai-native test:run -- test/public-api.test.ts test/snapshot-bundle.test.ts`
Expected: FAIL because the new view-centric types and exports do not exist yet.

- [ ] **Step 3: Add minimal types and exports**

Add these core shapes:

```ts
type ViewFragment = {
  id: string;
  type: string;
  name: string;
  markup: string;
};

type StaticViewCatalogEntry = {
  type: string;
  description: string;
  enterFrom?: readonly string[];
  actions: readonly string[];
};

type MountedViewDescriptor<State> = {
  id: string;
  type: string;
  name: string;
  render: (state: State) => ComponentChild;
};
```

Update `SnapshotBundle` to include:

```ts
type SnapshotBundle = {
  snapshotId: string;
  generatedAt: number;
  markup: string;
  views: readonly ViewFragment[];
  refIndex: Record<string, RefIndexEntry>;
  visibleTools: readonly ToolDefinition[];
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -C mobile-ai-native test:run -- test/public-api.test.ts test/snapshot-bundle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ai-native/src/core/types.ts mobile-ai-native/src/index.ts mobile-ai-native/test/public-api.test.ts mobile-ai-native/test/snapshot-bundle.test.ts
git commit -m "feat: add view-centric snapshot runtime types"
```

## Task 2: Build Semantic View Rendering and Snapshot Assembly

**Files:**
- Create: `mobile-ai-native/src/projection/tui/View.tsx`
- Create: `mobile-ai-native/src/projection/tui/renderViewFragment.tsx`
- Create: `mobile-ai-native/src/projection/tui/renderSnapshotDocument.ts`
- Create: `mobile-ai-native/src/projection/tui/createSnapshotAssembler.ts`
- Modify: `mobile-ai-native/src/projection/tui/renderTUI.tsx`
- Test: `mobile-ai-native/test/view-snapshot.test.tsx`
- Test: `mobile-ai-native/test/snapshot-bundle.test.ts`

- [ ] **Step 1: Write the failing snapshot assembly tests**

Add tests for:

```ts
it("renders root view first and preserves ordered business views", () => {
  expect(bundle.views.map((view) => view.type)).toEqual([
    "Root",
    "Workspace",
    "FileDetail",
  ]);
  expect(bundle.markup).toContain('<View id="root" type="Root" name="Navigation">');
});
```

and:

```ts
it("builds markup, views, refIndex, and visibleTools from the same render tick", () => {
  expect(bundle.views).toHaveLength(2);
  expect(Object.keys(bundle.refIndex)).toContain("messages[0]");
  expect(bundle.visibleTools[0]?.name).toBe("openMessage");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -C mobile-ai-native test:run -- test/view-snapshot.test.tsx test/snapshot-bundle.test.ts`
Expected: FAIL because there is no semantic view renderer or snapshot assembler yet.

- [ ] **Step 3: Implement the minimal semantic `View` primitive and fragment renderer**

Use a small, focused approach:

```tsx
export function View(props: ViewProps) {
  return props.children;
}
```

and render through explicit metadata passed into `renderViewFragment(...)`, not through desktop-style tree bookkeeping.

- [ ] **Step 4: Implement `renderSnapshotDocument` and `createSnapshotAssembler`**

`renderSnapshotDocument` should produce:

```xml
<View id="root" type="Root" name="Navigation">...</View>
<View id="workspace" type="Workspace" name="Workspace">...</View>
```

`createSnapshotAssembler` should:

- require `RootView` first
- take already ordered business view fragments
- create one atomic `SnapshotBundle`

- [ ] **Step 5: Keep `renderTUI` as a compatibility wrapper or redirector**

Do not break callers abruptly.
Either:

- keep `renderTUI` but make it delegate to `createSnapshotAssembler`, or
- leave a thin wrapper with a deprecation comment

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm -C mobile-ai-native test:run -- test/view-snapshot.test.tsx test/snapshot-bundle.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add mobile-ai-native/src/projection/tui/View.tsx mobile-ai-native/src/projection/tui/renderViewFragment.tsx mobile-ai-native/src/projection/tui/renderSnapshotDocument.ts mobile-ai-native/src/projection/tui/createSnapshotAssembler.ts mobile-ai-native/src/projection/tui/renderTUI.tsx mobile-ai-native/test/view-snapshot.test.tsx mobile-ai-native/test/snapshot-bundle.test.ts
git commit -m "feat: add semantic view snapshot assembler"
```

## Task 3: Add `ViewType`-Scoped Tool Definitions

**Files:**
- Create: `mobile-ai-native/src/core/action/defineViewTypeTool.ts`
- Modify: `mobile-ai-native/src/core/types.ts`
- Modify: `mobile-ai-native/src/core/action/createActionRuntime.ts`
- Test: `mobile-ai-native/test/view-type-tools.test.ts`
- Test: `mobile-ai-native/test/tool-bridge.test.ts`

- [ ] **Step 1: Write the failing `ViewType` tool tests**

Add tests for:

```ts
it("only lists tools whose view type is currently relevant", () => {
  expect(runtime.listVisibleTools(["Workspace"]).map((tool) => tool.name)).toEqual([
    "open_file",
  ]);
});
```

and:

```ts
it("still applies visibility(state) after view type filtering", () => {
  expect(runtime.listVisibleTools(["FileDetail"]).map((tool) => tool.name)).not.toContain("edit_file");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -C mobile-ai-native test:run -- test/view-type-tools.test.ts test/tool-bridge.test.ts`
Expected: FAIL because runtime tools are not yet scoped to `ViewType`.

- [ ] **Step 3: Implement `defineViewTypeTool` and runtime filtering**

Introduce a focused shape:

```ts
type ViewTypeToolDefinition<State> = {
  viewType: string;
  name: string;
  description: string;
  inputSchema: ZodTypeAny;
  meta?: Record<string, unknown>;
  visibility?: (state: State) => boolean;
  handler: ...;
};
```

Teach `createActionRuntime` to evaluate:

`relevantViewTypes + visibility(state)`

instead of only `visibility(state)`.

- [ ] **Step 4: Keep bridge API ergonomic**

`createToolBridge` should continue exposing:

```ts
listTools();
getSnapshotBundle();
executeTool(name, input, snapshotId);
```

but internally it should use the view-aware visible tool list.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm -C mobile-ai-native test:run -- test/view-type-tools.test.ts test/tool-bridge.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add mobile-ai-native/src/core/action/defineViewTypeTool.ts mobile-ai-native/src/core/types.ts mobile-ai-native/src/core/action/createActionRuntime.ts mobile-ai-native/test/view-type-tools.test.ts mobile-ai-native/test/tool-bridge.test.ts
git commit -m "feat: scope tools by view type"
```

## Task 4: Migrate the Inbox Demo to Static RootView + Mounted Business Views

**Files:**
- Modify: `mobile-ai-native/src/demo/inbox/InboxTUI.tsx`
- Modify: `mobile-ai-native/src/demo/inbox/actions.ts`
- Modify: `mobile-ai-native/src/demo/inbox/createInboxApp.tsx`
- Test: `mobile-ai-native/test/vertical-slice.e2e.test.tsx`
- Test: `mobile-ai-native/test/react-runtime.test.tsx`

- [ ] **Step 1: Write the failing demo migration tests**

Add expectations like:

```ts
expect(bundle.views[0]?.type).toBe("Root");
expect(bundle.views.some((view) => view.type === "Inbox")).toBe(true);
expect(bundle.markup).toContain("App Navigation");
```

and:

```ts
expect(bundle.visibleTools.map((tool) => tool.name)).toContain("openMessage");
expect(bundle.visibleTools.map((tool) => tool.name)).not.toContain("searchMessages");
```

for a state where search is not currently relevant.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -C mobile-ai-native test:run -- test/vertical-slice.e2e.test.tsx test/react-runtime.test.tsx`
Expected: FAIL because the demo still renders one-piece TUI.

- [ ] **Step 3: Split demo TUI into static root + mounted business views**

`InboxTUI.tsx` should stop behaving like one giant screen.
Instead define:

- static root navigation content
- always-mounted inbox/workspace-like business view
- conditional detail/result views when state calls for them

- [ ] **Step 4: Scope demo tools to view types**

Examples:

- `openMessage` belongs to the inbox list view type
- detail actions belong to detail view type

Use current state to decide which ones surface.

- [ ] **Step 5: Update snapshot creation in `createInboxApp.tsx`**

Replace the old:

`renderTUI(<InboxTUI />)`

style path with:

`RootView + mounted descriptors + snapshot assembler`

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm -C mobile-ai-native test:run -- test/vertical-slice.e2e.test.tsx test/react-runtime.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add mobile-ai-native/src/demo/inbox/InboxTUI.tsx mobile-ai-native/src/demo/inbox/actions.ts mobile-ai-native/src/demo/inbox/createInboxApp.tsx mobile-ai-native/test/vertical-slice.e2e.test.tsx mobile-ai-native/test/react-runtime.test.tsx
git commit -m "feat: migrate inbox demo to view-based snapshot"
```

## Task 5: Harden Snapshot/Bridge Semantics Against Regression

**Files:**
- Modify: `mobile-ai-native/src/tool/createToolBridge.ts`
- Modify: `mobile-ai-native/src/core/snapshot/createSnapshotBundle.ts`
- Test: `mobile-ai-native/test/tool-bridge.test.ts`
- Test: `mobile-ai-native/test/snapshot-registry.test.ts`
- Test: `mobile-ai-native/test/view-snapshot.test.tsx`

- [ ] **Step 1: Write the failing regression tests**

Add cases that prove:

```ts
it("resolves refs from the originating view-based snapshot bundle", async () => {
  expect(result.success).toBe(true);
});

it("marks the originating snapshot stale after a successful state-changing tool execution", async () => {
  expect(retry.error?.code).toBe("SNAPSHOT_STALE");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm -C mobile-ai-native test:run -- test/tool-bridge.test.ts test/snapshot-registry.test.ts test/view-snapshot.test.tsx`
Expected: FAIL if any code path still assumes `snapshot.tui` instead of the new assembled shape.

- [ ] **Step 3: Update bridge and bundle hardening**

Ensure:

- bridge reads `markup` and `views` bundle shape correctly
- stale snapshot semantics remain unchanged
- `refIndex`, `visibleTools`, and rendered views always come from one render tick

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm -C mobile-ai-native test:run -- test/tool-bridge.test.ts test/snapshot-registry.test.ts test/view-snapshot.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile-ai-native/src/tool/createToolBridge.ts mobile-ai-native/src/core/snapshot/createSnapshotBundle.ts mobile-ai-native/test/tool-bridge.test.ts mobile-ai-native/test/snapshot-registry.test.ts mobile-ai-native/test/view-snapshot.test.tsx
git commit -m "fix: preserve snapshot bridge semantics for view-based bundles"
```

## Task 6: Update Docs and Final Verification

**Files:**
- Modify: `mobile-ai-native/README.md`
- Modify: `mobile-ai-native/GUIDE.md`
- Modify: `docs/superpowers/specs/2026-03-24-mobile-ai-native-framework-technical-design.md`

- [ ] **Step 1: Update package docs**

Document:

- `RootView` is static navigation
- business views are state-derived runtime reality
- tools are `ViewType`-scoped and state-filtered
- snapshot is xml+markdown composed from ordered `<View>` fragments

- [ ] **Step 2: Run full tests**

Run: `pnpm -C mobile-ai-native test:run`
Expected: PASS

- [ ] **Step 3: Run build**

Run: `pnpm -C mobile-ai-native build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add mobile-ai-native/README.md mobile-ai-native/GUIDE.md docs/superpowers/specs/2026-03-24-mobile-ai-native-framework-technical-design.md
git commit -m "docs: describe view-based mobile snapshot model"
```

## Done Criteria

- [ ] `SnapshotBundle` uses ordered view fragments instead of a single unstructured TUI string
- [ ] `RootView` is static navigation and is always the first snapshot view
- [ ] current business views are derived from state and rendered as mounted runtime reality
- [ ] tools are scoped to `ViewType` and filtered by current state
- [ ] `refIndex`, visible tools, and rendered views remain atomic per `snapshotId`
- [ ] stale snapshot behavior still works after the rearchitecture
- [ ] inbox demo proves the new model end to end
- [ ] `pnpm -C mobile-ai-native test:run` passes
- [ ] `pnpm -C mobile-ai-native build` passes
