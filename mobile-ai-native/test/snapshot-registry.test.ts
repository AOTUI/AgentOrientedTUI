import { describe, expect, it } from "vitest";
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
});
