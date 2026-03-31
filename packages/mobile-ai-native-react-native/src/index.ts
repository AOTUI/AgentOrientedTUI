const NOT_IMPLEMENTED_MESSAGE =
  "@aotui/mobile-ai-native-react-native is scaffolded but not implemented yet.";

export type ReactNativeAppRuntime = {
  readonly kind: "react-native-app-runtime";
};

export function createReactNativeAppRuntime(): ReactNativeAppRuntime {
  throw new Error(NOT_IMPLEMENTED_MESSAGE);
}

export function AppRuntimeProvider(props: { children?: unknown }) {
  return props.children ?? null;
}

export function useRuntimeState(): never {
  throw new Error(NOT_IMPLEMENTED_MESSAGE);
}

export function useRuntimeActions(): never {
  throw new Error(NOT_IMPLEMENTED_MESSAGE);
}

export function useRuntimeTrace(): never {
  throw new Error(NOT_IMPLEMENTED_MESSAGE);
}

export function useRuntimeSnapshot(): never {
  throw new Error(NOT_IMPLEMENTED_MESSAGE);
}
