# Mobile AI-Native RN Host Adapter Design

> This document extends [2026-03-24-mobile-ai-native-framework-technical-design.md](/Users/zhangwei/JSWorkSpace/learning_code/AgentOrientedTUI/docs/superpowers/specs/2026-03-24-mobile-ai-native-framework-technical-design.md).
>
> It defines how `@aotui/mobile-ai-native` should connect to a real React Native / Expo host without collapsing the runtime core back into host-specific code.

## 1. Goal

Build a real React Native / Expo host layer for the mobile AI-native runtime so that:

- GUI runs in real `react` / `react-native`
- GUI, TUI snapshot, and tool execution still share the same core state
- host lifecycle can be observed by runtime code
- business apps can mount the runtime in Expo without importing `preact` internals

## 2. Core Decision

The framework should split into two layers:

1. `@aotui/mobile-ai-native`
   Pure runtime core.

2. `@aotui/mobile-ai-native-react-native`
   React Native / Expo host adapter.

This is the default long-term architecture.

The core should remain host-agnostic unless real product pressure later proves that the split creates unacceptable DX cost.

## 3. Why This Split Is Correct

Changing `preact` to `react` inside the existing package is not enough.

That would only change rendering primitives.
It would not solve:

- host lifecycle integration
- Expo / React Native package boundaries
- honest dependency declarations
- true React hook ownership
- host-specific adapter responsibilities

The actual target is not "React-style code".
The target is "a runtime core that can be mounted inside a real mobile host".

So the right split is:

`pure core + host adapter`

not:

`one package that knows everything`

## 4. Layer Responsibilities

### 4.1 `@aotui/mobile-ai-native` Core

The core owns:

- state store
- action runtime
- reducer/event flow
- effect contract
- trace runtime
- snapshot assembly
- view fragments
- tool bridge
- snapshot registry
- data ref hooks and marker protocol

The core must not directly depend on:

- `react-native`
- `expo`
- App lifecycle APIs
- navigation libraries
- device permission APIs

### 4.2 `@aotui/mobile-ai-native-react-native` Adapter

The adapter owns:

- React context provider for runtime
- React hooks that subscribe to runtime state/trace/snapshot
- runtime creation helpers for React Native apps
- bridge points for host lifecycle
- Expo / RN-friendly package metadata and peer dependencies

The adapter must not reimplement core semantics.
It should compose the core, not fork it.

### 4.3 App Layer

Business apps own:

- domain state shape
- domain actions
- handwritten RootView and business views
- DrivenSource
- Agent Driver orchestration
- actual app UI

The framework should not absorb business semantics.

## 5. API Shape

### 5.1 Core package

The core package continues to expose runtime primitives such as:

- `createStore`
- `createActionRuntime`
- `createSnapshotAssembler`
- `createToolBridge`
- `defineAction`
- `defineViewTypeTool`
- `useDataRef`
- `useArrayRef`

It may continue to export low-level rendering helpers that are host-agnostic.

### 5.2 React Native adapter package

The adapter package should expose:

- `createReactNativeAppRuntime`
- `AppRuntimeProvider`
- `useRuntimeState`
- `useRuntimeActions`
- `useRuntimeTrace`
- `useRuntimeSnapshot`
- `useRuntimeHostLifecycle`

Conceptual example:

```tsx
const runtime = createReactNativeAppRuntime({
  store,
  actions,
  effects,
  renderSnapshot,
  getRelevantViewTypes,
});

export function App() {
  return (
    <AppRuntimeProvider runtime={runtime}>
      <InboxScreen />
    </AppRuntimeProvider>
  );
}
```

Inside screens:

```tsx
function InboxScreen() {
  const messages = useRuntimeState((state) => state.inbox.items);
  const { callAction } = useRuntimeActions();
  const trace = useRuntimeTrace((state) => state.current);

  return (
    <View>
      {messages.map((message) => (
        <Button
          key={message.id}
          title={message.subject}
          onPress={() => callAction("openMessage", { messageId: message.id })}
        />
      ))}
      {trace ? <Text>{trace.summary}</Text> : null}
    </View>
  );
}
```

## 6. Host Lifecycle Model

The adapter must provide a formal place to feed host signals into runtime code.

V1 lifecycle surface should be small and explicit:

- app became active
- app moved to background
- screen focused
- screen blurred

Optional later additions:

- network changed
- permission changed
- deep link received
- push event received

The important point is not to implement every host event now.
The important point is to define a stable adapter boundary where host events can enter the runtime cleanly.

## 7. Expo Reference App

The adapter is not considered real until it is exercised by a real Expo app.

The reference app should prove:

1. GUI renders in Expo
2. GUI reacts to shared state changes
3. runtime can assemble a snapshot from the same app state
4. tool execution can mutate state
5. GUI visibly refreshes after tool execution
6. recent AI trace is visible in the GUI

This app is not the framework itself.
It is the proof that the adapter works in a real host.

The current reference implementation lives at:

- [`examples/mobile-ai-native-expo-adapter`](../../examples/mobile-ai-native-expo-adapter/README.md)

It proves the adapter with an app-owned inbox domain, a handwritten snapshot, and a host-safe local AI panel that executes tools against `snapshotId`.

## 8. Migration Strategy

The migration should be incremental:

1. keep current core semantics stable
2. introduce React Native adapter as a new package
3. move host-facing React APIs out of the core package
4. make the Expo reference app use the adapter package
5. only after real usage, evaluate whether more restructuring is needed

The default assumption is that the split remains.

## 9. Success Criteria

This work is successful when:

- the runtime core no longer needs to pretend to be a React Native host
- the adapter package carries the real React / React Native integration
- the Expo reference app uses the adapter instead of internal core wiring
- the business app still sees one shared state system
- snapshot/tool/state semantics remain unchanged

## 10. One-Sentence Summary

The next phase is not "port the core to React Native".

It is:

**keep `mobile-ai-native` as a pure runtime core, then build a real React Native / Expo adapter that mounts that core inside a real mobile host.**
