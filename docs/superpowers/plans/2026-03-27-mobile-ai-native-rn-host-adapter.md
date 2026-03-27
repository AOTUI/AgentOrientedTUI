# Mobile AI-Native RN Host Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real React Native / Expo host adapter around the existing `mobile-ai-native` runtime core without collapsing host-specific logic back into the core package.

**Architecture:** Keep `mobile-ai-native` as a host-agnostic core, add a new adapter package for React Native / Expo integration, and prove the adapter with a real Expo reference app. Migrate host-facing hooks out of the core package step-by-step so behavior stays stable while package boundaries become honest.

**Tech Stack:** TypeScript, React, React Native, Expo, Vitest, pnpm workspaces

---

### Task 1: Create Adapter Package Skeleton

**Files:**
- Create: `packages/mobile-ai-native-react-native/package.json`
- Create: `packages/mobile-ai-native-react-native/tsconfig.json`
- Create: `packages/mobile-ai-native-react-native/src/index.ts`
- Modify: `pnpm-workspace.yaml`
- Test: `packages/mobile-ai-native-react-native/test/public-api.test.ts`

- [ ] **Step 1: Write the failing public API test**

Add a test that expects the new package to export:
- `createReactNativeAppRuntime`
- `AppRuntimeProvider`
- `useRuntimeState`
- `useRuntimeActions`
- `useRuntimeTrace`
- `useRuntimeSnapshot`

- [ ] **Step 2: Run the new package test to verify it fails**

Run: `pnpm -C packages/mobile-ai-native-react-native test:run -- test/public-api.test.ts`
Expected: FAIL because the package and exports do not exist yet.

- [ ] **Step 3: Add the minimal package skeleton**

Create the new workspace package with:
- package metadata
- `react` peer dependency
- test/build scripts
- placeholder exports

- [ ] **Step 4: Run the package test again**

Run: `pnpm -C packages/mobile-ai-native-react-native test:run -- test/public-api.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml packages/mobile-ai-native-react-native
git commit -m "feat: scaffold RN host adapter package"
```

### Task 2: Move React Host APIs Behind The Adapter

**Files:**
- Create: `packages/mobile-ai-native-react-native/src/runtime/createReactNativeAppRuntime.ts`
- Create: `packages/mobile-ai-native-react-native/src/runtime/AppRuntimeProvider.tsx`
- Create: `packages/mobile-ai-native-react-native/src/runtime/hooks.ts`
- Modify: `mobile-ai-native/src/projection/react/createReactAppRuntime.ts`
- Modify: `mobile-ai-native/src/index.ts`
- Test: `packages/mobile-ai-native-react-native/test/react-runtime.test.tsx`

- [ ] **Step 1: Write failing adapter runtime tests**

Cover:
- provider publishes runtime
- `useRuntimeState` subscribes and re-renders
- `useRuntimeActions` exposes a call surface
- `useRuntimeTrace` and `useRuntimeSnapshot` read the runtime cleanly

- [ ] **Step 2: Run the adapter runtime tests to verify failure**

Run: `pnpm -C packages/mobile-ai-native-react-native test:run -- test/react-runtime.test.tsx`
Expected: FAIL because adapter runtime does not exist yet.

- [ ] **Step 3: Implement the minimal adapter runtime**

Use the existing core runtime pieces rather than copying logic. The adapter should wrap the core package and expose React-first hooks.

- [ ] **Step 4: Keep the core honest**

Decide whether core exports:
- keep low-level host helpers for compatibility
- or deprecate them and re-export only through the adapter

Do not break existing core tests while moving the public boundary.

- [ ] **Step 5: Run runtime tests**

Run:
- `pnpm -C packages/mobile-ai-native-react-native test:run -- test/react-runtime.test.tsx`
- `pnpm -C mobile-ai-native test:run -- test/react-runtime.test.tsx test/public-api.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/mobile-ai-native-react-native mobile-ai-native/src
git commit -m "feat: add React host runtime adapter"
```

### Task 3: Add Host Lifecycle Bridge

**Files:**
- Create: `packages/mobile-ai-native-react-native/src/runtime/useRuntimeHostLifecycle.ts`
- Create: `packages/mobile-ai-native-react-native/src/runtime/host-lifecycle.ts`
- Test: `packages/mobile-ai-native-react-native/test/host-lifecycle.test.tsx`

- [ ] **Step 1: Write failing lifecycle tests**

Cover a small explicit contract:
- app active event reaches runtime
- app background event reaches runtime
- screen focus / blur can be forwarded

- [ ] **Step 2: Run the lifecycle tests to verify failure**

Run: `pnpm -C packages/mobile-ai-native-react-native test:run -- test/host-lifecycle.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement the minimal lifecycle bridge**

Do not overbuild. V1 only needs the adapter boundary and a small event surface.

- [ ] **Step 4: Run the lifecycle tests**

Run: `pnpm -C packages/mobile-ai-native-react-native test:run -- test/host-lifecycle.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/mobile-ai-native-react-native
git commit -m "feat: add RN host lifecycle bridge"
```

### Task 4: Build Expo Reference App On Top Of The Adapter

**Files:**
- Create: `examples/mobile-ai-native-expo-adapter/package.json`
- Create: `examples/mobile-ai-native-expo-adapter/App.tsx`
- Create: `examples/mobile-ai-native-expo-adapter/src/app/createRuntime.ts`
- Create: `examples/mobile-ai-native-expo-adapter/src/screens/InboxScreen.tsx`
- Create: `examples/mobile-ai-native-expo-adapter/src/screens/AiPanel.tsx`
- Test: `examples/mobile-ai-native-expo-adapter/test/smoke.test.tsx`
- Test: `examples/mobile-ai-native-expo-adapter/test/runtime-bridge.e2e.test.tsx`

- [ ] **Step 1: Write failing Expo example tests**

Cover:
- screen renders with adapter provider
- snapshot can be generated
- local tool execution mutates state
- GUI refreshes after tool execution

- [ ] **Step 2: Run the tests to verify failure**

Run: `pnpm -C examples/mobile-ai-native-expo-adapter test:run -- test/smoke.test.tsx test/runtime-bridge.e2e.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement the Expo reference app**

Use:
- shared state
- handwritten RootView + mounted business views
- adapter package hooks
- local tool execution first

Optional live model path can come later.

- [ ] **Step 4: Run the example tests**

Run: `pnpm -C examples/mobile-ai-native-expo-adapter test:run -- test/smoke.test.tsx test/runtime-bridge.e2e.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add examples/mobile-ai-native-expo-adapter
git commit -m "feat: add Expo adapter reference app"
```

### Task 5: Align Docs And Package Metadata

**Files:**
- Modify: `mobile-ai-native/README.md`
- Modify: `mobile-ai-native/GUIDE.md`
- Modify: `docs/superpowers/specs/2026-03-24-mobile-ai-native-framework-technical-design.md`
- Modify: `docs/superpowers/specs/2026-03-27-mobile-ai-native-rn-host-adapter-design.md`
- Create: `packages/mobile-ai-native-react-native/README.md`
- Test: `mobile-ai-native/test/readme.test.ts`

- [ ] **Step 1: Update docs to match the new split**

Make sure docs say:
- core stays pure
- adapter owns React Native / Expo integration
- Expo example proves the adapter works

- [ ] **Step 2: Run doc verification**

Run: `pnpm -C mobile-ai-native test:run -- test/readme.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add mobile-ai-native docs/superpowers/specs packages/mobile-ai-native-react-native/README.md
git commit -m "docs: describe RN adapter architecture"
```

### Task 6: Final Verification

**Files:**
- Verify whole workspace state for the new adapter and example

- [ ] **Step 1: Run core verification**

Run:
- `pnpm -C mobile-ai-native test:run`
- `pnpm -C mobile-ai-native build`

Expected: PASS

- [ ] **Step 2: Run adapter verification**

Run:
- `pnpm -C packages/mobile-ai-native-react-native test:run`
- `pnpm -C packages/mobile-ai-native-react-native build`

Expected: PASS

- [ ] **Step 3: Run Expo example verification**

Run:
- `pnpm -C examples/mobile-ai-native-expo-adapter test:run`
- `pnpm -C examples/mobile-ai-native-expo-adapter exec tsc --noEmit`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: ship RN host adapter and Expo reference app"
```
