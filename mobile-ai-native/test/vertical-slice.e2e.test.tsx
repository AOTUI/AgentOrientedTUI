import { describe, expect, it } from "vitest";
import { createInboxApp } from "../src/demo/inbox/createInboxApp";

describe("inbox vertical slice", () => {
  it("keeps GUI and TUI in sync after a tool call", async () => {
    const app = createInboxApp({
      initialMessages: [{ id: "m1", subject: "Welcome back", opened: false }],
    });

    const firstSnapshot = app.bridge.getSnapshotBundle();
    expect(firstSnapshot.tui).toContain("(Welcome back)[message:messages[0]]");
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
    expect(secondSnapshot.tui).toContain("Opened: true");
  });

  it("runs an effect action and refreshes GUI and TUI from the new state", async () => {
    const app = createInboxApp({
      initialMessages: [
        { id: "m1", subject: "Welcome back", opened: false },
        { id: "m2", subject: "Invoice ready", opened: false },
      ],
    });

    const snapshot = app.bridge.getSnapshotBundle();
    const result = await app.bridge.executeTool(
      "searchMessages",
      { query: "Invoice" },
      snapshot.snapshotId,
    );

    expect(result.success).toBe(true);
    expect(app.gui.getVisibleSubjects()).toEqual(["Invoice ready"]);
    expect(app.gui.getRecentTrace()).toContain("Started search");

    const nextSnapshot = app.bridge.getSnapshotBundle();
    expect(nextSnapshot.tui).toContain("Query: Invoice");
    expect(nextSnapshot.tui).toContain("(Invoice ready)[message:messages[0]]");
  });
});
