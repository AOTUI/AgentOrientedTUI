import type { ToolDefinition } from "@aotui/mobile-ai-native";
import type {
  ReactNativeAppDefinition,
  ReactNativeAppRuntime,
} from "../runtime/adapter";
import { createReactNativeAppRuntime } from "../runtime/adapter";
import { createInboxActions } from "../domain/inbox/actions";
import { createInboxEffects } from "../domain/inbox/effects";
import { createInboxMessages } from "../domain/inbox/fixtures";
import {
  createInitialInboxState,
  getInboxRelevantViewTypes,
  reduceInboxState,
  type InboxEvent,
  type InboxState,
} from "../domain/inbox/state";
import { createInboxSnapshotBundle } from "../domain/inbox/tui";

export function createInboxExpoRuntime(): ReactNativeAppRuntime<
  InboxState,
  InboxEvent
> {
  const messages = createInboxMessages();
  const actions = createInboxActions();

  const definition: ReactNativeAppDefinition<InboxState, InboxEvent> = {
    initialState: createInitialInboxState(messages),
    reduce: reduceInboxState,
    actions: [actions.openMessage, actions.searchMessages],
    effects: createInboxEffects(messages),
    getRelevantViewTypes: getInboxRelevantViewTypes,
    renderCurrentSnapshot({
      state,
      visibleTools,
    }: {
      state: InboxState;
      visibleTools: readonly ToolDefinition[];
    }) {
      return createInboxSnapshotBundle(state, visibleTools);
    },
  };

  return createReactNativeAppRuntime(definition);
}
