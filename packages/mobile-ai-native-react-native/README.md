# @aotui/mobile-ai-native-react-native

`@aotui/mobile-ai-native-react-native` is the React Native / Expo host adapter for [`@aotui/mobile-ai-native`](../../mobile-ai-native/README.md).

Use it when you want:

- a real React context boundary for the runtime
- reactive hooks for GUI state, trace, and snapshot reads
- a host-safe AI surface for `snapshotId`-scoped tool execution
- a place to connect app foreground/background and screen focus lifecycle

This package does **not** replace the core runtime.
The split is intentional:

- `@aotui/mobile-ai-native`
  owns state, action runtime, snapshot assembly, refs, tool bridge, trace, and effect contracts
- `@aotui/mobile-ai-native-react-native`
  owns React host wiring and React Native / Expo integration

## Installation

```bash
pnpm add @aotui/mobile-ai-native @aotui/mobile-ai-native-react-native react react-native
```

## Runtime Shape

The adapter exposes:

- `createReactNativeAppRuntime`
- `AppRuntimeProvider`
- `useRuntimeState`
- `useRuntimeActions`
- `useRuntimeTrace`
- `useRuntimeSnapshot`
- `useRuntimeHostLifecycle`
- `createHostLifecycleBridge`

Minimal shape:

```tsx
import {
  AppRuntimeProvider,
  createReactNativeAppRuntime,
  useRuntimeActions,
  useRuntimeState,
} from "@aotui/mobile-ai-native-react-native";

const runtime = createReactNativeAppRuntime(appDefinition);

function InboxScreen() {
  const items = useRuntimeState((state) => state.inbox.items);
  const { callAction } = useRuntimeActions();

  return (
    <>
      {items.map((message) => (
        <Button
          key={message.id}
          title={message.subject}
          onPress={() => callAction("openMessage", { message })}
        />
      ))}
    </>
  );
}

export function App() {
  return (
    <AppRuntimeProvider runtime={runtime}>
      <InboxScreen />
    </AppRuntimeProvider>
  );
}
```

## AI Surface

The adapter keeps raw core internals hidden, but still exposes a host-safe AI boundary:

```ts
const snapshot = runtime.ai.getSnapshot();

await runtime.ai.executeTool(
  "openMessage",
  { message: "messages[0]" },
  snapshot.snapshotId,
);
```

This preserves the core contract:

- snapshot reads stay atomic
- tool execution stays tied to the exact `snapshotId` the model saw
- GUI keeps reacting to the same shared state as the tool path

## Host Lifecycle

Use `createHostLifecycleBridge()` and `useRuntimeHostLifecycle()` to forward host signals such as:

- app active
- app background
- screen focused
- screen blurred

The adapter owns that boundary so the core package can stay host-agnostic.

## Reference App

See the Expo reference app in [`examples/mobile-ai-native-expo-adapter`](../../examples/mobile-ai-native-expo-adapter).
