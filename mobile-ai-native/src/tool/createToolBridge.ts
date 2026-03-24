import type {
  SnapshotBundle,
  ActionResult,
  RefIndexEntry,
  SnapshotRegistry,
  ToolDefinition,
} from "../core/types";
import { createSnapshotRegistry } from "../core/snapshot/createSnapshotRegistry";

function resolveRefArgs(
  input: Record<string, unknown>,
  refIndex: Record<string, RefIndexEntry>,
):
  | { success: true; data: Record<string, unknown> }
  | { success: false; refId: string } {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value in refIndex) {
      resolved[key] = refIndex[value].value;
      continue;
    }

    if (
      typeof value === "string" &&
      (value.includes("[") || value.includes("]"))
    ) {
      return {
        success: false,
        refId: value,
      };
    }

    resolved[key] = value;
  }

  return {
    success: true,
    data: resolved,
  };
}

export function createToolBridge(config: {
  actionRuntime: {
    listVisibleTools(): ToolDefinition[];
    executeAction(
      name: string,
      input: Record<string, unknown>,
    ): Promise<ActionResult>;
  };
  renderCurrentSnapshot(): SnapshotBundle;
  snapshotRegistry?: SnapshotRegistry;
}) {
  const snapshots =
    config.snapshotRegistry ??
    createSnapshotRegistry({
      maxEntries: 2,
    });

  return {
    listTools() {
      return config.actionRuntime.listVisibleTools();
    },
    getSnapshotBundle() {
      const snapshot = config.renderCurrentSnapshot();
      return snapshots.create(snapshot);
    },
    async executeTool(
      name: string,
      input: Record<string, unknown>,
      snapshotId: string,
    ) {
      const snapshotEntry = snapshots.lookup(snapshotId);
      if (!snapshotEntry) {
        return {
          success: false,
          error: {
            code: "SNAPSHOT_NOT_FOUND",
            message: `Snapshot ${snapshotId} was not found`,
          },
        };
      }

      if (snapshotEntry.status === "stale") {
        return {
          success: false,
          error: {
            code: "SNAPSHOT_STALE",
            message: `Snapshot ${snapshotId} is stale`,
          },
        };
      }

      const resolved = resolveRefArgs(input, snapshotEntry.snapshot.refIndex);
      if (!resolved.success) {
        return {
          success: false,
          error: {
            code: "REF_NOT_FOUND",
            message: `Reference ${resolved.refId} was not found in snapshot ${snapshotId}`,
          },
        };
      }

      const result = await config.actionRuntime.executeAction(name, resolved.data);

      if (result.success && result.mutated) {
        snapshots.markStale(snapshotId);
      }

      return result;
    },
  };
}
