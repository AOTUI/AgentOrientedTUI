import type {
  SnapshotBundle,
  ToolDefinition,
  RefIndexEntry,
  ToolMetadata,
  ViewFragment,
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
  if (value === null) {
    return null;
  }

  const valueType = typeof value;
  if (
    valueType === "string" ||
    valueType === "boolean"
  ) {
    return value;
  }

  if (valueType === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(
        "Snapshot values must be plain JSON-like data; received a non-finite number.",
      );
    }

    return value;
  }

  if (
    valueType === "undefined" ||
    valueType === "function" ||
    valueType === "symbol" ||
    valueType === "bigint"
  ) {
    throw new Error(
      "Snapshot values must be plain JSON-like data; received an unsupported primitive value.",
    );
  }

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

    const clone: Record<string, unknown> = Object.create(null);
    seen.set(value, clone);
    for (const [key, nestedValue] of Object.entries(value)) {
      clone[key] = cloneReadonlyValue(nestedValue, seen);
    }
    return Object.freeze(clone);
  }

  if (typeof value === "object" && value !== null) {
    throw new Error(
      "Snapshot values must be plain JSON-like data; received a non-plain object.",
    );
  }

  return value;
}

function hardenRefIndex(
  refIndex: Readonly<Record<string, RefIndexEntry>>,
): Record<string, RefIndexEntry> {
  const clonedEntries = Object.create(null) as Record<string, RefIndexEntry>;

  for (const [refId, entry] of Object.entries(refIndex)) {
    clonedEntries[refId] = Object.freeze({
      type: entry.type,
      value: cloneReadonlyValue(entry.value),
    });
  }

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
      ...(tool.viewType ? { viewType: tool.viewType } : {}),
    }),
  );

  return Object.freeze(clonedTools);
}

function validateSnapshotCoherence(snapshot: {
  readonly markup: string;
  readonly views: readonly ViewFragment[];
}) {
  if (snapshot.views.length === 0) {
    return;
  }

  const derivedMarkup = snapshot.views.map((view) => view.markup).join("");

  if (snapshot.markup !== derivedMarkup) {
    throw new Error(
      "Snapshot markup must match the provided view fragments from the same render tick.",
    );
  }
}

export function hardenSnapshotBundle(snapshot: SnapshotBundle): SnapshotBundle {
  validateSnapshotCoherence(snapshot);

  return Object.freeze({
    snapshotId: snapshot.snapshotId,
    generatedAt: snapshot.generatedAt,
    markup: snapshot.markup,
    views: Object.freeze(
      snapshot.views.map((view) =>
        Object.freeze({
          id: view.id,
          type: view.type,
          name: view.name,
          markup: view.markup,
        }),
      ),
    ) as readonly ViewFragment[],
    tui: snapshot.tui,
    refIndex: hardenRefIndex(snapshot.refIndex),
    visibleTools: hardenVisibleTools(snapshot.visibleTools),
  });
}

export function createSnapshotBundle(input: {
  markup?: string;
  views?: readonly ViewFragment[];
  tui?: string;
  refIndex: Readonly<Record<string, RefIndexEntry>>;
  visibleTools: readonly ToolDefinition[];
}): SnapshotBundle {
  const generatedAt = Date.now();
  snapshotCounter += 1;
  const views = input.views ?? [];
  const derivedMarkup =
    views.length > 0 ? views.map((view) => view.markup).join("") : undefined;

  const markup = input.markup ?? derivedMarkup ?? input.tui ?? "";
  const tui = input.tui ?? markup;

  return hardenSnapshotBundle({
    snapshotId: `snap_${generatedAt}_${snapshotCounter}`,
    generatedAt,
    markup,
    views,
    tui,
    refIndex: input.refIndex,
    visibleTools: input.visibleTools,
  });
}
