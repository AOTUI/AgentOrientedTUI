/** @jsxImportSource preact */
import { useDataRef } from "../../ref/useDataRef";
import { useArrayRef } from "../../ref/useArrayRef";
import { useAppState } from "../../projection/gui/hooks";
import type { InboxMessage, InboxState } from "./state";

export function InboxTUI() {
  const { state } = useAppState<InboxState>();
  const firstMessage =
    state.inbox.items[0] ?? ({ id: "empty", subject: "Empty", opened: false } as InboxMessage);
  const openedRef = useDataRef("message", firstMessage, "opened_message");
  const [listRef, itemRef] = useArrayRef("message", state.inbox.items, "messages");

  return (
    <screen name="Inbox">
      <text>{listRef("Inbox messages")}</text>
      <text>Query: {state.inbox.query || "(empty)"}</text>
      <text>Opened: {String(Boolean(state.inbox.openedMessageId))}</text>
      {state.inbox.items.map((item, index) => (
        <item key={item.id}>{itemRef(index, item.subject)}</item>
      ))}
      <text>{openedRef("Opened message")}</text>
    </screen>
  );
}
