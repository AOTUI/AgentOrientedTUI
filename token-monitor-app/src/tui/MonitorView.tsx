import { useEffect, useLLMOutputChannel, useRef, useState } from '@aotui/sdk';
import type { LLMOutputEvent } from '@aotui/sdk';
import type { TokenMonitorSettings, TokenUsageSnapshot } from '../types.js';

type MonitorViewProps = {
    settings: TokenMonitorSettings;
    history: TokenUsageSnapshot[];
    onUsage: (snapshot: TokenUsageSnapshot) => void;
};

export function MonitorView({ settings, history, onUsage }: MonitorViewProps) {
    const [modelLimits, setModelLimits] = useState<Record<string, number | null>>({});
    const modelLimitsRef = useRef(modelLimits);
    const modelsDevCacheRef = useRef<{ data?: any; promise?: Promise<any> }>({});

    useEffect(() => {
        modelLimitsRef.current = modelLimits;
    }, [modelLimits]);

    const fetchModelsDevData = async () => {
        if (modelsDevCacheRef.current.data) {
            return modelsDevCacheRef.current.data;
        }
        if (modelsDevCacheRef.current.promise) {
            return modelsDevCacheRef.current.promise;
        }
        const promise = fetch('https://models.dev/api.json')
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`models.dev API failed: ${response.statusText}`);
                }
                return response.json();
            })
            .then((data) => {
                modelsDevCacheRef.current.data = data;
                return data;
            })
            .finally(() => {
                modelsDevCacheRef.current.promise = undefined;
            });
        modelsDevCacheRef.current.promise = promise;
        return promise;
    };

    const resolveModelLimit = async (providerId: string, modelId: string) => {
        const key = `${providerId}:${modelId}`;
        if (modelLimitsRef.current[key] !== undefined) {
            return;
        }
        setModelLimits((prev) => ({ ...prev, [key]: null }));
        try {
            const data = await fetchModelsDevData();
            const limit = data?.[providerId]?.models?.[modelId]?.limit?.context ?? null;
            setModelLimits((prev) => ({ ...prev, [key]: limit }));
        } catch {
            setModelLimits((prev) => ({ ...prev, [key]: null }));
        }
    };

    useLLMOutputChannel((event: LLMOutputEvent) => {
        const usage = event.meta?.usage;
        if (!usage) {
            return;
        }
        const snapshot: TokenUsageSnapshot = {
            timestamp: event.timestamp,
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            model: event.meta?.model,
            providerId: event.meta?.providerId,
            modelId: event.meta?.modelId,
        };
        onUsage(snapshot);
        if (snapshot.providerId && snapshot.modelId) {
            void resolveModelLimit(snapshot.providerId, snapshot.modelId);
        }
    });

    const latest = history.length > 0 ? history[history.length - 1] : undefined;
    const latestKey = latest?.providerId && latest?.modelId ? `${latest.providerId}:${latest.modelId}` : undefined;
    const latestMaxTokens = latestKey ? modelLimits[latestKey] ?? null : null;
    const usagePercent = latest && latestMaxTokens ? Math.round((latest.totalTokens / latestMaxTokens) * 100) : null;
    const warnThreshold = settings.warnThresholdPercent;
    const shouldWarn = usagePercent !== null && usagePercent >= warnThreshold;
    const latestUsagePercent = usagePercent !== null ? `${usagePercent}%` : 'unknown';
    const latestTable = latest
        ? [
            '| timestamp | model | providerId | modelId | promptTokens | completionTokens | totalTokens | usagePercent |',
            '| --- | --- | --- | --- | --- | --- | --- | --- |',
            `| ${new Date(latest.timestamp).toLocaleTimeString()} | ${latest.model ?? 'unknown'} | ${latest.providerId ?? 'unknown'} | ${latest.modelId ?? 'unknown'} | ${latest.promptTokens} | ${latest.completionTokens} | ${latest.totalTokens} | ${latestUsagePercent} |`
        ].join('\n')
        : null;

    return (
        <div>
            <h1>Token Monitor View</h1>
            <p>Usage records come from LLMOutputEventMeta.usage.</p>
            <p>Model max tokens: {latestMaxTokens ?? 'Unknown'}</p>
            <p>Warn threshold: {warnThreshold}%</p>

            <h2>Latest Usage</h2>
            {latest ? (
                <pre>{latestTable}</pre>
            ) : (
                <p>No usage events yet.</p>
            )}

            <h2>Status</h2>
            {latestMaxTokens ? (
                shouldWarn ? (
                    <p>Warning: usage is above the threshold. Consider reducing context.</p>
                ) : (
                    <p>OK: usage is below the threshold.</p>
                )
            ) : (
                <p>Model limit is unavailable for usage percentage.</p>
            )}

        </div>
    );
}
