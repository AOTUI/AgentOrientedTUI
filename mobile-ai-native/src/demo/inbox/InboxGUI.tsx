/** @jsxImportSource preact */
import { useAppState } from "../../projection/gui/hooks";
import type { InboxState } from "./state";

export function InboxGUI() {
  const { state } = useAppState<InboxState>();

  return (
    <gui-screen>
      <gui-trace>{state.shell.recentTrace ?? ""}</gui-trace>
      <gui-opened>{state.inbox.openedMessageId ?? ""}</gui-opened>
      {state.inbox.items.map((item) => (
        <gui-item key={item.id}>{item.subject}</gui-item>
      ))}
    </gui-screen>
  );
}
