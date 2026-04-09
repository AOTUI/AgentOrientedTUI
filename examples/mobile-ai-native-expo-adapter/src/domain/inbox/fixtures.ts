import type { InboxMessage } from "./state";

export function createInboxMessages(): InboxMessage[] {
  return [
    { id: "message-1", subject: "Welcome back", opened: false },
    { id: "message-2", subject: "Invoice ready", opened: false },
  ];
}
