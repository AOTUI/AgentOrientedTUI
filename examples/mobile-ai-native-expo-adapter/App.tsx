import { createElement, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { SnapshotBundle } from "@aotui/mobile-ai-native";
import { createInboxExpoRuntime } from "./src/app/createRuntime";
import { AiPanel } from "./src/screens/AiPanel";
import { InboxScreen } from "./src/screens/InboxScreen";
import { SnapshotPreview } from "./src/screens/SnapshotPreview";
import { AppRuntimeProvider } from "./src/runtime/adapter";

export default function App() {
  const [runtime] = useState(() => createInboxExpoRuntime());
  const [snapshot, setSnapshot] = useState<SnapshotBundle | null>(null);

  return createElement(
    AppRuntimeProvider,
    { runtime },
    createElement(
      View,
      { style: styles.screen },
      createElement(InboxScreen),
      createElement(
        View,
        { style: styles.panelStack },
        createElement(AiPanel, { runtime, onSnapshotGenerated: setSnapshot }),
        createElement(SnapshotPreview, { snapshot }),
      ),
    ),
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f6f3ee",
  },
  panelStack: {
    gap: 14,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
});
