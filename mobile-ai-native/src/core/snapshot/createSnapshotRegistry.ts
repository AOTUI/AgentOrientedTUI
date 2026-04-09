import type {
  SnapshotBundle,
  SnapshotRegistry,
  SnapshotRegistryEntry,
} from "../types";
import { hardenSnapshotBundle } from "./createSnapshotBundle";

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
  const seenSnapshotIds = new Set<string>();

  function createEntry(
    snapshot: SnapshotBundle,
    status: SnapshotRegistryEntry["status"],
  ): SnapshotRegistryEntry {
    return Object.freeze({
      snapshot,
      status,
    });
  }

  return {
    create(snapshot: SnapshotBundle) {
      const hardenedSnapshot = hardenSnapshotBundle(snapshot);
      if (seenSnapshotIds.has(hardenedSnapshot.snapshotId)) {
        throw new Error(
          `Snapshot ${hardenedSnapshot.snapshotId} is already registered`,
        );
      }

      seenSnapshotIds.add(hardenedSnapshot.snapshotId);
      snapshots.set(
        hardenedSnapshot.snapshotId,
        createEntry(hardenedSnapshot, "active"),
      );
      evictOldSnapshots(snapshots, maxEntries);
      return hardenedSnapshot;
    },
    lookup(snapshotId: string) {
      return snapshots.get(snapshotId);
    },
    markStale(snapshotId: string) {
      const entry = snapshots.get(snapshotId);
      if (!entry) {
        return;
      }

      snapshots.set(snapshotId, createEntry(entry.snapshot, "stale"));
    },
    markAllStale() {
      for (const snapshotId of snapshots.keys()) {
        const entry = snapshots.get(snapshotId);
        if (!entry || entry.status === "stale") {
          continue;
        }

        snapshots.set(snapshotId, createEntry(entry.snapshot, "stale"));
      }
    },
  };
}
