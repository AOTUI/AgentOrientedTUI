export type TraceStatus = "started" | "updated" | "succeeded" | "failed";

export type TraceRecord = {
  id: string;
  actionName: string;
  status: TraceStatus;
  summary: string;
  recordedAt: number;
};

export type TraceState = {
  entries: TraceRecord[];
  recent: TraceRecord | null;
};

export type TraceStore = {
  getState(): TraceState;
  subscribe(listener: () => void): () => void;
  record(entry: {
    actionName: string;
    status: TraceStatus;
    summary: string;
  }): TraceRecord;
};
