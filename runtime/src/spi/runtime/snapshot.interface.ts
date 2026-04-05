/**
 * SPI - Snapshot Interfaces
 *
 * [RFC-007] Interfaces for System Prompt Enhancement.
 *
 * These interfaces define contracts for:
 * - Desktop metadata access (for snapshot generation)
 * - Snapshot fragment structure (from Worker Runtime)
 * - Snapshot formatter (for TUI output)
 *
 * @module @aotui/runtime/spi/runtime
 */

/**
 * Installed application info (readonly)
 */
export interface InstalledAppInfo {
    readonly appId: string;
    readonly name: string;
    readonly status: 'pending' | 'running' | 'paused' | 'closed' | 'collapsed';
    readonly description?: string;
    readonly whatItIs?: string;
    readonly whenToUse?: string;
    /** [RFC-014] App 消息角色 */
    readonly promptRole?: 'user' | 'assistant';
}

/**
 * Log entry (readonly)
 */
export interface LogEntry {
    readonly timestamp: number;
    readonly message: string;
    readonly level?: 'info' | 'warn' | 'error';
}

/**
 * Worker-input application instruction fragment
 *
 * Lean input-side shape used by ISnapshotFragment.
 */
interface ISnapshotApplicationInstructionFragment {
    readonly viewId: string;
    readonly viewType: string;
    readonly viewName?: string;
    readonly markup: string;
    readonly timestamp?: number;
    readonly digest?: string;
    readonly role?: 'user' | 'assistant';
    readonly kind?: 'application-instruction';
}

/**
 * Desktop metadata for snapshot generation
 *
 * Provides read-only access to Desktop state information
 * needed for generating the `<desktop>` section of TUI snapshots.
 *
 * @remarks
 * This interface is optional for Desktop implementations.
 * SnapshotFormatter will gracefully handle missing methods.
 */
export interface IDesktopMetadata {
    /**
     * Get all installed applications
     */
    getInstalledApps(): ReadonlyArray<InstalledAppInfo>;

    /**
     * Get recent system logs
     * @param limit - Maximum number of logs to return (default: 5)
     */
    getSystemLogs(limit?: number): ReadonlyArray<LogEntry>;

    /**
     * Get operation logs for a specific app
     * @param appId - Application ID
     * @param limit - Maximum number of logs to return (default: 3)
     */
    getAppOperationLogs(appId: string, limit?: number): ReadonlyArray<LogEntry>;
}

/**
 * Snapshot fragment from Worker Runtime
 *
 * Each Worker app pushes its own fragment containing:
 * - Rendered view markup
 * - IndexMap for semantic references
 * - Optional viewTree for Application View Tree
 */
export interface ISnapshotFragment {
    readonly appId: string;
    readonly markup: string;
    readonly indexMap: Record<string, unknown>;
    readonly timestamp?: number;
    readonly applicationInstructions?: ReadonlyArray<ISnapshotApplicationInstructionFragment>;

    /**
     * View 级别片段（可选）
     *
     * 由 Worker Runtime 计算并推送，支持细粒度时间排序。
     */
    readonly views?: ReadonlyArray<{
        viewId: string;
        viewType: string;
        viewName?: string;
        markup: string;
        timestamp: number;
        kind?: 'application-instruction' | 'view-state';
    }>;

    /**
     * [RFC-007] View tree markdown for Application Info section
     *
     * Format:
     * ```markdown
     * ## Application View Tree
     * - [Chat](view:view_0, mounted)
     *     ↳ [Detail](link:CD_0)
     * ```
     */
    readonly viewTree?: string;
}

/**
 * Formatted snapshot result
 */
export interface FormattedSnapshotResult {
    readonly markup: string;
    readonly indexMap: Record<string, unknown>;
}

/**
 * Snapshot formatter interface
 *
 * Transforms Worker fragments and Desktop metadata into
 * a complete TUI snapshot conforming to TUI_DEMO.md format.
 *
 * @example
 * ```typescript
 * const formatter: ISnapshotFormatter = new SnapshotFormatter();
 * const { markup, indexMap } = formatter.format(fragments, metadata);
 * ```
 */
export interface ISnapshotFormatter {
    /**
     * Format complete TUI snapshot
     *
     * @param fragments - Snapshot fragments from Worker apps
     * @param metadata - Desktop metadata for global info
     * @returns Formatted snapshot with markup and merged indexMap
     */
    format(
        fragments: ReadonlyArray<ISnapshotFragment>,
        metadata: IDesktopMetadata
    ): FormattedSnapshotResult;
}
