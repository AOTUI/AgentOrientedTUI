import type { TokenMonitorSettings } from '../types.js';

type RootViewProps = {
    settings: TokenMonitorSettings;
    onUpdateSettings: (settings: TokenMonitorSettings) => void;
};

export function RootView({}: RootViewProps) {

    return (
        <div data-role="application-instruction">
            <h1>Token Monitor - Application Instruction</h1>
            <h2>What it is</h2>
            <p>Token Monitor observes LLM usage metadata and warns when usage exceeds a configured threshold.</p>
            <h2>How to use</h2>
            <ul>
                <li>Let the app capture LLM usage metadata automatically as model calls complete.</li>
                <li>Use the Root view to understand the monitoring setup and threshold behavior.</li>
                <li>Watch Token Monitor for warning states and the latest usage summary.</li>
            </ul>
            <h2>Views</h2>
            <h3>Root</h3>
            <p><strong>What it shows:</strong> The monitoring purpose and threshold semantics for warning behavior.</p>
            <p><strong>How to use:</strong> Start here to understand how warnings are computed before inspecting live usage output.</p>
            <h4>Tool Preconditions</h4>
            <ul>
                <li><strong>No direct tools</strong>: this view is informational and does not expose interactive tools.</li>
            </ul>
            <h3>TokenMonitor</h3>
            <p><strong>What it shows:</strong> The latest token usage snapshot and whether the configured warning threshold has been crossed.</p>
            <p><strong>How to use:</strong> Inspect this view after model activity to understand recent token usage and warning state.</p>
            <h4>Tool Preconditions</h4>
            <ul>
                <li><strong>No direct tools</strong>: this view reports state and does not expose interactive tools.</li>
            </ul>
        </div>
    );
}
