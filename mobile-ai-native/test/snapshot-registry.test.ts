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

  it("rejects duplicate snapshot ids instead of replacing existing credentials", () => {
    const registry = createSnapshotRegistry({ maxEntries: 2 });
    const original = registry.create({
      snapshotId: "snap_duplicate",
      generatedAt: 1,
      markup: "<screen>first</screen>",
      views: [],
      tui: "<screen>first</screen>",
      refIndex: {},
      visibleTools: [],
    });

    registry.markStale(original.snapshotId);

    expect(() =>
      registry.create({
        snapshotId: "snap_duplicate",
        generatedAt: 2,
        markup: "<screen>second</screen>",
        views: [],
        tui: "<screen>second</screen>",
        refIndex: {},
        visibleTools: [],
      }),
    ).toThrow(/snap_duplicate/);

    expect(registry.lookup(original.snapshotId)).toEqual(
      expect.objectContaining({
        status: "stale",
        snapshot: expect.objectContaining({
          tui: "<screen>first</screen>",
        }),
      }),
    );
  });

  it("rejects reusing a snapshot id after the original entry has been evicted", () => {
    const registry = createSnapshotRegistry({ maxEntries: 1 });
    const original = registry.create({
      snapshotId: "snap_reused_after_eviction",
      generatedAt: 1,
      markup: "<screen>first</screen>",
      views: [],
      tui: "<screen>first</screen>",
      refIndex: {},
      visibleTools: [],
    });

    const replacement = registry.create({
      snapshotId: "snap_other",
      generatedAt: 2,
      markup: "<screen>second</screen>",
      views: [],
      tui: "<screen>second</screen>",
      refIndex: {},
      visibleTools: [],
    });

    expect(registry.lookup(original.snapshotId)).toBeUndefined();
    expect(registry.lookup(replacement.snapshotId)).toEqual(
      expect.objectContaining({
        status: "active",
      }),
    );

    expect(() =>
      registry.create({
        snapshotId: "snap_reused_after_eviction",
        generatedAt: 3,
        markup: "<screen>third</screen>",
        views: [],
        tui: "<screen>third</screen>",
        refIndex: {},
        visibleTools: [],
      }),
    ).toThrow(/snap_reused_after_eviction/);
  });
});
