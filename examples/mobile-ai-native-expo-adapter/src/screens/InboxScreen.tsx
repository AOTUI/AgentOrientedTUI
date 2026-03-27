import { createElement } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { InboxState } from "../domain/inbox/state";
import { useRuntimeActions, useRuntimeState } from "../runtime/adapter";

export function InboxScreen() {
  const inbox = useRuntimeState<InboxState, InboxState["inbox"]>(
    (state) => state.inbox,
  );
  const actions = useRuntimeActions();

  return createElement(
    ScrollView,
    { contentContainerStyle: styles.container },
    createElement(
      View,
      { style: styles.header },
      createElement(Text, { style: styles.title }, "Inbox"),
      createElement(
        Text,
        { testID: "opened-message-copy", style: styles.subtitle },
        inbox.openedMessageId
          ? `Opened message: ${inbox.openedMessageId}`
          : "No message opened yet",
      ),
    ),
    createElement(
      View,
      { style: styles.list },
      inbox.items.map((message) =>
        createElement(
          View,
          { key: message.id, style: styles.messageCard },
          createElement(
            View,
            { style: styles.messageCopy },
            createElement(
              Text,
              { testID: `message-subject-${message.id}`, style: styles.subject },
              message.subject,
            ),
            createElement(
              Text,
              { testID: `message-status-${message.id}`, style: styles.status },
              message.opened ? "Opened" : "Closed",
            ),
          ),
          createElement(
            Pressable,
            {
              testID: `open-message-${message.id}`,
              onPress: () => {
                void actions.callAction("openMessage", { message });
              },
              style: styles.button,
            },
            createElement(Text, { style: styles.buttonLabel }, "Open message"),
          ),
        ),
      ),
    ),
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 20,
    backgroundColor: "#f6f3ee",
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1f2937",
  },
  subtitle: {
    fontSize: 15,
    color: "#4b5563",
  },
  list: {
    gap: 12,
  },
  messageCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 14,
  },
  messageCopy: {
    gap: 6,
  },
  subject: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  status: {
    fontSize: 14,
    fontWeight: "600",
    color: "#166534",
  },
  button: {
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#111827",
  },
  buttonLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
