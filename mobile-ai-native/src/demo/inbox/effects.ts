import type { InboxEvent, InboxMessage, InboxState } from "./state";
import type { EffectContext, EffectResult } from "../../core/effect/types";

export function createInboxEffects(allMessages: InboxMessage[]) {
  return {
    async searchMessages(
      ctx: EffectContext<InboxState, InboxEvent>,
      input: { query: string },
    ): Promise<EffectResult> {
      ctx.trace.update(`Searching ${input.query}`);

      const items = allMessages.filter((item) =>
        item.subject.toLowerCase().includes(input.query.toLowerCase()),
      );

      ctx.emit({
        type: "SearchSucceeded",
        query: input.query,
        items,
      });

      ctx.trace.update(`Found ${items.length} matching messages`);

      return {
        success: true,
      };
    },
  };
}
