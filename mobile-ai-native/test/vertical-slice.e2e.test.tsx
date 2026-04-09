/** @jsxImportSource preact */
// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { createToolBridge } from "../src/tool/createToolBridge";
import { createReactAppRuntime } from "../src/projection/react/createReactAppRuntime";
import { AppRuntimeProvider } from "../src/projection/react/AppRuntimeProvider";
import { createInboxApp } from "../src/demo/inbox/createInboxApp";
import { InboxGUI } from "../src/demo/inbox/InboxGUI";
import { createInboxActions } from "../src/demo/inbox/actions";
import { createInboxEffects } from "../src/demo/inbox/effects";
import {
  createInitialInboxState,
  getInboxRelevantViewTypes,
  reduceInboxState,
} from "../src/demo/inbox/state";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("inbox vertical slice", () => {
  it("exposes visible tool schemas and metadata through the runtime", () => {
    const actions = createInboxActions();
    const runtime = createReactAppRuntime({
      initialState: createInitialInboxState([
        { id: "m1", subject: "Welcome back", opened: false },
      ]),
      reduce: reduceInboxState,
      actions: [actions.openMessage, actions.searchMessages],
      effects: createInboxEffects([
        { id: "m1", subject: "Welcome back", opened: false },
      ]),
      getRelevantViewTypes: getInboxRelevantViewTypes,
    });

    expect(runtime.actions.getVisibleTools()).toContainEqual(
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

  it("keeps GUI and TUI in sync after a tool call", async () => {
    const app = createInboxApp({
      initialMessages: [{ id: "m1", subject: "Welcome back", opened: false }],
    });

    const firstSnapshot = app.bridge.getSnapshotBundle();
    expect(firstSnapshot.views[0]?.type).toBe("Root");
    expect(firstSnapshot.views.map((view) => view.type)).toEqual([
      "Root",
      "Inbox",
    ]);
    expect(firstSnapshot.markup).toContain("App Navigation");
    expect(firstSnapshot.markup).toContain("InboxSearch");
    expect(firstSnapshot.markup).toContain("MessageDetail");
    expect(firstSnapshot.visibleTools).toContainEqual(
      expect.objectContaining({
        name: "openMessage",
        description: expect.any(String),
        inputSchema: expect.any(Object),
        meta: expect.objectContaining({
          supportsRefs: true,
        }),
      }),
    );
    expect(firstSnapshot.visibleTools).not.toContainEqual(
      expect.objectContaining({
        name: "searchMessages",
      }),
    );
    expect(app.gui.getVisibleSubjects()).toEqual(["Welcome back"]);

    const result = await app.bridge.executeTool(
      "openMessage",
      { message: "messages[0]" },
      firstSnapshot.snapshotId,
    );

    expect(result.success).toBe(true);
    expect(app.gui.getOpenedMessageId()).toBe("m1");
    expect(app.gui.getRecentTrace()).toContain("Opened message");

    const secondSnapshot = app.bridge.getSnapshotBundle();
    expect(secondSnapshot.views[0]?.type).toBe("Root");
    expect(secondSnapshot.views.some((view) => view.type === "MessageDetail")).toBe(true);
    expect(secondSnapshot.markup).toContain("Opened: true");
  });

  it("runs an effect action and refreshes GUI and TUI from the new state", async () => {
    const app = createInboxApp({
      initialMessages: [
        { id: "m1", subject: "Welcome back", opened: false },
        { id: "m2", subject: "Invoice ready", opened: false },
      ],
    });

    const snapshot = app.bridge.getSnapshotBundle();
    expect(snapshot.views[0]?.type).toBe("Root");
    expect(snapshot.views.some((view) => view.type === "InboxSearch")).toBe(false);
    expect(snapshot.visibleTools.map((tool) => tool.name)).toContain(
      "searchMessages",
    );
    const result = await app.bridge.executeTool(
      "searchMessages",
      { query: "Invoice" },
      snapshot.snapshotId,
    );

    expect(result.success).toBe(true);
    expect(app.gui.getVisibleSubjects()).toEqual(["Invoice ready"]);
    expect(app.gui.getRecentTrace()).toContain("Started search");
    expect(app.gui.render()).toContain("<gui-item>Invoice ready</gui-item>");

    const nextSnapshot = app.bridge.getSnapshotBundle();
    expect(nextSnapshot.views[0]?.type).toBe("Root");
    expect(nextSnapshot.views.some((view) => view.type === "InboxSearch")).toBe(true);
    expect(nextSnapshot.markup).toContain("Query: Invoice");
    expect(nextSnapshot.markup).toContain("(Invoice ready)[message:messages[0]]");
  });

  it("updates a mounted inbox GUI through runtime subscriptions", async () => {
    const initialMessages = [
      { id: "m1", subject: "Welcome back", opened: false },
      { id: "m2", subject: "Invoice ready", opened: false },
    ];
    const actions = createInboxActions();
    const runtime = createReactAppRuntime({
      initialState: createInitialInboxState(initialMessages),
      reduce: reduceInboxState,
      actions: [actions.openMessage, actions.searchMessages],
      effects: createInboxEffects(initialMessages),
      getRelevantViewTypes: getInboxRelevantViewTypes,
    });
    const root = document.createElement("div");
    document.body.append(root);

    await act(async () => {
      render(
        <AppRuntimeProvider runtime={runtime}>
          <InboxGUI />
        </AppRuntimeProvider>,
        root,
      );
    });

    expect(root.textContent).toContain("Welcome back");
    expect(root.textContent).toContain("Invoice ready");

    await act(async () => {
      await runtime.actions.callAction("searchMessages", { query: "Invoice" });
    });

    expect(root.textContent).toContain("Started search for Invoice");
    expect(runtime.trace.getRecent()).toEqual(
      expect.objectContaining({
        status: "succeeded",
        actionName: "searchMessages",
      }),
    );
    expect(root.textContent).toContain("Invoice ready");
    expect(root.textContent).not.toContain("Welcome back");
  });

  it("marks a snapshot stale when a mutating execution returns a failure", async () => {
    const bridge = createToolBridge({
      actionRuntime: {
        listVisibleTools() {
          return [];
        },
        async executeAction() {
          return {
            success: false,
            mutated: true,
            error: {
              code: "NO_MATCH",
              message: "No matching data",
            },
          };
        },
      },
      renderCurrentSnapshot() {
        return {
          snapshotId: "snapshot-1",
          generatedAt: Date.now(),
          markup: "demo",
          views: [],
          tui: "demo",
          refIndex: {},
          visibleTools: [],
        };
      },
    });

    const snapshot = bridge.getSnapshotBundle();
    const result = await bridge.executeTool("searchMessages", {}, snapshot.snapshotId);

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        mutated: true,
      }),
    );
    const staleResult = await bridge.executeTool(
      "searchMessages",
      {},
      snapshot.snapshotId,
    );

    expect(staleResult).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "SNAPSHOT_STALE",
        }),
      }),
    );
  });
});
