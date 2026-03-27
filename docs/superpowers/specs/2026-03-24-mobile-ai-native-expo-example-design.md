# Mobile AI-Native Expo Example Design

> This spec defines a real, minimal Expo app that proves `@aotui/mobile-ai-native` can be integrated into a mobile app shell, not just discussed in theory.
>
> Related docs:
> - [2026-03-24-mobile-ai-native-framework-technical-design.md](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/.worktrees/mobile-ai-native-expo/docs/superpowers/specs/2026-03-24-mobile-ai-native-framework-technical-design.md)
> - [2026-03-24-ai-calendar-framework-gap-analysis.md](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/.worktrees/mobile-ai-native-expo/docs/superpowers/specs/2026-03-24-ai-calendar-framework-gap-analysis.md)

## 1. Goal

Build a real Expo example app at `examples/mobile-ai-native-expo` that proves this loop on iOS Simulator:

`State -> TUI Snapshot -> Tool Call -> Action -> State -> GUI refresh`

The sample should be small, but real:

- a real Expo app
- a real React Native screen
- real `@aotui/mobile-ai-native` runtime wiring
- a real state update that visibly changes the GUI

Optional live-provider validation:

- a real DeepSeek HTTP request from the app when an API key is configured

## 2. Non-Goals

This example will not:

- implement a full agent loop
- implement business-specific `DrivenSource`
- become a production-ready networking/security pattern
- hide the fact that direct client-side API key usage is only acceptable for local development
- solve calendar-specific product modeling

This is a proof-of-integration example, not a production app template.

## 3. Why Inbox, Not Calendar

The sample will use a minimal inbox-shaped app instead of a calendar shell.

Reason:

- inbox is still the smallest business shape for proving message list -> selection -> tool action
- the goal here is to prove the mobile host integration path
- inbox semantics keep the example small without bringing in calendar-specific complexity

The lesson should generalize to calendar apps:

- shared state
- handwritten TUI
- snapshot generation
- tool execution
- GUI refresh

Important boundary:

- the Expo example owns its own inbox state, reducer, actions, effects, fixtures, and handwritten TUI
- it may borrow ideas from the framework demo, but it must not depend on the framework's built-in inbox demo module as app logic

## 4. Product Shape

The Expo example will have one screen with three visible regions:

1. `Inbox GUI`
   Shows a small list of messages and the opened message state.

2. `AI Runtime Panel`
   Shows:
   - current status
   - recent AI trace
   - actions to generate a snapshot, run the deterministic local tool path, and optionally ask DeepSeek to act

3. `TUI Snapshot Preview`
   Shows the current snapshot text the model sees.

This keeps the example inspectable.
The user can see:

- what the human sees
- what the model sees
- what the model did

## 5. Success Criteria

### 5.1 Required Core Proof

The example is successful if all of these are true:

1. `expo start` runs the app locally
2. iOS Simulator renders the inbox screen
3. pressing a human GUI button updates state and GUI
4. pressing the AI button generates a snapshot
5. the app can execute a deterministic sample tool call through the runtime core
6. GUI updates automatically from the same shared state
7. the user can see the latest AI trace summary
8. the user can inspect the current TUI snapshot text

### 5.2 Optional Live Provider Validation

If a DeepSeek API key is present, the example should also support:

1. sending the current snapshot to DeepSeek
2. receiving a structured tool call payload
3. executing that tool call through the runtime core
4. refreshing the GUI from the updated shared state

## 6. Architecture

The example should be split into two layers.

### 6.1 Runtime Core Layer

This stays in `mobile-ai-native`.

It already owns:

- state store
- action runtime
- snapshot registry
- tool bridge
- trace store
- React-shaped host API

The example must consume the runtime as a client, not fork it.

### 6.2 Expo App Layer

This lives in `examples/mobile-ai-native-expo`.

It owns:

- Expo app shell
- React Native UI components
- env loading for local DeepSeek API key
- the thin DeepSeek client
- prompt assembly for the sample interaction
- parsing model output into a runtime tool call

### 6.3 Compatibility Decision

The current framework host adapter is React-shaped, but still implemented on Preact primitives.

So for this Expo example, v1 will make a clear compatibility choice:

- do **not** mount the current `AppRuntimeProvider` / `useRuntimeState` Preact host layer directly into Expo
- do use the lower-level runtime core primitives from `@aotui/mobile-ai-native`
- build a thin React wrapper inside the example app:
  - React context for the runtime object
  - `useSyncExternalStore`-based hooks for store and trace subscription

This keeps the example honest:

- it proves the runtime core can power a real Expo app
- it does **not** overclaim that the existing Preact host adapter is already a first-class React Native adapter

## 7. Interaction Design

There will be three simple actions in the AI panel.

### 7.1 `Generate Snapshot`

Behavior:

- asks the runtime for the current `SnapshotBundle`
- stores the latest snapshot in component state
- renders the `snapshot.tui` into the preview panel

### 7.2 `Open First Message Locally`

Behavior:

- generates a fresh snapshot
- deterministically executes `openMessage` with the first visible message ref
- updates the AI status panel and trace summary

This is the required proof path because it is deterministic and offline except for the local app runtime.

### 7.3 `Ask DeepSeek To Open First Message`

Behavior:

- generates a fresh snapshot
- sends a constrained prompt to DeepSeek
- asks it to choose one tool from the visible tools
- expects a minimal JSON response like:

```json
{
  "tool": "openMessage",
  "input": {
    "message": "messages[0]"
  }
}
```

- validates the response
- calls `toolBridge.executeTool(tool, input, snapshotId)`
- updates the AI status panel and trace summary

This path is optional live-provider validation, not the only success path.

## 8. DeepSeek Strategy

To keep the sample real but still small:

- the app will call DeepSeek directly over HTTPS
- the API key will come from a local Expo env value
- the README must clearly say this is for local validation only

This is intentionally not production architecture.
It is a minimal integration path for local validation.

The request should be narrow and deterministic:

- include only the current `tui`
- include visible tool names and descriptions
- instruct the model to return JSON only
- keep the task simple: open the first unread message

## 9. Tool Contract For The Sample

The first sample interaction should use only one domain tool:

- `openMessage`

Optional second interaction, only if still small:

- `searchMessages`

But `openMessage` is enough for v1 because it proves:

- snapshot generation
- tool selection
- ref usage
- action execution
- GUI refresh

## 10. File Layout

The example should live under:

```text
examples/mobile-ai-native-expo/
  App.tsx
  app.json
  babel.config.js
  package.json
  tsconfig.json
  .env.example
  src/
    app/
      createInboxExpoRuntime.ts
      ExpoRuntimeProvider.tsx
      hooks.ts
    domain/
      inbox/
        state.ts
        actions.ts
        effects.ts
        tui.tsx
        fixtures.ts
    components/
      InboxScreen.tsx
      AiPanel.tsx
      SnapshotPreview.tsx
    deepseek/
      client.ts
      prompt.ts
      parseToolCall.ts
    theme/
      tokens.ts
```

Design rule:

- runtime setup stays in `src/app`
- app-owned domain logic stays in `src/domain`
- UI stays in `src/components`
- model wiring stays in `src/deepseek`

### 10.1 Package Integration

During local development, the Expo example should consume the local runtime package through a file dependency on `../../mobile-ai-native`.

That means:

- the example package installs `@aotui/mobile-ai-native` from the local repository path
- `mobile-ai-native` must be built before the Expo app is started
- the example README should document that rebuild step clearly

V1 does not need a fancy watch pipeline.
An explicit rebuild step is enough.

## 11. Testing Strategy

There are two categories of tests.

### 11.1 Core-Proof Tests

Inside the example package:

- one test for the local React wrapper hooks around runtime store/trace subscription
- one test for app-owned inbox runtime setup
- one test for prompt/response parsing
- one test for runtime wiring around the sample tool call

### 11.2 Manual Simulator Verification

Document a short checklist:

1. run Expo app
2. open iOS Simulator
3. tap `Generate Snapshot`
4. confirm snapshot preview renders
5. tap `Open First Message Locally`
6. confirm recent AI action updates
7. confirm the first message becomes opened in GUI
8. if DeepSeek key is configured, tap `Ask DeepSeek To Open First Message`
9. confirm the live provider path also opens the message

### 11.3 Failure Checks

The example should also document minimum failure behavior for:

- DeepSeek network failure
- invalid JSON tool payload
- runtime rejection such as `SNAPSHOT_STALE`
- missing env key

The UI does not need to be fancy, but the failure state must be visible in `AiPanel`.

## 12. Risks And Honest Boundaries

### 12.1 `preact` vs React Native

This example will not magically turn the runtime core into a fully native React runtime.

It only proves:

- the runtime core primitives can be consumed from a real Expo app through a thin React wrapper

That means the sample should be described honestly as:

- Expo integration example
- React Native-ready runtime proof

Not:

- production-ready official React Native adapter

### 12.2 API Key Exposure

Direct client-side DeepSeek API usage is only acceptable for local development.

The example README must say this explicitly.

### 12.3 Model Determinism

Model output may drift.

So the example must:

- use a constrained prompt
- require JSON-only output
- validate the payload before execution

## 13. Recommended Implementation Order

1. scaffold Expo app
2. add local React wrapper around runtime core
3. implement app-owned inbox domain module
4. render inbox GUI and trace summary
5. add snapshot preview
6. add deterministic local tool-call path
7. add local env handling
8. add DeepSeek client
9. add JSON tool-call parser
10. connect model response to `toolBridge.executeTool`
11. document simulator and failure verification

## 14. One-Sentence Summary

This example should prove, in a real Expo app, that `@aotui/mobile-ai-native` can sit under a mobile UI, generate a TUI snapshot for a model, execute a returned tool call, and refresh the GUI from the same shared state.