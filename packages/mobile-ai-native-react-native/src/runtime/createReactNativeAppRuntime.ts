import {
  createReactAppRuntime,
  type ReactAppDefinition,
  type ReactAppRuntime,
} from "@aotui/mobile-ai-native";

export type ReactNativeAppDefinition<State, Event> = ReactAppDefinition<
  State,
  Event
>;

export type ReactNativeAppRuntime<State, Event> = ReactAppRuntime<State, Event>;

export function createReactNativeAppRuntime<State, Event>(
  app: ReactNativeAppDefinition<State, Event>,
): ReactNativeAppRuntime<State, Event> {
  return createReactAppRuntime(app);
}
