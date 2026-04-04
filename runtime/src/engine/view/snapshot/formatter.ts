/**
 * SnapshotFormatter - TUI Snapshot Formatter
 *
 * [RFC-007] Transforms Worker fragments and Desktop metadata into
 * complete TUI snapshots conforming to TUI_DEMO.md format.
 * [RFC-014] Added structured output for semantic separation.
 *
 * @module @aotui/runtime/engine/view/snapshot/formatter
 */

import type {
    ISnapshotFormatter,
    ISnapshotFragment,
    IDesktopMetadata,
    FormattedSnapshotResult,
    StructuredSnapshot,
    AppStateFragment,
    ApplicationInstructionFragment,
    ViewStateFragment,
} from '../../../spi/index.js';
import { SYSTEM_INSTRUCTION, SYSTEM_INSTRUCTION_PURE, formatTimestamp, formatAppStatus } from './templates.js';

/**
 * [RFC-014] Extended snapshot result with structured output
 */
export interface ExtendedSnapshotResult extends FormattedSnapshotResult {
    /** [RFC-014] Structured output for semantic separation */
    structured: StructuredSnapshot;
}

/**
 * SnapshotFormatter configuration
 */
export interface SnapshotFormatterConfig {
    /** Maximum system logs to include (default: 5) */
    systemLogLimit?: number;
    /** Maximum app operation logs to include (default: 3) */
    appLogLimit?: number;
}

/**
 * SnapshotFormatter Implementation
 *
 * Assembles complete TUI snapshots from:
 * 1. Desktop metadata (`<desktop>` section)
 * 2. Worker fragments (`<application>` sections)
 *
 * [RFC-014] Now also returns structured output for semantic separation.
 *
 * @example
 * ```typescript
 * const formatter = new SnapshotFormatter();
 * const { markup, indexMap, structured } = formatter.format(fragments, metadata);
 * ```
 */
export class SnapshotFormatter implements ISnapshotFormatter {
    private readonly systemLogLimit: number;
    private readonly appLogLimit: number;

    constructor(config?: SnapshotFormatterConfig) {
        this.systemLogLimit = config?.systemLogLimit ?? 5;
        this.appLogLimit = config?.appLogLimit ?? 3;
    }

    private resolveUniqueToolKey(rawKey: string, mergedIndexMap: Record<string, unknown>): string {
        if (!(rawKey in mergedIndexMap)) {
            return rawKey;
        }

        const toolPrefix = 'tool:';
        const normalized = rawKey.startsWith(toolPrefix) ? rawKey.slice(toolPrefix.length) : rawKey;
        const dashIndex = normalized.indexOf('-');

        const appName = dashIndex > 0 ? normalized.slice(0, dashIndex) : normalized;
        const rest = dashIndex > 0 ? normalized.slice(dashIndex + 1) : '';

        let suffix = 2;
        while (true) {
            const candidateCore = rest.length > 0
                ? `${appName}_${suffix}-${rest}`
                : `${appName}_${suffix}`;
            const candidate = `${toolPrefix}${candidateCore}`;
            if (!(candidate in mergedIndexMap)) {
                return candidate;
            }
            suffix += 1;
        }
    }

    /**
     * Format complete TUI snapshot
     * 
     * [RFC-014] Now returns both legacy markup and structured output.
     */
    format(
        fragments: ReadonlyArray<ISnapshotFragment>,
        metadata: IDesktopMetadata
    ): ExtendedSnapshotResult {
        const parts: string[] = [];
        const mergedIndexMap: Record<string, unknown> = {};
        const applicationInstructions: ApplicationInstructionFragment[] = [];
        const instructionKeys = new Set<string>();

        // 1. Build <desktop> section (legacy - includes SYSTEM_INSTRUCTION)
        parts.push(this.buildDesktopSection(metadata));

        // 2. Build <application> sections for each running app
        const appStates: AppStateFragment[] = [];
        const viewStates: ViewStateFragment[] = [];
        for (const fragment of fragments) {
            parts.push(this.buildApplicationSection(fragment, metadata));

            // [RFC-014] Collect app state for structured output
            const apps = metadata.getInstalledApps();
            const appInfo = apps.find(a => a.appId === fragment.appId);
            appStates.push({
                appId: fragment.appId,
                appName: appInfo?.name ?? fragment.appId,
                markup: this.buildApplicationSection(fragment, metadata),
                timestamp: fragment.timestamp,
                role: appInfo?.promptRole
            });

            if (fragment.applicationInstructions && fragment.applicationInstructions.length > 0) {
                for (const instruction of fragment.applicationInstructions) {
                    const normalized = this.normalizeApplicationInstruction(
                        fragment,
                        appInfo?.name,
                        appInfo?.promptRole,
                        instruction,
                    );
                    this.pushUniqueApplicationInstruction(applicationInstructions, instructionKeys, normalized);
                }
            }

            if (fragment.views && fragment.views.length > 0) {
                for (const view of fragment.views) {
                    if (this.isApplicationInstructionView(view)) {
                        const normalized = this.normalizeApplicationInstruction(
                            fragment,
                            appInfo?.name,
                            appInfo?.promptRole,
                            view,
                        );
                        this.pushUniqueApplicationInstruction(applicationInstructions, instructionKeys, normalized);
                        continue;
                    }

                    viewStates.push({
                        appId: fragment.appId,
                        appName: appInfo?.name ?? fragment.appId,
                        viewId: view.viewId,
                        viewType: view.viewType,
                        viewName: view.viewName,
                        markup: view.markup,
                        timestamp: view.timestamp,
                        role: appInfo?.promptRole,
                    });
                }
            }

            // Merge indexMap with appId namespace
            // fragment.indexMap keys are in "viewId:refId" format
            // BUT: operation metadata keys are "tool:app_0.view_0.op_name" (already complete)

            // console.log(`[SnapshotFormatter] Fragment from ${fragment.appId}, indexMap keys:`, Object.keys(fragment.indexMap));

            for (const [key, value] of Object.entries(fragment.indexMap)) {
                // Skip operation metadata (already contains full path)
                if (key.startsWith('tool:')) {
                    // console.log(`[SnapshotFormatter] Preserving operation metadata: ${key}`);
                    const resolvedKey = this.resolveUniqueToolKey(key, mergedIndexMap);
                    mergedIndexMap[resolvedKey] = value;
                    continue;
                }

                // Only add appId prefix for data references
                const fullKey = `${fragment.appId}:${key}`;
                // console.log(`[SnapshotFormatter] Adding data ref: ${key} → ${fullKey}`);
                mergedIndexMap[fullKey] = value;
            }
        }

        // [RFC-014] Build structured output
        const structured: StructuredSnapshot = {
            systemInstruction: SYSTEM_INSTRUCTION_PURE,
            desktopState: this.buildDesktopStateOnly(metadata),
            desktopTimestamp: this.computeDesktopTimestamp(metadata, appStates, viewStates),
            applicationInstructions,
            appStates,
            viewStates,
        };

        return {
            markup: parts.join('\n\n'),
            indexMap: mergedIndexMap,
            structured
        };
    }

    private pushUniqueApplicationInstruction(
        applicationInstructions: ApplicationInstructionFragment[],
        instructionKeys: Set<string>,
        instruction: ApplicationInstructionFragment,
    ): void {
        const key = [
            instruction.appId,
            instruction.viewId,
            instruction.viewType,
            instruction.timestamp ?? '',
            instruction.markup,
        ].join('|');

        if (instructionKeys.has(key)) {
            return;
        }

        instructionKeys.add(key);
        applicationInstructions.push(instruction);
    }

    private isApplicationInstructionView(view: {
        kind?: unknown;
        markup?: unknown;
    }): boolean {
        if (view.kind === 'application-instruction') {
            return true;
        }

        const markup = typeof view.markup === 'string' ? view.markup : '';
        return markup.includes('data-role="application-instruction"')
            || markup.includes("data-role='application-instruction'");
    }

    private normalizeApplicationInstruction(
        fragment: ISnapshotFragment,
        fallbackAppName: string | undefined,
        fallbackRole: 'user' | 'assistant' | undefined,
        source: {
            appId?: string;
            appName?: string;
            viewId?: string;
            viewType?: string;
            viewName?: string;
            markup?: string;
            timestamp?: number;
            digest?: string;
            role?: 'user' | 'assistant';
        },
    ): ApplicationInstructionFragment {
        return {
            appId: source.appId || fragment.appId,
            appName: source.appName || fallbackAppName || fragment.appId,
            viewId: source.viewId || 'root',
            viewType: source.viewType || 'Root',
            viewName: source.viewName,
            markup: source.markup || '',
            timestamp: source.timestamp ?? fragment.timestamp,
            digest: source.digest,
            role: source.role || fallbackRole,
            kind: 'application-instruction',
        };
    }

    /**
     * [RFC-014] Build desktop state without system instruction
     * 
     * Returns only "Where" information:
     * - Installed Applications
     * - System Logs
     */
    private buildDesktopStateOnly(metadata: IDesktopMetadata): string {
        let apps: ReadonlyArray<{ appId: string; name: string; status: 'pending' | 'running' | 'paused' | 'closed' | 'collapsed'; description?: string; whatItIs?: string; whenToUse?: string }> = [];
        let logs: ReadonlyArray<{ timestamp: number; message: string }> = [];

        try {
            apps = metadata.getInstalledApps();
        } catch { /* graceful degradation */ }

        try {
            logs = metadata.getSystemLogs(this.systemLogLimit);
        } catch { /* graceful degradation */ }

        // Format apps
        const appsMarkup = this.formatAppsMarkup(apps);

        // Format logs
        const logsMarkup = logs.length > 0
            ? logs.map(log => `- [${formatTimestamp(log.timestamp)}] ${log.message}`).join('\n')
            : '- No recent activity.';

        return `<desktop>

    ## Installed TUI Applications
    ${appsMarkup}

## System Logs
${logsMarkup}

</desktop>`;
    }

    private computeDesktopTimestamp(
        metadata: IDesktopMetadata,
        _appStates: ReadonlyArray<AppStateFragment>,
        _viewStates: ReadonlyArray<ViewStateFragment>
    ): number | undefined {
        const candidates: number[] = [];

        try {
            const logs = metadata.getSystemLogs(this.systemLogLimit);
            for (const log of logs) {
                if (typeof log.timestamp === 'number') {
                    candidates.push(log.timestamp);
                }
            }
        } catch {
            // Graceful degradation: desktop timestamp is best-effort metadata.
        }

        if (candidates.length === 0) {
            return undefined;
        }

        return Math.max(...candidates);
    }

    /**
     * Format apps list markup (shared between legacy and structured output)
     */
    private formatAppsMarkup(
        apps: ReadonlyArray<{ appId: string; name: string; status: 'pending' | 'running' | 'paused' | 'closed' | 'collapsed'; description?: string; whatItIs?: string; whenToUse?: string }>
    ): string {
        if (apps.length === 0) {
            return '- No applications installed.';
        }

        return apps.map((app, index) => {
            const name = app.name || app.appId;
            const whatItIs = app.whatItIs ?? app.description ?? 'Not provided';
            const whenToUse = app.whenToUse ?? 'Not provided';
            const lines = [
                `${index + 1}. ${name}`,
                `    - Status: ${formatAppStatus(app.status)}`,
                `    - What it is: ${whatItIs}`,
                `    - When to use: ${whenToUse}`,
            ];
            return lines.join('\n');
        }).join('\n');
    }

    /**
     * Build <desktop> section with system info
     */
    private buildDesktopSection(metadata: IDesktopMetadata): string {
        let apps: ReadonlyArray<{ appId: string; name: string; status: 'pending' | 'running' | 'paused' | 'closed' | 'collapsed'; description?: string; whatItIs?: string; whenToUse?: string }> = [];
        let logs: ReadonlyArray<{ timestamp: number; message: string }> = [];

        // Graceful degradation for missing methods
        try {
            apps = metadata.getInstalledApps();
        } catch {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[SnapshotFormatter] getInstalledApps() failed, using empty array');
            }
        }

        try {
            logs = metadata.getSystemLogs(this.systemLogLimit);
        } catch {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('[SnapshotFormatter] getSystemLogs() failed, using empty array');
            }
        }

        // Format installed apps list
        // [RFC-014] Group apps by status: Running vs Available (Pending)
        const runningApps = apps.filter(a => a.status === 'running' || a.status === 'paused' || a.status === 'collapsed' || a.status === 'closed');
        const pendingApps = apps.filter(a => a.status === 'pending');

        let appsMarkup = '';

        if (runningApps.length > 0) {
            appsMarkup += '### Running Applications\n';
            appsMarkup += runningApps.map(app => {
                const lines = [
                    `- [${app.name}](application:${app.appId})`,
                    `    - State: ${formatAppStatus(app.status)}`
                ];
                if (app.description) {
                    lines.push(`    - Description: ${app.description}`);
                }
                return lines.join('\n');
            }).join('\n');
            appsMarkup += '\n\n';
        }

        if (pendingApps.length > 0) {
            appsMarkup += '### Available Applications (Not Started)\n';
            appsMarkup += pendingApps.map(app => {
                const lines = [
                    `- [${app.name}](application:${app.appId})`, // Same link format as running apps
                    `    - State: pending`,
                    `    - Description: ${app.description || 'No description available'}`,
                    `    - Action: Call \`open_app({ app_id: "${app.appId}" })\` to start`
                ];
                return lines.join('\n');
            }).join('\n');
        }

        if (apps.length === 0) {
            appsMarkup = '- No applications installed.';
        }

        // Format system logs (most recent first)
        const logsMarkup = logs.length > 0
            ? logs.map(log => `- [${formatTimestamp(log.timestamp)}] ${log.message}`).join('\n')
            : '- No recent activity.';

        return `<desktop>

    ${SYSTEM_INSTRUCTION}

    ## Installed TUI Applications
    ${appsMarkup}

## System Logs
${logsMarkup}

</desktop>`;
    }

    /**
     * Build <application> section with app info and views
     * 
     * [RFC-017] Removed "## Recent Operations" section - feedback now provided
     * via AI SDK standard tool-result messages (RFC-015)
     */
    private buildApplicationSection(
        fragment: ISnapshotFragment,
        metadata: IDesktopMetadata
    ): string {
        // Get app info from metadata
        const apps = metadata.getInstalledApps();
        const appInfo = apps.find(a => a.appId === fragment.appId);
        const appName = appInfo?.name ?? fragment.appId;

        // Use viewTree from fragment or default message
        const viewTree = fragment.viewTree ?? '## Application View Tree\n- No views.';

        // Prepare application_info block
        const appInfoBlock = `<application_info>\n${viewTree}\n</application_info>`;

        // [RFC-Fix] Avoid double wrapping if Transformer already output <application>
        const trimmedMarkup = fragment.markup.trim();
        if (trimmedMarkup.startsWith('<application')) {
            // Find the end of the opening tag
            const openTagMatch = trimmedMarkup.match(/^<application[^>]*>/);
            if (openTagMatch) {
                const openTag = openTagMatch[0];
                
                // Check if it's a self-closing tag (e.g. collapsed/closed state)
                if (openTag.endsWith('/>')) {
                     // Expand self-closing tag to include info
                     // <application ... /> -> <application ...>\n<info>\n</application>
                     const expandedOpenTag = openTag.slice(0, -2) + '>';
                     return `${expandedOpenTag}\n\n${appInfoBlock}\n\n</application>`;
                } else {
                    // Standard tag: <application ...> ... </application>
                    // Insert info after opening tag
                    const content = trimmedMarkup.substring(openTag.length);
                    return `${openTag}\n\n${appInfoBlock}\n${content}`;
                }
            }
        }

        return `<application id="${fragment.appId}" name="${appName}">

${appInfoBlock}

${fragment.markup}

</application>`;
    }
}
