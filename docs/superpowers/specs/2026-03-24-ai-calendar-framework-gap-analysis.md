# AI Calendar Framework Gap Analysis

> This document captures the framework-side requirements coming from a real consumer: AI Calendar.
>
> It should be read together with:
> - [2026-03-23-mobile-ai-native-framework-design.md](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/docs/superpowers/specs/2026-03-23-mobile-ai-native-framework-design.md)
> - [2026-03-24-mobile-ai-native-framework-technical-design.md](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/docs/superpowers/specs/2026-03-24-mobile-ai-native-framework-technical-design.md)

## 1. Short Conclusion

The direction of `@aotui/mobile-ai-native` is correct.

The hardened runtime now proves the most important spine:

- GUI and TUI can share one state model
- tools can operate through `snapshotId + ref_id`
- action execution can be scoped to the snapshot seen by the LLM

It now also has the React host adapter, reactive state consumption, tool schema metadata, trace lifecycle, and snapshot invalidation needed for a serious React Native / Expo foundation.

The goal is not to redesign the framework.
The goal is to preserve the current spine and keep the framework/business boundary clean while the app layers build on top.

## 2. What AI Calendar Expects From the Framework

AI Calendar does not want:

- fake GUI clicking
- auto-generated TUI from GUI
- business logic embedded in the framework

AI Calendar wants:

- one app
- human users acting through GUI
- LLM agents acting through TUI tools
- both paths converging on the same `Action`
- both paths mutating the same `State`

Canonical flow:

```text
Runtime State -> GUI
Runtime State -> TUI Snapshot
GUI Event -> Action -> State
LLM Tool -> Action -> State
```

This is the correct first-principles model and should remain the backbone of the framework.

## 3. Confirmed Strengths To Keep

These parts of the current alpha should be preserved:

### 3.1 Shared state and shared actions

Humans and LLMs must not go through two business systems.

### 3.2 `SnapshotBundle`

The bundle shape is correct.
These must come from the same render tick:

- `tui`
- `refIndex`
- `visibleTools`

### 3.3 `snapshotId + refIndex`

This is non-negotiable.
The runtime must not guess against the latest GUI.
Tool execution must be bound to the world the LLM actually saw.

### 3.4 Tools target domain actions, not fake clicks

The framework should continue to model:

- `openItem`
- `switchTab`
- `selectDate`
- `createDraft`

and not regress toward:

- `tapButton42`
- `scrollList`

## 4. Confirmed Gaps In The Current Alpha

These are not "nice to have" improvements.
These are the minimum hardening items needed before AI Calendar can treat the package as a real runtime core.

### 4.1 Missing React Native / Expo host adapter

Current state:

- the package now exposes a formal React-family host adapter
- `createReactAppRuntime()` owns store, actions, trace, snapshots, and tool bridge
- `AppRuntimeProvider` publishes the runtime through context

Evidence:

- [createReactAppRuntime.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/mobile-ai-native/src/projection/react/createReactAppRuntime.ts)
- [AppRuntimeProvider.tsx](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/mobile-ai-native/src/projection/react/AppRuntimeProvider.tsx)
- [hooks.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/mobile-ai-native/src/projection/react/hooks.ts)

What this means:

- React Native and Expo hosts can wire the runtime through one provider
- app shells do not need to manually stitch together store, actions, trace, or tool execution
- the framework boundary stops at host integration instead of trying to own the app shell

### 4.2 GUI is not truly reactive yet

Current state:

- GUI state consumption now uses `useRuntimeState(selector)`
- the hook subscribes through `useSyncExternalStore`
- host components re-render when the selected slice changes

Evidence:

- [hooks.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/mobile-ai-native/src/projection/react/hooks.ts)
- [createStore.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/mobile-ai-native/src/core/state/createStore.ts)

Why this matters:

- LLM changes state
- state changes
- GUI must re-render
- otherwise the user cannot see what the AI just did

This gap is now closed, and the remaining requirement is to keep GUI components on selector-based runtime hooks instead of reintroducing one-shot reads.

### 4.3 Tool definition is too weak

Current state:

- `ToolDefinition` now carries `name`, `description`, `inputSchema`, and `meta`
- `inputSchema` is the actual Zod schema used for validation and tool shape
- `meta` is preserved as free-form tool metadata

Evidence:

- [types.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/mobile-ai-native/src/core/types.ts)
- [createActionRuntime.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/mobile-ai-native/src/core/action/createActionRuntime.ts)

Why this matters:

- model SDKs need input schema
- host adapters need structured tool metadata
- business apps need to know which fields support refs

This requirement is now implemented.
The remaining rule is to keep tool metadata aligned with the app domain instead of smuggling app logic into the framework.

### 4.4 Tool visibility must stay snapshot-scoped

Current state:

- `visibility(state)` remains the callable gate
- visible tools are generated from the same state that produced the current snapshot
- snapshot execution rejects missing or stale snapshots before tool resolution

Why this matters:

AI Calendar will need tool visibility to depend on:

- current screen or view
- current selection
- current modal or sheet
- current snapshot's legal refs

The rule is now: preserve state-driven visibility and keep tool execution bound to the snapshot the LLM actually saw.

### 4.5 Trace runtime is still only a placeholder

Current state:

- trace is now a first-class lifecycle stream
- action runtime records `started`, `updated`, `succeeded`, and `failed`
- React hosts can subscribe to the recent trace through `useRuntimeTrace()`

Evidence:

- [createActionRuntime.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/mobile-ai-native/src/core/action/createActionRuntime.ts)
- [createTraceStore.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/mobile-ai-native/src/core/trace/createTraceStore.ts)

Why this matters:

The app must be able to show:

- action started
- action updated
- action succeeded
- action failed

This is essential for user trust.
Without it, the AI feels like a black box.

This requirement is now implemented.
The remaining design rule is to keep trace summaries human-readable and app-owned rather than turning trace into framework policy.

### 4.6 Effect contract needs to become first-class

Current state:

- effects now have a formal `EffectContext` with `getState`, `emit`, and `trace`
- `ActionContext.runEffect()` returns `EffectResult`
- recoverable effect failures can surface both a structured failure event and a result error
- unexpected throws still fail the action lifecycle

Evidence:

- [createActionRuntime.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/mobile-ai-native/src/core/action/createActionRuntime.ts)
- [types.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/mobile-ai-native/src/core/effect/types.ts)

Why this matters:

AI Calendar effects will include:

- reading calendar data
- writing to Calendar / Reminders
- permission checks
- speech, OCR, media import

This requirement is now implemented.
The app still owns effect meaning and recovery policy, but the framework now provides the contract.

### 4.7 Snapshot lifecycle is under-specified

Current state:

- snapshots are managed by a bounded registry
- `SNAPSHOT_NOT_FOUND` and `SNAPSHOT_STALE` are explicit errors
- mutated tool results stale the originating snapshot, including recoverable failures that return `mutated: true`
- the registry retains only a small recent window for debugging

Evidence:

- [createToolBridge.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/mobile-ai-native/src/tool/createToolBridge.ts)
- [createSnapshotRegistry.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/mobile-ai-native/src/core/snapshot/createSnapshotRegistry.ts)
- [createSnapshotBundle.ts](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/mobile-ai-native/src/core/snapshot/createSnapshotBundle.ts)

Default policy now implemented:

1. runtime produces a new `SnapshotBundle`
2. LLM uses that `snapshotId` to call a tool
3. if the call is accepted and execution changes state, the old snapshot becomes stale
4. the next reasoning turn must fetch a fresh snapshot

These semantics are now part of the runtime contract.

### 4.8 Framework and business boundaries must stay clean

Framework should own:

- store
- action runtime
- snapshot runtime
- tool bridge
- host adapter

Business apps should own:

- state shape
- domain actions
- handwritten TUI
- `DrivenSource`
- agent driver integration
- effect meaning and recovery policy

The framework should stop at the runway.
It should not try to become the airplane.

## 5. Things The Framework Should Explicitly Avoid

These should stay out of the framework, especially in early versions:

- implementing app-specific `DrivenSource`
- auto-generating full TUI from GUI
- simulating GUI clicks as the primary abstraction
- degrading action semantics into low-level control taps
- baking inbox or calendar business shape into core APIs

## 6. Release Criteria For "AI Calendar Ready Runtime Core"

The framework is "good enough" for AI Calendar when all of these are true:

### Must-have runtime guarantees

- GUI in React Native / Expo re-renders on state change
- TUI snapshot is generated atomically from the same state
- visible tools expose real input schema
- tool execution is bound to `snapshotId`
- stale snapshots fail deterministically
- action / effect / trace lifecycle is formally defined
- snapshot cache has explicit invalidation and bounded retention

These are now satisfied by the hardened runtime core. Remaining work is app-specific composition, not framework capability.

### Explicitly business-owned concerns

- calendar state modeling
- calendar actions
- calendar TUI content
- `CalendarAppDrivenSource`
- prompt policy
- conversation orchestration
- agent loop

## 7. Implementation Priority

The framework-side priority work for this round is done.

What remains for app teams is to keep using the host adapter, selector-based state hooks, schema-rich tool definitions, snapshot-scoped tool execution, trace subscriptions, and formal effect contracts instead of bypassing them.

## 8. One-Sentence Summary For Framework Authors

Do not change the spine:

- shared state
- shared actions
- atomic snapshots
- snapshot-scoped tool execution

Instead, harden the missing runtime foundation until the package can safely sit under a real React Native / Expo product.
