/**
 * ApplicationBlock Component (Enhanced)
 * 
 * Renders an <application> block as a larger card with:
 * - Application info header with status
 * - Recent Operation Logs (3 most recent)
 * - View Tree status
 * - View switching tabs
 * 
 * @module system-chat/gui/components/ApplicationBlock
 */
import { useState } from 'react';
import type { TuiApplication } from './TuiParser.js';
import { extractRecentOperations, extractViewTree, getAppIcon } from './TuiParser.js';
import { ViewBlock } from './ViewBlock.js';

interface ApplicationBlockProps {
    app: TuiApplication;
}

export function ApplicationBlock({ app }: ApplicationBlockProps) {
    // Default to first view (view_0)
    const [activeViewIdx, setActiveViewIdx] = useState(0);

    const recentOps = extractRecentOperations(app.infoContent).slice(0, 3); // Limit to 3
    const viewTree = extractViewTree(app.infoContent);
    const activeView = app.views[activeViewIdx] || null;
    const appIcon = getAppIcon(app.name);

    return (
        <div className="tui-app-card">
            {/* Card Header */}
            <div className="tui-app-card-header">
                <div className="tui-app-card-title">
                    <span className="tui-app-card-icon">{appIcon}</span>
                    <div className="tui-app-card-info">
                        <span className="tui-app-card-name">{app.name}</span>
                        <span className="tui-app-card-id">{app.id}</span>
                    </div>
                </div>
                <div className="tui-app-card-status">
                    <span className="breathing-dot"></span>
                    <span className="status-badge status-badge--running">RUNNING</span>
                </div>
            </div>

            {/* Application Info Section: Operation Logs + View Tree */}
            <div className="tui-app-info-section">
                {/* Recent Operations (always visible, max 3) */}
                <div className="tui-app-info-block">
                    <div className="tui-app-info-label">Recent Operations</div>
                    <div className="tui-app-ops-list">
                        {recentOps.length > 0 ? (
                            recentOps.map((op, i) => (
                                <div key={i} className="tui-app-op-item">
                                    <span className="tui-op-icon">✓</span>
                                    <span className="tui-op-text">{op}</span>
                                </div>
                            ))
                        ) : (
                            <div className="tui-app-op-empty">No recent operations</div>
                        )}
                    </div>
                </div>

                {/* View Tree */}
                <div className="tui-app-info-block">
                    <div className="tui-app-info-label">View Tree</div>
                    <div className="tui-app-view-tree">
                        {viewTree ? (
                            <pre className="tui-view-tree-content">{viewTree}</pre>
                        ) : (
                            <div className="tui-view-tree-empty">No view tree</div>
                        )}
                    </div>
                </div>
            </div>

            {/* View Tabs */}
            {app.views.length > 1 && (
                <div className="tui-view-tabs">
                    <div className="tui-view-tabs-label">Views:</div>
                    <div className="tui-view-tabs-list">
                        {app.views.map((view, idx) => (
                            <button
                                key={view.id}
                                className={`tui-view-tab ${idx === activeViewIdx ? 'active' : ''}`}
                                onClick={() => setActiveViewIdx(idx)}
                            >
                                <span className="tui-view-tab-name">{view.name}</span>
                                <span className="tui-view-tab-id">{view.id}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Active View Content */}
            <div className="tui-app-card-content">
                {activeView ? (
                    <ViewBlock view={activeView} />
                ) : (
                    <div className="tui-no-view">No views available</div>
                )}
            </div>
        </div>
    );
}
