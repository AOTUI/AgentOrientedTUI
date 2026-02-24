import { createTUIApp, View, useCallback, useState } from '@aotui/sdk';
import { RootView } from './RootView.js';
import { MonitorView } from './MonitorView.js';
import type { TokenUsageSnapshot, TokenMonitorSettings } from '../types.js';

function TokenMonitorRoot() {
    const [settings, setSettings] = useState<TokenMonitorSettings>({
        warnThresholdPercent: 75
    });
    const [history, setHistory] = useState<TokenUsageSnapshot[]>([]);

    const updateSettings = useCallback((next: TokenMonitorSettings) => {
        setSettings(next);
    }, []);

    const handleUsage = useCallback((snapshot: TokenUsageSnapshot) => {
        setHistory((prev: TokenUsageSnapshot[]) => {
            const next = [...prev, snapshot];
            return next.slice(-10);
        });
    }, []);

    return (
        <>
            <View id="root" type="Root" name="Root">
                <RootView settings={settings} onUpdateSettings={updateSettings} />
            </View>
            <View id="monitor" type="TokenMonitor" name="Token Monitor">
                <MonitorView settings={settings} history={history} onUsage={handleUsage} />
            </View>
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
