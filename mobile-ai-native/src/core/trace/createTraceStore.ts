import type { TraceRecord, TraceState, TraceStore } from "./types";

export function createTraceStore(): TraceStore {
  let nextTraceId = 1;
  let state: TraceState = {
    entries: [],
    recent: null,
  };
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((listener) => listener());
  }

  function record(entry: {
    actionName: string;
    status: TraceRecord["status"];
    summary: string;
  }): TraceRecord {
    const record: TraceRecord = {
      id: `trace_${nextTraceId++}`,
      actionName: entry.actionName,
      status: entry.status,
      summary: entry.summary,
      recordedAt: Date.now(),
    };

    state = {
      entries: [...state.entries, record],
      recent: record,
    };
    notify();

    return record;
  }

  return {
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    record,
  };
}
