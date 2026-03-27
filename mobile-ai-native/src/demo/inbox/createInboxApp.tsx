/** @jsxImportSource preact */
import renderToString from "preact-render-to-string";
import { createActionRuntime } from "../../core/action/createActionRuntime";
import { createStore } from "../../core/state/createStore";
import { AppProvider } from "../../projection/gui/AppProvider";
import { createToolBridge } from "../../tool/createToolBridge";
import { createInboxActions } from "./actions";
import { createInboxEffects } from "./effects";
import { InboxGUI } from "./InboxGUI";
import {
  createInboxSnapshotBundle,
} from "./InboxTUI";
import {
  createInitialInboxState,
  getInboxRelevantViewTypes,
  reduceInboxState,
  type InboxMessage,
} from "./state";

export function createInboxApp(config: { initialMessages: InboxMessage[] }) {
  const store = createStore({
    initialState: createInitialInboxState(config.initialMessages),
    reduce: reduceInboxState,
  });

  const actions = createInboxActions();
  const actionRuntime = createActionRuntime({
    store,
    actions: [actions.openMessage, actions.searchMessages],
    effects: createInboxEffects(config.initialMessages),
    getRelevantViewTypes: () => getInboxRelevantViewTypes(store.getState()),
  });

  const bridge = createToolBridge({
    actionRuntime,
    renderCurrentSnapshot() {
      return createInboxSnapshotBundle(
        store.getState(),
        actionRuntime.listVisibleTools(),
      );
    },
  });

  function renderGUI() {
    return renderToString(
      <AppProvider store={store} actionRuntime={actionRuntime}>
        <InboxGUI />
      </AppProvider>,
    );
  }

  return {
    store,
    bridge,
    gui: {
      render: renderGUI,
      getVisibleSubjects() {
        return store.getState().inbox.items.map((item) => item.subject);
      },
      getOpenedMessageId() {
        return store.getState().inbox.openedMessageId;
      },
      getRecentTrace() {
        return store.getState().shell.recentTrace ?? "";
      },
    },
  };
}
