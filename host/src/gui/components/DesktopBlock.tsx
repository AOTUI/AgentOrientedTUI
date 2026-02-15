/**
 * DesktopBlock Component (Enhanced)
 * 
 * Renders the <desktop> block with:
 * - Visual app icon grid
 * - CLI-style system logs
 * - Collapsible system instructions
 * 
 * @module system-chat/gui/components/DesktopBlock
 */
import { useState } from 'react';
import type { TuiDesktop } from './TuiParser.js';
import {
    extractInstalledApps,
    extractPendingApps,
    extractSystemLogs,
    extractSystemInstructions,
    getAppIcon,
    type InstalledApp,
    type SystemLog
} from './TuiParser.js';
import { marked } from 'marked';

interface DesktopBlockProps {
    desktop: TuiDesktop;
}

export function DesktopBlock({ desktop }: DesktopBlockProps) {
    const [showInstructions, setShowInstructions] = useState(false);

    // Extract structured data
    const installedApps = extractInstalledApps(desktop.content);
    const pendingApps = extractPendingApps(desktop.content);
    const systemLogs = extractSystemLogs(desktop.content);
    const instructions = extractSystemInstructions(desktop.content);
    const instructionsHtml = marked(instructions, { async: false }) as string;

    return (
        <div className="tui-desktop-block">
            {/* Header */}
            <div className="tui-desktop-header">
                <div className="tui-desktop-title">
                    <span className="breathing-dot"></span>
                    <span className="tui-desktop-label">AGENT ENVIRONMENT</span>
                    <span className="tui-desktop-status">ONLINE</span>
                </div>
                <div className="tui-desktop-time">
                    {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
            </div>

            {/* App Icon Grid (Running) */}
            <div className="tui-apps-section">
                <div className="tui-section-header">
                    <span className="tui-section-title">Running Applications</span>
                    <span className="tui-section-count">{installedApps.length} active</span>
                </div>
                {installedApps.length > 0 ? (
                    <div className="tui-app-icons">
                        {installedApps.map(app => (
                            <AppIcon key={app.id} app={app} />
                        ))}
                    </div>
                ) : (
                    <div className="tui-empty-state">No running apps</div>
                )}
            </div>

            {/* App Icon Grid (Pending) */}
            {pendingApps.length > 0 && (
                <div className="tui-apps-section pending">
                    <div className="tui-section-header">
                        <span className="tui-section-title">Available Apps (Not Started)</span>
                        <span className="tui-section-count">{pendingApps.length} available</span>
                    </div>
                    <div className="tui-app-icons">
                        {pendingApps.map(app => (
                            <AppIcon key={app.id} app={app} />
                        ))}
                    </div>
                </div>
            )}

            {/* CLI-style System Logs */}
            <div className="tui-logs-section">
                <div className="tui-section-header">
                    <span className="tui-section-title">System Logs</span>
                    <span className="tui-cli-badge">CLI</span>
                </div>
                <div className="tui-cli-terminal">
                    {systemLogs.slice(-5).map((log, i) => (
                        <div key={i} className="tui-cli-line">
                            <span className="tui-cli-time">[{log.timestamp.split(' ')[1]}]</span>
                            <span className="tui-cli-msg">{log.message}</span>
                        </div>
                    ))}
                    {systemLogs.length === 0 && (
                        <div className="tui-cli-line tui-cli-empty">No logs yet...</div>
                    )}
                </div>
            </div>

            {/* Collapsible Instructions */}
            <div className="tui-instructions-section">
                <button
                    className="tui-expand-btn"
                    onClick={() => setShowInstructions(!showInstructions)}
                >
                    <span className={`tui-expand-icon ${showInstructions ? 'expanded' : ''}`}>▸</span>
                    <span>View Full Desktop Instructions</span>
                </button>
                {showInstructions && (
                    <div
                        className="tui-instructions-content tui-markdown"
                        dangerouslySetInnerHTML={{ __html: instructionsHtml }}
                    />
                )}
            </div>
        </div>
    );
}

// ============ Sub-components ============

function AppIcon({ app }: { app: InstalledApp }) {
    const icon = getAppIcon(app.name);

    return (
        <div className={`tui-app-icon ${app.status === 'running' ? 'running' : ''}`}>
            <div className="tui-app-icon-emoji">{icon}</div>
            <div className="tui-app-icon-name">{app.name}</div>
            <div className="tui-app-icon-status">
                <span className={`tui-status-dot ${app.status}`}></span>
                <span className="tui-status-text">{app.status.toUpperCase()}</span>
            </div>
        </div>
    );
}
