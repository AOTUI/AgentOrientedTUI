import type { EffectContext, EffectResult } from "@aotui/mobile-ai-native";
import type { InboxEvent, InboxMessage, InboxState } from "./state";

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
      ctx.emit({
        type: "TraceUpdated",
        summary: `Found ${items.length} matching messages`,
      });

      return {
        success: true,
      };
    },
  };
}
