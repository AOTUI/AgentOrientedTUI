import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import { createInboxExpoRuntime } from "../src/app/createRuntime";
import { AiPanel } from "../src/screens/AiPanel";
import { InboxScreen } from "../src/screens/InboxScreen";
import { AppRuntimeProvider } from "../src/runtime/adapter";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("react-native", () => {
  const React = require("react");

  function createHostComponent(name: string) {
    return function HostComponent({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: unknown;
    }) {
      return React.createElement(name, props, children);
    };
  }

  return {
    Pressable: createHostComponent("Pressable"),
    ScrollView: createHostComponent("ScrollView"),
    StyleSheet: {
      create(styles: Record<string, unknown>) {
        return styles;
      },
    },
    Text: createHostComponent("Text"),
    View: createHostComponent("View"),
  };
});

function readText(node: { props: { children?: unknown } }) {
  return Array.isArray(node.props.children)
    ? node.props.children.join("")
    : node.props.children;
}

describe("Expo adapter runtime bridge", () => {
  it("can generate a snapshot and execute a local tool through the adapter AI surface", async () => {
    const runtime = createInboxExpoRuntime();
    const firstSnapshot = runtime.ai.getSnapshot();

    expect(firstSnapshot.views.map((view) => view.type)).toEqual([
      "Root",
      "Inbox",
    ]);
    expect(firstSnapshot.visibleTools.map((tool) => tool.name)).toContain(
      "openMessage",
    );

    const result = await runtime.ai.executeTool(
      "openMessage",
      { message: "messages[0]" },
      firstSnapshot.snapshotId,
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        mutated: true,
      }),
    );
    expect(runtime.state.getState().inbox.openedMessageId).toBe("message-1");

    const nextSnapshot = runtime.ai.getSnapshot();
    expect(nextSnapshot.snapshotId).not.toBe(firstSnapshot.snapshotId);
    expect(nextSnapshot.views.some((view) => view.type === "MessageDetail")).toBe(
      true,
    );
  });

  it("refreshes the GUI when a human presses the inbox button", async () => {
    const runtime = createInboxExpoRuntime();
    let renderer: ReturnType<typeof create>;

    await act(async () => {
      renderer = create(
        React.createElement(
          AppRuntimeProvider,
          { runtime },
          React.createElement(InboxScreen),
        ),
      );
    });

    const openButton = renderer!.root.findByProps({
      testID: "open-message-message-1",
    });

    expect(
      readText(
        renderer!.root.findByProps({
          testID: "message-status-message-1",
        }),
      ),
    ).toContain("Closed");

    await act(async () => {
      await openButton.props.onPress();
    });

    expect(
      readText(
        renderer!.root.findByProps({
          testID: "message-status-message-1",
        }),
      ),
    ).toContain("Opened");
    expect(
      readText(
        renderer!.root.findByProps({
          testID: "opened-message-copy",
        }),
      ),
    ).toContain("message-1");
  });

  it("updates the snapshot preview and trace after local AI execution", async () => {
    const runtime = createInboxExpoRuntime();
    const onSnapshotGenerated = vi.fn();
    let renderer: ReturnType<typeof create>;

    await act(async () => {
      renderer = create(
        React.createElement(
          AppRuntimeProvider,
          { runtime },
          React.createElement(AiPanel, {
            runtime,
            onSnapshotGenerated,
          }),
        ),
      );
    });

    await act(async () => {
      renderer!.root.findByProps({ testID: "generate-snapshot" }).props.onPress();
    });

    expect(onSnapshotGenerated).toHaveBeenCalledTimes(1);
    expect(onSnapshotGenerated.mock.calls[0]?.[0].views[0]?.type).toBe("Root");

    await act(async () => {
      await renderer!
        .root.findByProps({ testID: "open-first-message-locally" })
        .props.onPress();
    });

    expect(runtime.state.getState().inbox.openedMessageId).toBe("message-1");
    expect(readText(renderer!.root.findByProps({ testID: "ai-panel-trace" }))).toContain(
      "Opened message Welcome back",
    );
    expect(readText(renderer!.root.findByProps({ testID: "ai-panel-status" }))).toContain(
      "Opened the first message",
    );
  });
});
