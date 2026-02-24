import { createTUIApp, View, useCallback, useEffect, useLLMOutputChannel, useRef, useState } from '@aotui/sdk';
import type { LLMOutputEvent } from '@aotui/sdk';
import { RootView } from './RootView.js';
import { MonitorView } from './MonitorView.js';
import type { TokenUsageSnapshot, TokenMonitorSettings } from '../types.js';

function TokenMonitorRoot() {
    const [settings, setSettings] = useState<TokenMonitorSettings>({
        warnThresholdPercent: 75
    });
    const [history, setHistory] = useState<TokenUsageSnapshot[]>([]);
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

    const updateSettings = useCallback((next: TokenMonitorSettings) => {
        setSettings(next);
    }, []);

    const handleUsage = useCallback((snapshot: TokenUsageSnapshot) => {
        setHistory((prev: TokenUsageSnapshot[]) => {
            const next = [...prev, snapshot];
            return next.slice(-10);
        });
    }, []);

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

        handleUsage(snapshot);

        if (snapshot.providerId && snapshot.modelId) {
            void resolveModelLimit(snapshot.providerId, snapshot.modelId);
        }
    });

    const latest = history.length > 0 ? history[history.length - 1] : undefined;
    const latestKey = latest?.providerId && latest?.modelId
        ? `${latest.providerId}:${latest.modelId}`
        : undefined;
    const latestMaxTokens = latestKey ? modelLimits[latestKey] ?? null : null;
    const usagePercent = latest && latestMaxTokens
        ? Math.round((latest.totalTokens / latestMaxTokens) * 100)
        : null;
    const shouldWarn = usagePercent !== null && usagePercent >= settings.warnThresholdPercent;

    return (
        <>
            <View id="root" type="Root" name="Root">
                <RootView settings={settings} onUpdateSettings={updateSettings} />
            </View>
            {shouldWarn ? (
                <View id="monitor" type="TokenMonitor" name="Token Monitor">
                    <MonitorView settings={settings} history={history} latestMaxTokens={latestMaxTokens} />
                </View>
            ) : null}
        </>
    );
}

export default createTUIApp({
    appName: 'token_monitor_app',
    name: 'Token Monitor App',
    whatItIs: 'A real-time token usage monitoring system that tracks LLM context consumption, automatically resolves model limits from models.dev, and warns when usage exceeds configurable thresholds. Maintains a history of the last 10 usage snapshots for trend analysis.',
    whenToUse: 'Use Token Monitor when you need to: (1) Track real-time token consumption during LLM interactions, (2) Avoid context overflow by monitoring usage percentage, (3) Optimize prompt efficiency by analyzing token usage patterns, (4) Set custom warning thresholds for proactive alerts, (5) Review historical usage trends from recent interactions.',
    component: TokenMonitorRoot,
    signalPolicy: 'never'
});
