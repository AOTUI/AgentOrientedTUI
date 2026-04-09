import { z } from "zod";
import {
  defineViewTypeTool,
  type ActionContext,
} from "@aotui/mobile-ai-native";
import type { InboxEvent, InboxMessage, InboxState } from "./state";

const inboxMessageSchema = z.object({
  id: z.string(),
  subject: z.string(),
  opened: z.boolean(),
}) satisfies z.ZodType<InboxMessage>;

const searchQuerySchema = z.object({
  query: z.string().min(1, "Query must be a non-empty string"),
});

export function createInboxActions() {
  const openMessage = defineViewTypeTool<
    InboxState,
    InboxEvent,
    { message: InboxMessage }
  >({
    name: "openMessage",
    description: "Open a message from the inbox.",
    schema: z.object({
      message: inboxMessageSchema,
    }),
    meta: {
      supportsRefs: true,
    },
    viewType: "Inbox",
    visibility() {
      return true;
    },
    handler(
      ctx: ActionContext<InboxState, InboxEvent>,
      input: { message: InboxMessage },
    ) {
      ctx.emit({ type: "MessageOpened", messageId: input.message.id });
      ctx.emit({
        type: "TraceUpdated",
        summary: `Opened message ${input.message.subject}`,
      });

      return {
        success: true,
        mutated: true,
        message: `Opened message ${input.message.subject}`,
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
    schema: searchQuerySchema,
    meta: {},
    viewType: "InboxSearch",
    visibility() {
      return true;
    },
    async handler(
      ctx: ActionContext<InboxState, InboxEvent>,
      input: { query: string },
    ) {
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
