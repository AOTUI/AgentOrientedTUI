# Expo Reference App: mobile-ai-native React Native Adapter

This example proves that the runtime core can be mounted inside a real Expo app through `@aotui/mobile-ai-native-react-native`.

It is intentionally small.
It proves one real loop:

`state -> snapshot -> tool -> action -> state -> GUI refresh`

## What It Includes

- an app-owned inbox domain
- a shared runtime state
- a handwritten Root view and mounted business views
- a real React Native screen
- a snapshot preview panel
- a local AI panel that executes snapshot-scoped tools

## Run

```bash
pnpm install
pnpm -C mobile-ai-native build
pnpm -C packages/mobile-ai-native-react-native build
pnpm -C examples/mobile-ai-native-expo-adapter test:run
pnpm -C examples/mobile-ai-native-expo-adapter typecheck
```

Then start Expo:

```bash
pnpm -C examples/mobile-ai-native-expo-adapter expo start
```

## What To Verify

1. The inbox screen renders.
2. Pressing the human GUI button opens a message and updates the screen.
3. The snapshot preview updates from the same runtime state.
4. The AI panel can run a local tool call using `snapshotId`.
5. After that tool call, both GUI and snapshot refresh together.

## Why This Example Exists

The core package should stay host-agnostic.
This example exists to prove that the RN adapter is real, not theoretical.
