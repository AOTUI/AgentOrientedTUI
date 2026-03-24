import type { RefIndexEntry } from "../types";

export function createRefCollector() {
  const refIndex: Record<string, RefIndexEntry> = {};

  return {
    register(refId: string, entry: RefIndexEntry) {
      refIndex[refId] = structuredClone(entry);
    },
    snapshot() {
      return structuredClone(refIndex);
    },
  };
}
