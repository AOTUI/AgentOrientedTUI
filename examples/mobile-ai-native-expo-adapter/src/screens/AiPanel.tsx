import { createElement, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { SnapshotBundle } from "@aotui/mobile-ai-native";
import type { InboxEvent, InboxState } from "../domain/inbox/state";
import type { ReactNativeAppRuntime } from "@aotui/mobile-ai-native-react-native";
import { useRuntimeState } from "@aotui/mobile-ai-native-react-native";

type AiPanelProps = {
  runtime: ReactNativeAppRuntime<InboxState, InboxEvent>;
  onSnapshotGenerated(snapshot: SnapshotBundle): void;
};

export function AiPanel({ runtime, onSnapshotGenerated }: AiPanelProps) {
  const recentTrace = useRuntimeState<InboxState, string | null>(
    (state) => state.shell.recentTrace,
  );
  const [status, setStatus] = useState("Waiting for a snapshot.");

  function handleGenerateSnapshot() {
    const snapshot = runtime.ai.getSnapshot();
    onSnapshotGenerated(snapshot);
    setStatus(`Generated snapshot ${snapshot.snapshotId}.`);
  }

  async function handleOpenFirstMessageLocally() {
    const executionSnapshot = runtime.ai.getSnapshot();
    const result = await runtime.ai.executeTool(
      "openMessage",
      { message: "messages[0]" },
      executionSnapshot.snapshotId,
    );

    const snapshot = runtime.ai.getSnapshot();
    onSnapshotGenerated(snapshot);

    if (result.success) {
      setStatus(
        `Opened the first message with snapshot ${executionSnapshot.snapshotId}.`,
      );
      return;
    }

    setStatus(result.error?.message ?? "Local tool execution failed.");
  }

  return createElement(
    View,
    { style: styles.card },
    createElement(
      View,
      { style: styles.header },
      createElement(Text, { style: styles.title }, "AI Runtime Panel"),
      createElement(
        Text,
        { testID: "ai-panel-status", style: styles.subtitle },
        status,
      ),
    ),
    createElement(
      View,
      { style: styles.actions },
      createElement(
        Pressable,
        {
          testID: "generate-snapshot",
          onPress: handleGenerateSnapshot,
          style: styles.primaryButton,
        },
        createElement(Text, { style: styles.primaryButtonLabel }, "Generate Snapshot"),
      ),
      createElement(
        Pressable,
        {
          testID: "open-first-message-locally",
          onPress: () => {
            void handleOpenFirstMessageLocally();
          },
          style: styles.secondaryButton,
        },
        createElement(
          Text,
          { style: styles.secondaryButtonLabel },
          "Open First Message Locally",
        ),
      ),
    ),
    createElement(
      View,
      { style: styles.traceBlock },
      createElement(Text, { style: styles.sectionLabel }, "Recent AI Trace"),
      createElement(
        Text,
        { testID: "ai-panel-trace", style: styles.traceText },
        recentTrace ?? "No trace yet.",
      ),
    ),
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 13,
    color: "#4b5563",
  },
  actions: {
    gap: 10,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#0f172a",
    alignSelf: "flex-start",
  },
  primaryButtonLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    alignSelf: "flex-start",
  },
  secondaryButtonLabel: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "600",
  },
  traceBlock: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#6b7280",
  },
  traceText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#111827",
  },
});
