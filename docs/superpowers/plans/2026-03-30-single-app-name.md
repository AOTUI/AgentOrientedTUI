# Single App Name Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `app_name` the only app identity field across SDK authoring, runtime loading, CLI output, TUI snapshot display, tool naming, config storage, and persistence.

**Architecture:** Use `createTUIApp({ app_name })` as the single authoring source of truth. Keep runtime internals compatible where helpful, but remove all author-facing parallel name concepts and generate `aoapp.json` from built app metadata so manifest files stop being a competing source.

**Tech Stack:** TypeScript, Preact, Node.js ESM, Vitest, pnpm

---

## File Map

### SDK authoring and persistence

- Modify: `sdk/src/app-factory/createTUIApp.ts`
- Modify: `sdk/src/app-factory/createTUIApp.test.ts`
- Modify: `sdk/src/index.ts`
- Modify: `sdk/src/hooks/usePersistentState.ts`

### Runtime metadata, registry, worker, CLI

- Modify: `runtime/src/spi/app/app-kernel.interface.ts`
- Modify: `runtime/src/spi/app/app-factory.interface.ts`
- Modify: `runtime/src/spi/app/aoapp.ts`
- Modify: `runtime/src/engine/app/config.ts`
- Modify: `runtime/src/engine/app/registry.ts`
- Modify: `runtime/src/engine/app/registry.test.ts`
- Modify: `runtime/src/engine/view/snapshot/formatter.ts`
- Modify: `runtime/src/engine/view/snapshot/formatter.test.ts`
- Modify: `runtime/src/engine/view/snapshot/formatter.toolname.test.ts`
- Modify: `runtime/src/worker-runtime/app-kernel/AppKernel.ts`
- Modify: `runtime/src/worker-runtime/app-kernel/AppKernel.component.test.ts`
- Modify: `runtime/src/worker-runtime/index.ts`
- Modify: `runtime/src/cli.ts`
- Create: `runtime/src/cli.list.test.ts`

### Manifest generation

- Create: `scripts/generate-aoapp.mjs`
- Create: `scripts/generate-aoapp.test.mjs`

### Built-in app migration

- Modify: `aotui-ide/src/tui/SystemIDEApp.tsx`
- Modify: `aotui-ide/aoapp.json`
- Modify: `aotui-ide/package.json`
- Modify: `terminal-app/src/tui/TerminalApp.tsx`
- Modify: `terminal-app/aoapp.json`
- Modify: `terminal-app/package.json`
- Modify: `planning-app/src/tui/PlanningApp.tsx`
- Modify: `planning-app/aoapp.json`
- Modify: `planning-app/package.json`
- Modify: `lite-browser-app/src/tui/LiteBrowserApp.tsx`
- Modify: `lite-browser-app/aoapp.json`
- Modify: `lite-browser-app/package.json`
- Modify: `token-monitor-app/src/tui/TokenMonitorApp.tsx`
- Modify: `token-monitor-app/aoapp.json`
- Modify: `token-monitor-app/package.json`

### Docs

- Modify: `README.md`
- Modify: `DEVELOPMENT.md`
- Modify: `docs/runtime-sdk-driven-source-analysis.md`
- Create: `docs/superpowers/specs/2026-03-30-single-app-name-design.md`

### Planned canonical names

- `system_ide`
- `terminal`
- `planning_app`
- `lite_browser`
- `token_monitor`

### Important implementation note

The current main workspace contains an untracked `pnpm-workspace.yaml`. The isolated worktree created for implementation does not inherit that file. Before executing package-wide verification in the worktree, either:

- copy the workspace file into the worktree in a deliberate follow-up step, or
- run package-local verification from individual package directories that do not depend on workspace filters

### Task 1: Lock The New Metadata Contract In SDK

**Files:**
- Modify: `sdk/src/app-factory/createTUIApp.ts`
- Modify: `sdk/src/app-factory/createTUIApp.test.ts`
- Modify: `sdk/src/index.ts`

- [ ] **Step 1: Write failing SDK tests**

Extend `sdk/src/app-factory/createTUIApp.test.ts` to cover:
- accepts `app_name`
- rejects missing `app_name`
- rejects invalid `app_name`
- no longer requires `name`
- forwards the same canonical value into `kernelConfig.appName`

- [ ] **Step 2: Run the SDK app-factory test to verify failure**

Run: `pnpm -C sdk test:run -- src/app-factory/createTUIApp.test.ts`
Expected: FAIL because `createTUIApp` still expects `appName` and `name`.

- [ ] **Step 3: Implement the minimal SDK contract change**

In `sdk/src/app-factory/createTUIApp.ts`:
- rename author-facing input `appName` -> `app_name`
- remove author-facing `name`
- validate against `^[a-z0-9_]+$`
- set `kernelConfig.appName = config.app_name`
- set any remaining internal display/debug field to the same raw `app_name`
- update docs/examples in comments and `sdk/src/index.ts`

- [ ] **Step 4: Run the SDK app-factory test again**

Run: `pnpm -C sdk test:run -- src/app-factory/createTUIApp.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add sdk/src/app-factory/createTUIApp.ts sdk/src/app-factory/createTUIApp.test.ts sdk/src/index.ts
git commit -m "refactor: make app_name the only SDK app identity"
```

### Task 2: Unify Runtime Identity And Remove Fallback Naming

**Files:**
- Modify: `runtime/src/spi/app/app-kernel.interface.ts`
- Modify: `runtime/src/spi/app/app-factory.interface.ts`
- Modify: `runtime/src/spi/app/aoapp.ts`
- Modify: `runtime/src/engine/app/config.ts`
- Modify: `runtime/src/engine/app/registry.ts`
- Modify: `runtime/src/engine/app/registry.test.ts`
- Modify: `runtime/src/worker-runtime/app-kernel/AppKernel.ts`
- Modify: `runtime/src/worker-runtime/app-kernel/AppKernel.component.test.ts`
- Modify: `runtime/src/worker-runtime/index.ts`

- [ ] **Step 1: Write failing runtime metadata tests**

Add or extend tests to cover:
- registry key comes from app metadata, not alias/source basename
- runtime rejects load/install when canonical `app_name` is unavailable
- `AppKernel` tool prefix uses only the canonical `app_name`
- no display-name fallback path remains

- [ ] **Step 2: Run the focused runtime tests to verify failure**

Run:
- `pnpm -C runtime test:run -- src/engine/app/registry.test.ts`
- `pnpm -C runtime test:run -- src/worker-runtime/app-kernel/AppKernel.component.test.ts`

Expected: FAIL because registry and kernel still rely on old name fields.

- [ ] **Step 3: Implement the runtime identity cleanup**

In runtime metadata/config code:
- make `appName` required inside `AppKernelConfig`
- remove `displayName` as an identity source from `TUIAppFactory`
- change `AOAppManifest` to use `app_name` and drop `displayName`
- remove `alias` from config model
- remove `resolveRegistrationName(...)` fallback logic that invents names from source/package basenames
- require canonical app identity from factory metadata or generated manifest
- inject only one runtime env app namespace field for app persistence and lifecycle code

- [ ] **Step 4: Run the focused runtime tests again**

Run:
- `pnpm -C runtime test:run -- src/engine/app/registry.test.ts`
- `pnpm -C runtime test:run -- src/worker-runtime/app-kernel/AppKernel.component.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add runtime/src/spi/app runtime/src/engine/app runtime/src/worker-runtime
git commit -m "refactor: unify runtime app identity around app_name"
```

### Task 3: Make TUI Snapshot And CLI Display The Same Raw `app_name`

**Files:**
- Modify: `runtime/src/engine/view/snapshot/formatter.ts`
- Modify: `runtime/src/engine/view/snapshot/formatter.test.ts`
- Modify: `runtime/src/engine/view/snapshot/formatter.toolname.test.ts`
- Modify: `runtime/src/cli.ts`
- Create: `runtime/src/cli.list.test.ts`

- [ ] **Step 1: Write failing display-path tests**

Cover:
- Installed Applications list uses raw `app_name`
- structured snapshot `appName` uses raw `app_name`
- `agentina list` uses raw `app_name`
- output does not prefer manifest `displayName` or factory display metadata

- [ ] **Step 2: Run the display-path tests to verify failure**

Run:
- `pnpm -C runtime test:run -- src/engine/view/snapshot/formatter.test.ts src/engine/view/snapshot/formatter.toolname.test.ts`
- `pnpm -C runtime test:run -- src/cli.list.test.ts`

Expected: FAIL because formatter and CLI still use different naming paths.

- [ ] **Step 3: Implement the display cleanup**

Make the following behavior consistent:
- formatter uses installed app canonical name only
- CLI list prints canonical `app_name`
- CLI list no longer prefers `manifest.displayName` or `factory.displayName`

- [ ] **Step 4: Run the display-path tests again**

Run:
- `pnpm -C runtime test:run -- src/engine/view/snapshot/formatter.test.ts src/engine/view/snapshot/formatter.toolname.test.ts`
- `pnpm -C runtime test:run -- src/cli.list.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add runtime/src/engine/view/snapshot runtime/src/cli.ts runtime/src/cli.list.test.ts
git commit -m "refactor: show raw app_name in snapshot and CLI"
```

### Task 4: Unify Persistence Namespace And Remove Dual Env Keys

**Files:**
- Modify: `sdk/src/hooks/usePersistentState.ts`
- Modify: `runtime/src/engine/app/registry.ts`
- Test: `sdk/test/component-mode.test.tsx`
- Test: `runtime/src/engine/app/registry.test.ts`

- [ ] **Step 1: Write failing persistence tests**

Cover:
- runtime injects one canonical app namespace env field
- `usePersistentState` reads that field only
- persistence path uses canonical `app_name`
- old `AOTUI_APP_KEY` is no longer required for newly launched apps

- [ ] **Step 2: Run the persistence tests to verify failure**

Run:
- `pnpm -C sdk test:run -- test/component-mode.test.tsx`
- `pnpm -C runtime test:run -- src/engine/app/registry.test.ts`

Expected: FAIL because the old dual-key logic is still present.

- [ ] **Step 3: Implement the persistence namespace cleanup**

In `sdk/src/hooks/usePersistentState.ts`:
- read a single canonical env field
- remove fallback to `AOTUI_APP_KEY`

In runtime registry/launch config injection:
- inject only the canonical app namespace value

- [ ] **Step 4: Run the persistence tests again**

Run:
- `pnpm -C sdk test:run -- test/component-mode.test.tsx`
- `pnpm -C runtime test:run -- src/engine/app/registry.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add sdk/src/hooks/usePersistentState.ts sdk/test/component-mode.test.tsx runtime/src/engine/app/registry.ts runtime/src/engine/app/registry.test.ts
git commit -m "refactor: use app_name as the only persistence namespace"
```

### Task 5: Generate `aoapp.json` From Built App Metadata

**Files:**
- Create: `scripts/generate-aoapp.mjs`
- Create: `scripts/generate-aoapp.test.mjs`
- Modify: `aotui-ide/package.json`
- Modify: `terminal-app/package.json`
- Modify: `planning-app/package.json`
- Modify: `lite-browser-app/package.json`
- Modify: `token-monitor-app/package.json`

- [ ] **Step 1: Write failing generator tests**

Create a generator test that proves:
- built app metadata can be imported from `dist/index.js`
- emitted manifest contains `app_name`
- emitted manifest does not contain `name` or `displayName`
- version and entry metadata are preserved

- [ ] **Step 2: Run the generator test to verify failure**

Run: `node --test scripts/generate-aoapp.test.mjs`
Expected: FAIL because the generator does not exist yet.

- [ ] **Step 3: Implement the generator**

Build `scripts/generate-aoapp.mjs` to:
- read target app directory
- import `dist/index.js`
- inspect the default export for canonical app metadata
- read `package.json`
- write `aoapp.json`

Then update each built-in app package script so build becomes:
- TypeScript build
- manifest generation

- [ ] **Step 4: Run the generator test again**

Run: `node --test scripts/generate-aoapp.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-aoapp.mjs scripts/generate-aoapp.test.mjs aotui-ide/package.json terminal-app/package.json planning-app/package.json lite-browser-app/package.json token-monitor-app/package.json
git commit -m "build: generate aoapp manifests from app_name metadata"
```

### Task 6: Migrate Built-In Apps To Canonical `app_name`

**Files:**
- Modify: `aotui-ide/src/tui/SystemIDEApp.tsx`
- Modify: `terminal-app/src/tui/TerminalApp.tsx`
- Modify: `planning-app/src/tui/PlanningApp.tsx`
- Modify: `lite-browser-app/src/tui/LiteBrowserApp.tsx`
- Modify: `token-monitor-app/src/tui/TokenMonitorApp.tsx`
- Modify: `aotui-ide/aoapp.json`
- Modify: `terminal-app/aoapp.json`
- Modify: `planning-app/aoapp.json`
- Modify: `lite-browser-app/aoapp.json`
- Modify: `token-monitor-app/aoapp.json`
- Test: `planning-app/test/planning-app.test.ts`
- Test: `token-monitor-app/test/token-monitor-app.test.ts`

- [ ] **Step 1: Write or extend failing app-level tests**

Cover:
- each app exports the expected canonical `app_name`
- no app still declares `name` / `displayName` metadata
- generated manifest matches the same canonical value

- [ ] **Step 2: Run the focused app tests to verify failure**

Run:
- `pnpm -C planning-app test:run -- test/planning-app.test.ts`
- `pnpm -C token-monitor-app test:run -- test/token-monitor-app.test.ts`

Expected: FAIL because app definitions still use old fields.

- [ ] **Step 3: Update built-in app metadata**

Apply canonical names:
- `system_ide`
- `terminal`
- `planning_app`
- `lite_browser`
- `token_monitor`

Then regenerate `aoapp.json` for each app.

- [ ] **Step 4: Run the focused app tests again**

Run:
- `pnpm -C planning-app test:run -- test/planning-app.test.ts`
- `pnpm -C token-monitor-app test:run -- test/token-monitor-app.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add aotui-ide terminal-app planning-app lite-browser-app token-monitor-app
git commit -m "refactor: migrate built-in apps to canonical app_name"
```

### Task 7: Add Legacy Config Migration And End-To-End Verification

**Files:**
- Modify: `runtime/src/engine/app/registry.ts`
- Modify: `runtime/src/engine/app/registry.test.ts`
- Modify: `README.md`
- Modify: `DEVELOPMENT.md`
- Modify: `docs/runtime-sdk-driven-source-analysis.md`

- [ ] **Step 1: Write failing migration tests**

Cover:
- old config keys migrate to canonical `app_name`
- migration is idempotent
- duplicate old/new keys collapse cleanly
- runtime writes back only canonical keys

- [ ] **Step 2: Run the migration test to verify failure**

Run: `pnpm -C runtime test:run -- src/engine/app/registry.test.ts`
Expected: FAIL because config migration is not implemented.

- [ ] **Step 3: Implement migration and docs**

In runtime:
- migrate legacy config keys to canonical `app_name`
- save only canonical keys

In docs:
- state that app authors write exactly one name field: `app_name`
- document `aoapp.json` as generated metadata, not the identity source

- [ ] **Step 4: Run final focused verification**

Run:
- `pnpm -C sdk test:run`
- `pnpm -C runtime test:run`
- `pnpm -C planning-app test:run`
- `pnpm -C token-monitor-app test:run`
- `node --test scripts/generate-aoapp.test.mjs`

Expected: PASS

- [ ] **Step 5: Run manual spot checks**

Verify in a local run that:
- TUI installed apps show raw `app_name`
- `agentina list` shows raw `app_name`
- tool names use raw `app_name`
- generated manifests contain raw `app_name`
- `.agentina/config.json` uses raw `app_name` keys

- [ ] **Step 6: Commit**

```bash
git add runtime/src/engine/app/registry.ts runtime/src/engine/app/registry.test.ts README.md DEVELOPMENT.md docs/runtime-sdk-driven-source-analysis.md
git commit -m "docs: document canonical app_name identity model"
```
