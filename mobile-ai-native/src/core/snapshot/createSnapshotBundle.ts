import type {
  SnapshotBundle,
  ToolDefinition,
  RefIndexEntry,
  ToolMetadata,
} from "../types";

let snapshotCounter = 0;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneReadonlyValue(
  value: unknown,
  seen = new WeakMap<object, unknown>(),
): unknown {
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return seen.get(value);
    }

    const clone: unknown[] = [];
    seen.set(value, clone);
    for (const item of value) {
      clone.push(cloneReadonlyValue(item, seen));
    }
    return Object.freeze(clone);
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) {
      return seen.get(value);
    }

    const clone: Record<string, unknown> = {};
    seen.set(value, clone);
    for (const [key, nestedValue] of Object.entries(value)) {
      clone[key] = cloneReadonlyValue(nestedValue, seen);
    }
    return Object.freeze(clone);
  }

  return value;
}

function hardenRefIndex(
  refIndex: Record<string, RefIndexEntry>,
): Record<string, RefIndexEntry> {
  const clonedEntries = Object.fromEntries(
    Object.entries(refIndex).map(([refId, entry]) => [
      refId,
      Object.freeze({
        type: entry.type,
        value: cloneReadonlyValue(entry.value),
      }),
    ]),
  );

  return Object.freeze(clonedEntries);
}

function hardenVisibleTools(
  visibleTools: readonly ToolDefinition[],
): readonly ToolDefinition[] {
  const clonedTools = visibleTools.map((tool) =>
    Object.freeze({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      meta: cloneReadonlyValue(tool.meta) as ToolMetadata,
    }),
  );

  return Object.freeze(clonedTools);
}

export function hardenSnapshotBundle(snapshot: SnapshotBundle): SnapshotBundle {
  return Object.freeze({
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    tui: snapshot.tui,
    refIndex: hardenRefIndex(snapshot.refIndex),
    visibleTools: hardenVisibleTools(snapshot.visibleTools),
  });
}

export function createSnapshotBundle(input: {
  tui: string;
  refIndex: Record<string, RefIndexEntry>;
  visibleTools: readonly ToolDefinition[];
}): SnapshotBundle {
  const generatedAt = Date.now();
  snapshotCounter += 1;

  return hardenSnapshotBundle({
    snapshotId: `snap_${generatedAt}_${snapshotCounter}`,
    generatedAt,
    tui: input.tui,
    refIndex: input.refIndex,
    visibleTools: input.visibleTools,
  });
}
