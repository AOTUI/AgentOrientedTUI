import { z } from "zod";
import { defineAction } from "../../core/action/defineAction";
import type { InboxEvent, InboxState } from "./state";

const inboxMessageSchema = z.object({
  id: z.string(),
  subject: z.string(),
  opened: z.boolean(),
});

export function createInboxActions() {
  const openMessage = defineAction<InboxState, InboxEvent, { message: z.infer<typeof inboxMessageSchema> }>({
    name: "openMessage",
    description: "Open a message from the inbox.",
    schema: z.object({
      message: inboxMessageSchema,
    }),
    meta: {
      supportsRefs: true,
    },
    visibility(state) {
      return state.shell.currentTab === "inbox";
    },
    handler(ctx, input) {
      ctx.emit({ type: "MessageOpened", messageId: input.message.id });
      ctx.emit({
        type: "TraceUpdated",
        summary: `Opened message ${input.message.subject}`,
      });

      return {
        success: true,
        mutated: true,
        data: { openedMessageId: input.message.id },
      };
    },
  });

  const searchMessages = defineAction<InboxState, InboxEvent, { query: string }>({
    name: "searchMessages",
    description: "Search inbox messages.",
    schema: z.object({
      query: z.string().min(1),
    }),
    visibility(state) {
      return state.shell.currentTab === "inbox";
    },
    async handler(ctx, input) {
      ctx.emit({ type: "SearchStarted", query: input.query });
      ctx.emit({
        type: "TraceUpdated",
        summary: `Started search for ${input.query}`,
      });
      await ctx.runEffect("searchMessages", input);

      return {
        success: true,
        mutated: true,
        message: `Started search for ${input.query}`,
      };
    },
  });

  return {
    openMessage,
    searchMessages,
  };
}
