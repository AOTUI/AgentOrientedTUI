import { describe, expect, it } from "vitest";
import { createSnapshotBundle } from "../src/core/snapshot/createSnapshotBundle";

describe("createSnapshotBundle", () => {
  it("creates an atomic snapshot bundle with generated metadata", () => {
    const bundle = createSnapshotBundle({
      tui: "<screen>hello</screen>",
      refIndex: {
        "messages[0]": {
          type: "message",
          value: { id: "m1" },
        },
      },
      visibleTools: [],
    });

    expect(bundle.snapshotId).toMatch(/^snap_/);
    expect(bundle.generatedAt).toBeTypeOf("number");
    expect(bundle.tui).toBe("<screen>hello</screen>");
    expect(bundle.refIndex["messages[0]"]).toEqual({
      type: "message",
      value: { id: "m1" },
    });
    expect(bundle.visibleTools).toEqual([]);
  });
});
