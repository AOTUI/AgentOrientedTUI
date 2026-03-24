import type { SnapshotBundle, ToolDefinition, RefIndexEntry } from "../types";

let snapshotCounter = 0;

export function createSnapshotBundle(input: {
  tui: string;
  refIndex: Record<string, RefIndexEntry>;
  visibleTools: ToolDefinition[];
}): SnapshotBundle {
  const generatedAt = Date.now();
  snapshotCounter += 1;

  return Object.freeze({
    snapshotId: `snap_${generatedAt}_${snapshotCounter}`,
    generatedAt,
    tui: input.tui,
    refIndex: { ...input.refIndex },
    visibleTools: [...input.visibleTools],
  });
}
