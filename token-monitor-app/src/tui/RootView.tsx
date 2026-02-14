import { defineParams, useViewTypeTool } from '@aotui/sdk';
import type { TokenMonitorSettings } from '../types.js';

type RootViewProps = {
    settings: TokenMonitorSettings;
    onUpdateSettings: (settings: TokenMonitorSettings) => void;
};

export function RootView({ settings, onUpdateSettings }: RootViewProps) {

    return (
        <div>
            <h1>Token Monitor Application Instruction</h1>
            <h2>What Token Monitor is</h2>
            <p>Observe LLM usage metadata and warn when usage exceeds a threshold.</p>
            <h2>How to use Token Monitor</h2>
            <ul>
                <li>Let the app capture LLM output usage metadata automatically.</li>
                <li>Model limits are resolved from models.dev automatically.</li>
                <li>Watch the Token Monitor view for warnings.</li>
            </ul>
            <h2>Views of Token Monitor</h2>
            <h3>Root View</h3>
            <h4>Root View Instruction</h4>
            <p>Configure warning threshold for usage percentage.</p>
            <h3>Token Monitor View</h3>
            <h4>Token Monitor View Instruction</h4>
            <p>Shows latest usage and warning status based on your settings.</p>
            <h2>Current Settings</h2>
            <p>Warn threshold: {settings.warnThresholdPercent}%</p>
        </div>
    );
}
