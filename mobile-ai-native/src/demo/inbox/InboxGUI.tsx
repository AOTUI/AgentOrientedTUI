/** @jsxImportSource preact */
import { useRuntimeState } from "../../projection/react/hooks";
import type { InboxState } from "./state";

export function InboxGUI() {
  const recentTrace = useRuntimeState(
    (state: InboxState) => state.shell.recentTrace ?? "",
  );
  const openedMessageId = useRuntimeState(
    (state: InboxState) => state.inbox.openedMessageId ?? "",
  );
  const items = useRuntimeState((state: InboxState) => state.inbox.items);

  return (
    <gui-screen>
      <gui-trace>{recentTrace}</gui-trace>
      <gui-opened>{openedMessageId}</gui-opened>
      {items.map((item) => (
        <gui-item key={item.id}>{item.subject}</gui-item>
      ))}
    </gui-screen>
  );
}
