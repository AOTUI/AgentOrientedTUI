import { z } from "zod";
import { defineViewTypeTool } from "../../core/action/defineViewTypeTool";
import type { InboxEvent, InboxState } from "./state";
import { isInboxSearchActive, isInboxSearchRelevant } from "./state";

const inboxMessageSchema = z.object({
  id: z.string(),
  subject: z.string(),
  opened: z.boolean(),
});

export function createInboxActions() {
  const openMessage = defineViewTypeTool<
    InboxState,
    InboxEvent,
    { message: z.infer<typeof inboxMessageSchema> }
  >({
    name: "openMessage",
    description: "Open a message from the inbox.",
    schema: z.object({
      message: inboxMessageSchema,
    }),
    viewType: "Inbox",
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
        message: `Opened message ${input.message.subject}`,
        data: { openedMessageId: input.message.id },
      };
    },
  });

  const searchMessages = defineViewTypeTool<
    InboxState,
    InboxEvent,
    { query: string }
  >({
    name: "searchMessages",
    description: "Search inbox messages.",
    schema: z.object({
      query: z.string().min(1),
    }),
    viewType: "Inbox",
    visibility(state) {
      return (
        state.shell.currentTab === "inbox" &&
        (isInboxSearchRelevant(state) || isInboxSearchActive(state))
      );
    },
    async handler(ctx, input) {
      ctx.emit({ type: "SearchStarted", query: input.query });
      ctx.emit({
        type: "TraceUpdated",
        summary: `Started search for ${input.query}`,
      });
      ctx.trace.update(`Started search for ${input.query}`);
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
