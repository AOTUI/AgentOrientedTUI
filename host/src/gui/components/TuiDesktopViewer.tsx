/**
 * TuiDesktopViewer Component
 * 
 * Main container component that renders the complete TUI Desktop.
 * Replaces PrettyTUI with modular block-based design.
 * 
 * @module system-chat/gui/components/TuiDesktopViewer
 */
import { useEffect, useMemo, useState } from 'react';
import { parseTuiSnapshot } from './TuiParser.js';
import { DesktopBlock } from './DesktopBlock.js';
import { ApplicationBlock } from './ApplicationBlock.js';

interface TuiDesktopViewerProps {
    snapshot: string;
    agentThinking?: string;
}

export function TuiDesktopViewer({ snapshot, agentThinking }: TuiDesktopViewerProps) {
    // Parse snapshot
    const parsed = useMemo(() => parseTuiSnapshot(snapshot), [snapshot]);
    const applications = parsed.desktop?.applications ?? [];
    const [activeAppId, setActiveAppId] = useState<string | null>(null);

    useEffect(() => {
        if (applications.length === 0) {
            setActiveAppId(null);
            return;
        }

        const stillExists = activeAppId && applications.some(app => app.id === activeAppId);
        if (stillExists) {
            return;
        }

        const defaultApp = applications.find(app => app.id === 'app_0') ?? applications[0];
        setActiveAppId(defaultApp.id);
    }, [applications, activeAppId]);

    // Handle empty or error state
    if (!parsed.desktop) {
        return (
            <div className="tui-desktop tui-desktop--empty">
                <div className="tui-empty-state">
                    <span className="tui-empty-icon">📡</span>
                    <p>Waiting for TUI snapshot...</p>
                    {parsed.parseErrors.length > 0 && (
                        <pre className="tui-parse-errors">
                            {parsed.parseErrors.join('\n')}
                        </pre>
                    )}
                </div>
            </div>
        );
    }

    const { desktop } = parsed;
    const activeApp = applications.find(app => app.id === activeAppId) ?? null;

    return (
        <div className="tui-desktop">
            {/* Noise texture overlay */}
            <div className="tui-desktop__noise" />

            {/* Desktop Block */}
            <DesktopBlock desktop={desktop} />

            {/* Application Switcher */}
            {applications.length > 0 && (
                <div className="tui-app-switcher">
                    <div className="tui-app-switcher__label">Current App</div>
                    <div className="tui-app-switcher__list">
                        {applications.map((app) => (
                            <button
                                key={app.id}
                                className={`tui-app-switcher__item ${app.id === activeAppId ? 'active' : ''}`}
                                onClick={() => setActiveAppId(app.id)}
                            >
                                <span className="tui-app-switcher__name">{app.name}</span>
                                <span className="tui-app-switcher__id">{app.id}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Application Block */}
            <div className="tui-app-grid">
                {activeApp ? (
                    <ApplicationBlock key={activeApp.id} app={activeApp} />
                ) : (
                    <div className="tui-empty-state">No applications found.</div>
                )}
            </div>

            {/* Agent Thinking Overlay */}
            {agentThinking && (
                <div className="tui-thinking-overlay">
                    <div className="tui-thinking-header">
                        <span className="thinking-indicator">◉</span>
                        <span>AGENT THINKING...</span>
                    </div>
                    <div className="tui-thinking-content">
                        <pre>{agentThinking}</pre>
                    </div>
                </div>
            )}
        </div>
    );
}
