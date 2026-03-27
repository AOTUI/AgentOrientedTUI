export type InboxMessage = {
  id: string;
  subject: string;
  opened: boolean;
};

export type InboxState = {
  shell: {
    currentTab: "inbox" | "settings";
    recentTrace: string | null;
  };
  inbox: {
    query: string;
    isLoading: boolean;
    items: InboxMessage[];
    openedMessageId: string | null;
  };
};

export type InboxEvent =
  | { type: "MessageOpened"; messageId: string }
  | { type: "SearchStarted"; query: string }
  | { type: "SearchSucceeded"; query: string; items: InboxMessage[] }
  | { type: "TraceUpdated"; summary: string };

export function createInitialInboxState(messages: InboxMessage[]): InboxState {
  return {
    shell: {
      currentTab: "inbox",
      recentTrace: null,
    },
    inbox: {
      query: "",
      isLoading: false,
      items: messages,
      openedMessageId: null,
    },
  };
}

export function reduceInboxState(
  state: InboxState,
  event: InboxEvent,
): InboxState {
  switch (event.type) {
    case "MessageOpened":
      return {
        ...state,
        inbox: {
          ...state.inbox,
          openedMessageId: event.messageId,
          items: state.inbox.items.map((item) =>
            item.id === event.messageId ? { ...item, opened: true } : item,
          ),
        },
      };
    case "SearchStarted":
      return {
        ...state,
        inbox: {
          ...state.inbox,
          query: event.query,
          isLoading: true,
        },
      };
    case "SearchSucceeded":
      return {
        ...state,
        inbox: {
          ...state.inbox,
          query: event.query,
          isLoading: false,
          items: event.items,
        },
      };
    case "TraceUpdated":
      return {
        ...state,
        shell: {
          ...state.shell,
          recentTrace: event.summary,
        },
      };
    default:
      return state;
  }
}

export function isInboxSearchRelevant(state: InboxState) {
  return state.inbox.items.length > 1;
}

export function isInboxSearchActive(state: InboxState) {
  return state.inbox.isLoading || state.inbox.query.trim().length > 0;
}

export function getInboxRelevantViewTypes(state: InboxState) {
  const viewTypes = ["Root", "Inbox"];

  if (isInboxSearchActive(state)) {
    viewTypes.push("InboxSearch");
  }

  if (state.inbox.openedMessageId) {
    viewTypes.push("MessageDetail");
  }

  return viewTypes;
}
