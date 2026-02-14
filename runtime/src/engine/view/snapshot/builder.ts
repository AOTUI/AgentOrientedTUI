/**
 * SnapshotBuilder - TUI Snapshot Aggregator
 * 
 * Combines Desktop metadata with Transformer output to create
 * complete TUI snapshots conforming to TUI_DEMO.md specification.
 */
import type { IndexMap, AppID } from '../../../spi/index.js';
import { Transformer } from '../transformer/index.js';
import { Desktop, InstalledApp, LogEntry } from '../../core/desktop.js';
import { SYSTEM_INSTRUCTION, formatTimestamp, formatAppStatus } from './templates.js';

export interface SnapshotResult {
    markup: string;
    indexMap: IndexMap;
}

export class SnapshotBuilder {
    private transformer: Transformer;
    private mergedIndexMap: IndexMap = {};

    constructor(transformer?: Transformer) {
        this.transformer = transformer || new Transformer();
    }

    /**
     * Build complete TUI snapshot from Desktop state
     */
    build(desktop: Desktop): SnapshotResult {
        this.mergedIndexMap = {};
        const parts: string[] = [];

        // 1. Build <desktop> section
        parts.push(this.buildDesktopSection(desktop));

        // 2. Build <application> sections for running apps
        const apps = desktop.getInstalledApps();
        for (const app of apps) {
            if (app.status === 'running') {
                parts.push(this.buildApplicationSection(desktop, app));
            }
        }

        return {
            markup: parts.join('\n\n'),
            indexMap: this.mergedIndexMap
        };
    }

    /**
     * Build <desktop> section with system info
     */
    private buildDesktopSection(desktop: Desktop): string {
        const apps = desktop.getInstalledApps();
        const logs = desktop.getSystemLogs();

        // [RFC-013] Format installed apps list with description
        const appsMarkup = apps.length === 0
            ? '- No applications installed.'
            : apps.map((app, index) => {
                const name = app.name || app.appId;
                const whatItIs = app.whatItIs ?? app.description ?? 'Not provided';
                const whenToUse = app.whenToUse ?? 'Not provided';
                return `${index + 1}. ${name}
    - Status: ${formatAppStatus(app.status)}
    - What it is: ${whatItIs}
    - When to use: ${whenToUse}`;
            }).join('\n');

        // Format system logs (last 5)
        const logsMarkup = logs.slice(-5).map(log =>
            `- [${formatTimestamp(log.timestamp)}] ${log.message}`
        ).join('\n');

        return `<desktop>

${SYSTEM_INSTRUCTION}

## Installed TUI Applications
${appsMarkup}

## System Logs
${logsMarkup || '- No logs yet.'}

</desktop>`;
    }

    /**
     * Build <application> section with app info and views
     */
    private buildApplicationSection(desktop: Desktop, app: InstalledApp): string {
        const logs = desktop.getAppOperationLogs(app.appId);
        const appName = app.name || app.appId;

        // [P1 Fix] Removed dead code: getAppContainer is deprecated/removed.
        // SnapshotBuilder no longer supports DOM traversal for apps.
        // Use getSnapshotFragments() in Kernel instead.
        const viewsMarkup = '';

        // Format operation logs (last 5)
        const logsMarkup = logs.slice(-5).map(log =>
            `- [${formatTimestamp(log.timestamp)}] ${log.message}`
        ).join('\n');

        // Build view tree (simplified version based on DOM structure)
        // [P1 Fix] SnapshotBuilder DOM traversal is disabled.
        const viewTree = this.buildViewTree(null);

        return `<application id="${app.appId}" name="${appName}">

<application_info>
## Operation Log
${logsMarkup || '- No operations yet.'}

## Application View Tree
${viewTree || '- No views.'}
</application_info>

${viewsMarkup}

</application>`;
    }

    /**
     * Build simplified view tree from app container
     */
    private buildViewTree(container: Element | null): string {
        if (!container) return '';

        // [H3 FIX] Query both mounted views AND unmounted view links (siblings)
        const elements = container.querySelectorAll('[view], [data-view-link]');
        if (elements.length === 0) return '- No views.';

        return Array.from(elements).map((el: Element) => {
            // Case 1: Mounted View
            if (el.hasAttribute('view')) {
                const viewName = el.getAttribute('name') || el.getAttribute('view') || 'Unknown';
                const viewId = el.id || 'unknown';
                const state = el.getAttribute('data-state');
                const stateStr = state === 'hidden' ? '' : ', mounted';
                return `- [${viewName}](view:${viewId}${stateStr})`;
            }
            // Case 2: Unmounted View Link (Sibling)
            else if (el.hasAttribute('data-view-link')) {
                const viewId = el.getAttribute('data-view-link');
                const text = el.textContent || 'View Link';
                return `- [${text}](view:${viewId})`;
            }
            return '';
        }).filter(Boolean).join('\n');
    }
}
