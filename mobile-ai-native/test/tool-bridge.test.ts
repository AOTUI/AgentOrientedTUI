import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineAction } from "../src/core/action/defineAction";
import { createActionRuntime } from "../src/core/action/createActionRuntime";
import { createSnapshotBundle } from "../src/core/snapshot/createSnapshotBundle";
import { createStore } from "../src/core/state/createStore";
import { renderViewFragment } from "../src/projection/tui/renderViewFragment";
import { defineViewTypeTool } from "../src/index";
import { createToolBridge } from "../src/tool/createToolBridge";
import type { SnapshotRegistry } from "../src/core/types";

type TestState = {
  currentTab: "inbox" | "settings";
  messages: Array<{ id: string; subject: string }>;
};

type TestEvent = { type: "TabChanged"; tab: TestState["currentTab"] };

function createTestBridge(
  initialState: TestState = {
    currentTab: "inbox",
    messages: [{ id: "m1", subject: "Welcome back" }],
  },
) {
  const store = createStore({
    initialState,
    reduce(state: TestState, event: TestEvent) {
      if (event.type === "TabChanged") {
        return {
          ...state,
          currentTab: event.tab,
        };
      }

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
    meta: {
      supportsRefs: true,
    },
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

  const changeTab = defineAction({
    name: "changeTab",
    description: "Change the current tab.",
    schema: z.object({
      tab: z.union([z.literal("inbox"), z.literal("settings")]),
    }),
    visibility(state: TestState) {
      return state.currentTab === "inbox";
    },
    handler(ctx, input) {
      ctx.emit({ type: "TabChanged", tab: input.tab });
      return {
        success: true,
        mutated: true,
      };
    },
  });

  const actionRuntime = createActionRuntime({
    store,
    actions: [openMessage, searchMessages, changeTab],
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
      "changeTab",
    ]);
  });

  it("keeps view-type scoped tools aligned with the current relevant views", () => {
    const store = createStore({
      initialState: {
        currentTab: "inbox" as const,
        messages: [{ id: "m1", subject: "Welcome back" }],
      },
      reduce(state: TestState, event: TestEvent) {
        if (event.type === "TabChanged") {
          return {
            ...state,
            currentTab: event.tab,
          };
        }

        return state;
      },
    });
    const relevantViewTypes = ["Workspace"] as const;

    const openFile = defineViewTypeTool(
      {
        name: "open_file",
        description: "Open the current file.",
        schema: z.object({
          path: z.string(),
        }),
        viewType: "Workspace",
        visibility() {
          return true;
        },
        handler() {
          return { success: true };
        },
      },
    );

    const editFile = defineViewTypeTool(
      {
        name: "edit_file",
        description: "Edit the current file.",
        schema: z.object({
          path: z.string(),
        }),
        viewType: "FileDetail",
        visibility() {
          return true;
        },
        handler() {
          return { success: true };
        },
      },
    );

    const actionRuntime = createActionRuntime({
      store,
      actions: [openFile, editFile],
      getRelevantViewTypes: () => relevantViewTypes,
    } as any);

    const bridge = createToolBridge({
      actionRuntime,
      renderCurrentSnapshot() {
        return createSnapshotBundle({
          tui: "<screen>home</screen>",
          refIndex: {},
          visibleTools: actionRuntime.listVisibleTools(),
        });
      },
    });

    expect(bridge.listTools().map((tool) => tool.name)).toEqual([
      "open_file",
    ]);
  });

  it("lists visible tools with schema and metadata", () => {
    const bridge = createTestBridge();

    expect(bridge.listTools()).toContainEqual(
      expect.objectContaining({
        name: "openMessage",
        description: expect.any(String),
        inputSchema: expect.any(Object),
        meta: expect.objectContaining({
          supportsRefs: true,
        }),
      }),
    );
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

  it("marks a consumed snapshot as stale after a successful state-changing tool execution", async () => {
    const bridge = createTestBridge();
    const snapshot = bridge.getSnapshotBundle();

    const result = await bridge.executeTool(
      "changeTab",
      { tab: "settings" },
      snapshot.snapshotId,
    );

    expect(result.success).toBe(true);

    const staleResult = await bridge.executeTool(
      "changeTab",
      { tab: "inbox" },
      snapshot.snapshotId,
    );

    expect(staleResult).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "SNAPSHOT_STALE" }),
      }),
    );
  });

  it("keeps a snapshot active after a successful read-only tool execution", async () => {
    const bridge = createTestBridge();
    const snapshot = bridge.getSnapshotBundle();

    const firstResult = await bridge.executeTool(
      "openMessage",
      { message: "messages[0]" },
      snapshot.snapshotId,
    );

    expect(firstResult.success).toBe(true);

    const secondResult = await bridge.executeTool(
      "openMessage",
      { message: "messages[0]" },
      snapshot.snapshotId,
    );

    expect(secondResult).toEqual(
      expect.objectContaining({
        success: true,
        data: { openedMessageId: "m1" },
      }),
    );
  });

  it("keeps view-based snapshot bundles usable for execution and stale tracking", async () => {
    const store = createStore({
      initialState: {
        currentTab: "inbox" as const,
        messages: [{ id: "m1", subject: "Welcome back" }],
      },
      reduce(state: TestState, event: TestEvent) {
        if (event.type === "TabChanged") {
          return {
            ...state,
            currentTab: event.tab,
          };
        }

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
      meta: {
        supportsRefs: true,
      },
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

    const changeTab = defineAction({
      name: "changeTab",
      description: "Change the current tab.",
      schema: z.object({
        tab: z.union([z.literal("inbox"), z.literal("settings")]),
      }),
      visibility(state: TestState) {
        return state.currentTab === "inbox";
      },
      handler(ctx, input) {
        ctx.emit({ type: "TabChanged", tab: input.tab });
        return {
          success: true,
          mutated: true,
        };
      },
    });

    const actionRuntime = createActionRuntime({
      store,
      actions: [openMessage, changeTab],
    });

    const bridge = createToolBridge({
      actionRuntime,
      renderCurrentSnapshot() {
        return createSnapshotBundle({
          views: [
            renderViewFragment({
              id: "root",
              type: "Root",
              name: "Navigation",
              children: "Root",
            }),
          ],
          refIndex: {
            "messages[0]": {
              type: "message",
              value: store.getState().messages[0],
            },
          },
          visibleTools: actionRuntime.listVisibleTools(),
        });
      },
    });

    const snapshot = bridge.getSnapshotBundle();

    expect(snapshot.markup).toContain(
      '<View id="root" type="Root" name="Navigation">',
    );

    const firstResult = await bridge.executeTool(
      "openMessage",
      { message: "messages[0]" },
      snapshot.snapshotId,
    );

    expect(firstResult.success).toBe(true);

    const mutateResult = await bridge.executeTool(
      "changeTab",
      { tab: "settings" },
      snapshot.snapshotId,
    );

    expect(mutateResult.success).toBe(true);

    const staleResult = await bridge.executeTool(
      "changeTab",
      { tab: "settings" },
      snapshot.snapshotId,
    );

    expect(staleResult).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "SNAPSHOT_STALE" }),
      }),
    );
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

  it("rejects ref ids missing from the snapshot bundle", async () => {
    const bridge = createTestBridge();
    const snapshot = bridge.getSnapshotBundle();

    const result = await bridge.executeTool(
      "openMessage",
      { message: "messages[99]" },
      snapshot.snapshotId,
    );

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("REF_NOT_FOUND");
  });

  it("does not treat ordinary bracketed strings as missing refs", async () => {
    const bridge = createTestBridge();
    const snapshot = bridge.getSnapshotBundle();

    const result = await bridge.executeTool(
      "searchMessages",
      { query: "label:[inbox]" },
      snapshot.snapshotId,
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
      }),
    );
  });

  it("uses the originating snapshot tool metadata for ref resolution", async () => {
    let currentVisibleTools = [
      {
        name: "openMessage",
        description: "Open a message",
        inputSchema: z.object({ message: z.string() }),
        meta: { supportsRefs: true },
      },
    ];

    const bridge = createToolBridge({
      actionRuntime: {
        listVisibleTools() {
          return currentVisibleTools;
        },
        async executeAction(_name, input) {
          return {
            success: true,
            data: input,
          };
        },
      },
      renderCurrentSnapshot() {
        return createSnapshotBundle({
          tui: "<screen>snapshot</screen>",
          refIndex: {
            "messages[0]": {
              type: "message",
              value: { id: "m1", subject: "Welcome back" },
            },
          },
          visibleTools: currentVisibleTools,
        });
      },
    });

    const snapshot = bridge.getSnapshotBundle();
    currentVisibleTools = [
      {
        name: "openMessage",
        description: "Open a message",
        inputSchema: z.object({ message: z.string() }),
        meta: {},
      },
    ];

    const result = await bridge.executeTool(
      "openMessage",
      { message: "messages[0]" },
      snapshot.snapshotId,
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        data: {
          message: { id: "m1", subject: "Welcome back" },
        },
      }),
    );
  });

  it("hides tools when state says invisible", () => {
    const bridge = createTestBridge({
      currentTab: "settings",
      messages: [{ id: "m1", subject: "Welcome back" }],
    });

    expect(bridge.listTools()).toEqual([]);
  });

  it("falls back to markStale when a custom snapshot registry does not implement markAllStale", async () => {
    const entries = new Map<string, {
      snapshot: ReturnType<typeof createSnapshotBundle>;
      status: "active" | "stale";
    }>();
    const customRegistry: SnapshotRegistry = {
      create(snapshot) {
        entries.set(snapshot.snapshotId, {
          snapshot,
          status: "active",
        });
        return snapshot;
      },
      lookup(snapshotId) {
        return entries.get(snapshotId);
      },
      markStale(snapshotId) {
        const entry = entries.get(snapshotId);
        if (!entry) {
          return;
        }

        entries.set(snapshotId, {
          snapshot: entry.snapshot,
          status: "stale",
        });
      },
    };
    const customBridge = createToolBridge({
      snapshotRegistry: customRegistry,
      actionRuntime: {
        listVisibleTools() {
          return [];
        },
        async executeAction() {
          return {
            success: true,
            mutated: true,
          };
        },
      },
      renderCurrentSnapshot() {
        return createSnapshotBundle({
          tui: "<screen>custom</screen>",
          refIndex: {},
          visibleTools: [],
        });
      },
    });
    const runtimeSnapshot = customBridge.getSnapshotBundle();

    const result = await customBridge.executeTool(
      "changeTab",
      { tab: "settings" },
      runtimeSnapshot.snapshotId,
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: true,
        mutated: true,
      }),
    );
    expect(customRegistry.lookup(runtimeSnapshot.snapshotId)).toEqual(
      expect.objectContaining({
        status: "stale",
      }),
    );
  });

  it("rejects hand-built snapshot bundles whose views and markup disagree", () => {
    const customBridge = createToolBridge({
      actionRuntime: {
        listVisibleTools() {
          return [];
        },
        async executeAction() {
          return {
            success: true,
          };
        },
      },
      renderCurrentSnapshot() {
        return {
          snapshotId: "snap_manual_invalid",
          generatedAt: Date.now(),
          markup: "<View>different</View>",
          views: [
            renderViewFragment({
              id: "root",
              type: "Root",
              name: "Navigation",
              children: "Root",
            }),
          ],
          tui: "<View>different</View>",
          refIndex: {},
          visibleTools: [],
        };
      },
    });

    expect(() => customBridge.getSnapshotBundle()).toThrow(/same render tick/);
  });
});
