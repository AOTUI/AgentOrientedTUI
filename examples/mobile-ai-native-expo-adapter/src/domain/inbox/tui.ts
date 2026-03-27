import {
  createSnapshotAssembler,
  type RefIndexEntry,
  type ToolDefinition,
} from "@aotui/mobile-ai-native";
import type { InboxMessage, InboxState } from "./state";

function createMessageMarker(
  refIndex: Record<string, RefIndexEntry>,
  key: string,
  message: InboxMessage,
  content: string,
) {
  refIndex[key] = {
    type: "message",
    value: message,
  };

  return `(${content})[message:${key}]`;
}

export function createInboxSnapshotBundle(
  state: InboxState,
  visibleTools: readonly ToolDefinition[],
) {
  const refIndex: Record<string, RefIndexEntry> = {};

  const rootView = {
    id: "root",
    type: "Root",
    name: "Navigation",
    markup: [
      "<text>App Navigation</text>",
      "<text>Semantic view graph</text>",
      "<item>Inbox: primary message list view.</item>",
      "<item>Enter Inbox: mounted by default when the app opens.</item>",
      "<item>Inbox actions: openMessage.</item>",
      "<item>InboxSearch: focused search/results view for inbox queries.</item>",
      "<item>Enter InboxSearch: use searchMessages when query is active.</item>",
      "<item>InboxSearch actions: searchMessages.</item>",
      "<item>MessageDetail: opened message detail view.</item>",
      "<item>Enter MessageDetail: use openMessage from Inbox.</item>",
    ].join(""),
  };

  const mountedViews = [
    {
      id: "inbox",
      type: "Inbox",
      name: "Inbox",
      markup: [
        "<text>Inbox messages</text>",
        `<text>Query: ${state.inbox.query || "(empty)"}</text>`,
        `<text>Opened: ${String(Boolean(state.inbox.openedMessageId))}</text>`,
        ...state.inbox.items.map((item, index) =>
          `<item>${createMessageMarker(refIndex, `messages[${index}]`, item, item.subject)}</item>`,
        ),
      ].join(""),
    },
  ];

  if (state.inbox.query || state.inbox.isLoading) {
    mountedViews.push({
      id: "inbox-search",
      type: "InboxSearch",
      name: "Search",
      markup: [
        "<text>Search status</text>",
        `<text>Query: ${state.inbox.query || "(empty)"}</text>`,
        `<text>Matches: ${state.inbox.items.length}</text>`,
      ].join(""),
    });
  }

  if (state.inbox.openedMessageId) {
    const openedMessage =
      state.inbox.items.find((item) => item.id === state.inbox.openedMessageId) ??
      state.inbox.items[0];

    if (openedMessage) {
      mountedViews.push({
        id: "message-detail",
        type: "MessageDetail",
        name: "Detail",
        markup: [
          "<text>Opened message detail</text>",
          `<text>Subject: ${openedMessage.subject}</text>`,
          `<text>${createMessageMarker(refIndex, "opened_message", openedMessage, "Opened message")}</text>`,
        ].join(""),
      });
    }
  }

  return createSnapshotAssembler({
    rootView,
    mountedViews,
    refIndex,
    visibleTools,
  });
}
