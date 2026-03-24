import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSnapshotBundle } from "../src/core/snapshot/createSnapshotBundle";
import { createSnapshotRegistry } from "../src/core/snapshot/createSnapshotRegistry";

describe("createSnapshotRegistry", () => {
  it("looks up active snapshots, marks them stale, and evicts old entries", () => {
    const registry = createSnapshotRegistry({ maxEntries: 2 });
    const first = registry.create(
      createSnapshotBundle({
        tui: "<screen>first</screen>",
        refIndex: {},
        visibleTools: [],
      }),
    );
    const second = registry.create(
      createSnapshotBundle({
        tui: "<screen>second</screen>",
        refIndex: {},
        visibleTools: [],
      }),
    );

    expect(registry.lookup(first.snapshotId)).toEqual(
      expect.objectContaining({
        status: "active",
        snapshot: first,
      }),
    );

    registry.markStale(first.snapshotId);

    expect(registry.lookup(first.snapshotId)).toEqual(
      expect.objectContaining({
        status: "stale",
        snapshot: first,
      }),
    );

    const third = registry.create(
      createSnapshotBundle({
        tui: "<screen>third</screen>",
        refIndex: {},
        visibleTools: [],
      }),
    );

    expect(registry.lookup(first.snapshotId)).toBeUndefined();
    expect(registry.lookup(second.snapshotId)).toEqual(
      expect.objectContaining({
        status: "active",
        snapshot: second,
      }),
    );
    expect(registry.lookup(third.snapshotId)).toEqual(
      expect.objectContaining({
        status: "active",
        snapshot: third,
      }),
    );
  });

  it("hardens snapshot payloads and lookup results against caller mutation", () => {
    const registry = createSnapshotRegistry({ maxEntries: 2 });
    const snapshot = registry.create(
      createSnapshotBundle({
        tui: "<screen>inbox</screen>",
        refIndex: {
          "messages[0]": {
            type: "message",
            value: {
              id: "m1",
              subject: "Welcome back",
              tags: ["inbox"],
            },
          },
        },
        visibleTools: [
          {
            name: "openMessage",
            description: "Open a message",
            inputSchema: z.object({}),
            meta: {
              supportsRefs: true,
              tags: ["message"],
            },
          },
        ],
      }),
    );

    expect(() => {
      (
        snapshot.refIndex["messages[0]"].value as {
          tags: string[];
        }
      ).tags.push("mutated");
    }).toThrow();

    expect(() => {
      snapshot.visibleTools[0].meta.tags = ["mutated"];
    }).toThrow();

    const entry = registry.lookup(snapshot.snapshotId);

    expect(entry).toBeDefined();
    expect(() => {
      (entry as { status: string }).status = "active";
    }).toThrow();
    expect(entry?.status).toBe("active");
  });
});
