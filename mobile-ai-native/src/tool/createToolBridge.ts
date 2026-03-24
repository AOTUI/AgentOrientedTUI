import type { SnapshotBundle, ActionResult, RefIndexEntry } from "../core/types";

function resolveRefArgs(
  input: Record<string, unknown>,
  refIndex: Record<string, RefIndexEntry>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value in refIndex) {
      resolved[key] = refIndex[value].value;
      continue;
    }

    resolved[key] = value;
  }

  return resolved;
}

export function createToolBridge(config: {
  actionRuntime: {
    listVisibleTools(): Array<{ name: string; description: string }>;
    executeAction(
      name: string,
      input: Record<string, unknown>,
    ): Promise<ActionResult>;
  };
  renderCurrentSnapshot(): SnapshotBundle;
}) {
  const snapshots = new Map<string, SnapshotBundle>();

  return {
    listTools() {
      return config.actionRuntime.listVisibleTools();
    },
    getSnapshotBundle() {
      const snapshot = config.renderCurrentSnapshot();
      snapshots.set(snapshot.snapshotId, snapshot);
      return snapshot;
    },
    async executeTool(
      name: string,
      input: Record<string, unknown>,
      snapshotId: string,
    ) {
      const snapshot = snapshots.get(snapshotId);
      if (!snapshot) {
        return {
          success: false,
          error: {
            code: "SNAPSHOT_NOT_FOUND",
            message: `Snapshot ${snapshotId} was not found`,
          },
        };
      }

      const resolved = resolveRefArgs(input, snapshot.refIndex);
      return config.actionRuntime.executeAction(name, resolved);
    },
  };
}
