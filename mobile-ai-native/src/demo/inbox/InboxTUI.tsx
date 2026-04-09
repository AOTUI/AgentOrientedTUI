/** @jsxImportSource preact */
import renderToString from "preact-render-to-string";
import type { ComponentChildren } from "preact";
import { createRefCollector } from "../../core/ref/ref-index";
import type { ToolDefinition } from "../../core/types";
import { createSnapshotAssembler } from "../../projection/tui/createSnapshotAssembler";
import { renderViewFragment } from "../../projection/tui/renderViewFragment";
import { RefProvider } from "../../ref/RefContext";
import { useDataRef } from "../../ref/useDataRef";
import { useArrayRef } from "../../ref/useArrayRef";
import type {
  InboxMessage,
  InboxState,
} from "./state";
import {
  isInboxSearchActive,
} from "./state";

function InboxRootContent() {
  return (
    <>
      <text>App Navigation</text>
      <text>Semantic view graph</text>
      <item>Inbox: primary message list view.</item>
      <item>Enter Inbox: mounted by default when the app opens.</item>
      <item>Inbox actions: openMessage.</item>
      <item>InboxSearch: focused search/results view for inbox queries.</item>
      <item>Enter InboxSearch: use searchMessages when inbox search is relevant.</item>
      <item>InboxSearch actions: searchMessages.</item>
      <item>MessageDetail: opened message detail view.</item>
      <item>Enter MessageDetail: use openMessage from Inbox.</item>
      <item>MessageDetail actions: inspect the opened message state.</item>
    </>
  );
}

function InboxListContent(props: { state: InboxState }) {
  const firstMessage =
    props.state.inbox.items[0] ??
    ({ id: "empty", subject: "Empty", opened: false } as InboxMessage);
  const openedRef = useDataRef("message", firstMessage, "opened_message");
  const [listRef, itemRef] = useArrayRef(
    "message",
    props.state.inbox.items,
    "messages",
  );

  return (
    <>
      <text>{listRef("Inbox messages")}</text>
      <text>Query: {props.state.inbox.query || "(empty)"}</text>
      <text>Opened: {String(Boolean(props.state.inbox.openedMessageId))}</text>
      {props.state.inbox.items.map((item, index) => (
        <item key={item.id}>{itemRef(index, item.subject)}</item>
      ))}
      <text>{openedRef("Opened message")}</text>
    </>
  );
}

function InboxSearchContent(props: { state: InboxState }) {
  return (
    <>
      <text>Search status</text>
      <text>Query: {props.state.inbox.query || "(empty)"}</text>
      <text>Matches: {props.state.inbox.items.length}</text>
    </>
  );
}

function InboxDetailContent(props: { state: InboxState }) {
  const openedMessage =
    props.state.inbox.items.find(
      (item) => item.id === props.state.inbox.openedMessageId,
    ) ??
    props.state.inbox.items[0] ??
    ({ id: "empty", subject: "Empty", opened: false } as InboxMessage);
  const detailRef = useDataRef("message", openedMessage, "opened_detail");

  return (
    <>
      <text>Opened message detail</text>
      <text>Subject: {openedMessage.subject}</text>
      <text>{detailRef(`Opened: ${String(Boolean(props.state.inbox.openedMessageId))}`)}</text>
    </>
  );
}

function renderFragmentMarkup(
  children: ComponentChildren,
  collector: ReturnType<typeof createRefCollector>,
) {
  return {
    markup: renderToString(
      <RefProvider registry={collector}>{children}</RefProvider>,
    ),
  };
}

export function createInboxSnapshotBundle(
  state: InboxState,
  visibleTools: readonly ToolDefinition[],
) {
  const collector = createRefCollector();
  const rootMarkup = renderFragmentMarkup(<InboxRootContent />, collector);
  const rootView = renderViewFragment({
    id: "root",
    type: "Root",
    name: "Navigation",
    markup: rootMarkup.markup,
  });

  const inboxMarkup = renderFragmentMarkup(
    <InboxListContent state={state} />,
    collector,
  );
  const mountedViews = [
    renderViewFragment({
      id: "inbox",
      type: "Inbox",
      name: "Inbox",
      markup: inboxMarkup.markup,
    }),
  ];

  if (isInboxSearchActive(state)) {
    const searchMarkup = renderFragmentMarkup(
      <InboxSearchContent state={state} />,
      collector,
    );
    mountedViews.push(
      renderViewFragment({
        id: "inbox-search",
        type: "InboxSearch",
        name: "Search",
        markup: searchMarkup.markup,
      }),
    );
  }

  if (state.inbox.openedMessageId) {
    const detailMarkup = renderFragmentMarkup(
      <InboxDetailContent state={state} />,
      collector,
    );
    mountedViews.push(
      renderViewFragment({
        id: "message-detail",
        type: "MessageDetail",
        name: "Detail",
        markup: detailMarkup.markup,
      }),
    );
  }

  return createSnapshotAssembler({
    rootView,
    mountedViews,
    refIndex: collector.snapshot(),
    visibleTools,
  });
}
