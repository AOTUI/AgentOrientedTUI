export type TokenUsageSnapshot = {
    timestamp: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    model?: string;
    providerId?: string;
    modelId?: string;
};

export type TokenMonitorSettings = {
    warnThresholdPercent: number;
};
