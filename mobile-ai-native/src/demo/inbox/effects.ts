import type { InboxEvent, InboxMessage, InboxState } from "./state";

export function createInboxEffects(allMessages: InboxMessage[]) {
  return {
    async searchMessages(
      ctx: { getState(): InboxState; emit(event: InboxEvent): void },
      input: { query: string },
    ) {
      const items = allMessages.filter((item) =>
        item.subject.toLowerCase().includes(input.query.toLowerCase()),
      );

      ctx.emit({
        type: "SearchSucceeded",
        query: input.query,
        items,
      });
    },
  };
}
