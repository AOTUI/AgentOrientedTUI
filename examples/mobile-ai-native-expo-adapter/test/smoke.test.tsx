import React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import App from "../App";

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

describe("Expo adapter app smoke", () => {
  it("renders the inbox shell and AI panel", async () => {
    let renderer: ReturnType<typeof create>;

    await act(async () => {
      renderer = create(React.createElement(App));
    });

    expect(
      renderer!.root.findByProps({ testID: "generate-snapshot" }),
    ).toBeTruthy();
    expect(
      renderer!.root.findByProps({ testID: "open-message-message-1" }),
    ).toBeTruthy();
    expect(
      renderer!.root.findByProps({ testID: "snapshot-preview" }).props.children,
    ).toContain("No snapshot generated yet");
  });
});
