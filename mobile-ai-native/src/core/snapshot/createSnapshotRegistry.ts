import type {
  SnapshotBundle,
  SnapshotRegistry,
  SnapshotRegistryEntry,
} from "../types";

function evictOldSnapshots(
  snapshots: Map<string, SnapshotRegistryEntry>,
  maxEntries: number,
) {
  while (snapshots.size > maxEntries) {
    const oldestSnapshotId = snapshots.keys().next().value as
      | string
      | undefined;

    if (!oldestSnapshotId) {
      return;
    }

    snapshots.delete(oldestSnapshotId);
  }
}

export function createSnapshotRegistry(config?: {
  maxEntries?: number;
}): SnapshotRegistry {
  const maxEntries = Math.max(1, config?.maxEntries ?? 2);
  const snapshots = new Map<string, SnapshotRegistryEntry>();

  return {
    create(snapshot: SnapshotBundle) {
      snapshots.set(snapshot.snapshotId, {
        snapshot,
        status: "active",
      });
      evictOldSnapshots(snapshots, maxEntries);
      return snapshot;
    },
    lookup(snapshotId: string) {
      return snapshots.get(snapshotId);
    },
    markStale(snapshotId: string) {
      const entry = snapshots.get(snapshotId);
      if (!entry) {
        return;
      }

      snapshots.set(snapshotId, {
        ...entry,
        status: "stale",
      });
    },
  };
}
