import { createElement } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SnapshotBundle } from "@aotui/mobile-ai-native";

export function SnapshotPreview(props: { snapshot: SnapshotBundle | null }) {
  return createElement(
    View,
    { style: styles.card },
    createElement(Text, { style: styles.title }, "Snapshot Preview"),
    createElement(
      Text,
      { testID: "snapshot-preview", style: styles.copy },
      props.snapshot?.markup ?? "No snapshot generated yet.",
    ),
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  copy: {
    fontSize: 13,
    lineHeight: 18,
    color: "#111827",
  },
});
