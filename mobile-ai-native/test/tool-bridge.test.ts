import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineAction } from "../src/core/action/defineAction";
import { createActionRuntime } from "../src/core/action/createActionRuntime";
import { createSnapshotBundle } from "../src/core/snapshot/createSnapshotBundle";
import { createStore } from "../src/core/state/createStore";
import { createToolBridge } from "../src/tool/createToolBridge";

type TestState = {
  currentTab: "inbox" | "settings";
  messages: Array<{ id: string; subject: string }>;
};

function createTestBridge(
  initialState: TestState = {
    currentTab: "inbox",
    messages: [{ id: "m1", subject: "Welcome back" }],
  },
) {
  const store = createStore({
    initialState,
    reduce(state: TestState, _event: { type: "Noop" }) {
      return state;
    },
  });

  const openMessage = defineAction({
    name: "openMessage",
    description: "Open a message from the inbox.",
    schema: z.object({
      message: z.object({
        id: z.string(),
        subject: z.string(),
      }),
    }),
    visibility(state: TestState) {
      return state.currentTab === "inbox";
    },
    handler(_ctx, input) {
      return {
        success: true,
        data: { openedMessageId: input.message.id },
      };
    },
  });

  const searchMessages = defineAction({
    name: "searchMessages",
    description: "Search inbox messages.",
    schema: z.object({
      query: z.string(),
    }),
    visibility(state: TestState) {
      return state.currentTab === "inbox";
    },
    handler() {
      return {
        success: true,
      };
    },
  });

  const actionRuntime = createActionRuntime({
    store,
    actions: [openMessage, searchMessages],
  });

  return createToolBridge({
    actionRuntime,
    renderCurrentSnapshot() {
      const state = store.getState();

      return createSnapshotBundle({
        tui: `<screen>${state.messages[0]?.subject ?? "empty"}</screen>`,
        refIndex: {
          "messages[0]": {
            type: "message",
            value: state.messages[0],
          },
        },
        visibleTools: actionRuntime.listVisibleTools(),
      });
    },
  });
}

describe("createToolBridge", () => {
  it("lists only visible tools from current state", () => {
    const bridge = createTestBridge();

    expect(bridge.listTools().map((tool) => tool.name)).toEqual([
      "openMessage",
      "searchMessages",
    ]);
  });

  it("resolves ref args from the originating snapshot", async () => {
    const bridge = createTestBridge();
    const snapshot = bridge.getSnapshotBundle();

    const result = await bridge.executeTool(
      "openMessage",
      { message: "messages[0]" },
      snapshot.snapshotId,
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ openedMessageId: "m1" });
  });

  it("rejects stale snapshot ids", async () => {
    const bridge = createTestBridge();

    const result = await bridge.executeTool(
      "openMessage",
      { message: "messages[0]" },
      "snap_old",
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("SNAPSHOT_NOT_FOUND");
  });
});
