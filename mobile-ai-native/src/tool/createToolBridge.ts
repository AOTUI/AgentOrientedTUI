import type {
  SnapshotBundle,
  ActionResult,
  RefIndexEntry,
  SnapshotRegistry,
  ToolDefinition,
} from "../core/types";
import { createSnapshotRegistry } from "../core/snapshot/createSnapshotRegistry";

const DATA_REF_MARKER_PATTERN = /^\((?:[\s\S]*)\)\[[^:\]]+:(.+)\]$/;
const REF_ID_PATTERN = /^[A-Za-z0-9_.-]+(?:\[[^\]]+\])*$/;

function getExplicitRefId(value: string): string | undefined {
  const markerMatch = value.match(DATA_REF_MARKER_PATTERN);
  if (markerMatch) {
    return markerMatch[1];
  }

  if (REF_ID_PATTERN.test(value)) {
    return value;
  }

  return undefined;
}

function resolveRefArgs(
  input: Record<string, unknown>,
  refIndex: Record<string, RefIndexEntry>,
  supportsRefs: boolean,
):
  | { success: true; data: Record<string, unknown> }
  | { success: false; refId: string } {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (!supportsRefs || typeof value !== "string") {
      resolved[key] = value;
      continue;
    }

    if (typeof value === "string" && value in refIndex) {
      resolved[key] = refIndex[value].value;
      continue;
    }

    const explicitRefId = getExplicitRefId(value);
    if (explicitRefId) {
      if (explicitRefId in refIndex) {
        resolved[key] = refIndex[explicitRefId].value;
        continue;
      }

      return {
        success: false,
        refId: explicitRefId,
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

      const toolDefinition =
        snapshotEntry.snapshot.visibleTools.find((tool) => tool.name === name) ??
        config.actionRuntime.listVisibleTools().find((tool) => tool.name === name);
      const supportsRefs = toolDefinition?.meta?.supportsRefs === true;

      const resolved = resolveRefArgs(
        input,
        snapshotEntry.snapshot.refIndex,
        supportsRefs,
      );
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

      if (result.mutated) {
        if (snapshots.markAllStale) {
          snapshots.markAllStale();
        } else {
          snapshots.markStale(snapshotId);
        }
      }

      return result;
    },
  };
}
