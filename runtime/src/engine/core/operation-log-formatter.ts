/**
 * Operation Log Formatter
 * 
 * Generates semantic, human-readable log messages from operation entries.
 * Follows the WHO/WHEN/WHERE/WHAT pattern for clarity.
 * 
 * [RFC-008] Operation Execution Optimization
 * 
 * @module @aotui/runtime/engine/core
 */

import type {
    OperationLogEntry,
    OperationLogParams,
    OperationID,
    DesktopID
} from '../../spi/index.js';

// ============================================================================
// Log ID Generator
// ============================================================================

let globalLogIdCounter = 0;

/**
 * Generate a unique log entry ID
 */
export function generateLogId(): string {
    return `oplog_${Date.now()}_${++globalLogIdCounter}`;
}

// ============================================================================
// Semantic Description Generator
// ============================================================================

/**
 * Format an operation log entry into a semantic, human-readable string
 * 
 * Format: `HH:MM:SS ✅/❌ [Actor] [Location] [Action] (Duration)`
 * 
 * @param entry - The log entry to format
 * @returns Formatted log string
 * 
 * @example
 * ```typescript
 * const formatted = formatOperationLog(entry);
 * // "15:32:45 ✅ Gemini in System-Chat/ChatView sent message "Hello..." (12ms)"
 * ```
 */
export function formatOperationLog(entry: OperationLogEntry): string {
    const time = new Date(entry.timestamp).toISOString().slice(11, 19); // HH:MM:SS
    const status = entry.success ? '✅' : '❌';
    const duration = `${entry.durationMs}ms`;

    // Build location string
    let location = '';
    if (entry.appName && entry.viewName) {
        location = `in ${entry.appName}/${entry.viewName}`;
    } else if (entry.appName) {
        location = `on ${entry.appName}`;
    } else {
        location = 'at Desktop level';
    }

    // Generate semantic description based on operation type
    const opName = entry.operationName as string;

    switch (opName) {


        case 'dismount_view': {
            const targetView = entry.keyArgs.viewId || entry.keyArgs.view_id || 'view';
            const location = entry.appName ? `in ${entry.appName}` : 'at Desktop level';
            return `${time} ${status} ${entry.actor} ${location} dismounted ${targetView} (${duration})`;
        }

        case 'open_app': {
            const appId = entry.keyArgs.appId || 'app';
            if (entry.success) {
                return `${time} ${status} ${entry.actor} opened app ${appId} (${duration})`;
            } else {
                return `${time} ${status} ${entry.actor} failed to open app ${appId}: ${entry.errorMessage} (${duration})`;
            }
        }

        case 'close_app': {
            const appId = entry.keyArgs.appId || 'app';
            return `${time} ${status} ${entry.actor} closed app ${appId} (${duration})`;
        }

        case 'send_message': {
            const content = entry.keyArgs.content || entry.keyArgs.message || '';
            const preview = content
                ? (content.length > 20 ? `${content.slice(0, 20)}...` : content)
                : '';
            if (entry.success) {
                return `${time} ${status} ${entry.actor} ${location} sent message "${preview}" (${duration})`;
            }
            return `${time} ${status} ${entry.actor} ${location} failed to send message "${preview}": ${entry.errorMessage} (${duration})`;
        }

        default: {
            // Generic format for unknown operations
            const args = Object.entries(entry.keyArgs)
                .slice(0, 3)  // Limit to 3 args
                .map(([k, v]) => `${k}=${v}`)
                .join(', ');
            const argsStr = args ? `(${args})` : '';

            if (entry.success) {
                return `${time} ${status} ${entry.actor} ${location} executed ${opName}${argsStr} (${duration})`;
            } else {
                return `${time} ${status} ${entry.actor} ${location} failed ${opName}${argsStr}: ${entry.errorMessage} (${duration})`;
            }
        }
    }
}

// ============================================================================
// Log Entry Builder
// ============================================================================

/**
 * Sanitize operation arguments for logging
 * 
 * Removes sensitive data and converts values to strings.
 * Only keeps first 50 chars of string values.
 */
function sanitizeArgs(args: Record<string, unknown>): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(args)) {
        // Skip sensitive-looking keys
        if (key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('secret')) {
            continue;
        }

        if (typeof value === 'string') {
            sanitized[key] = value.length > 50 ? value.slice(0, 50) + '...' : value;
        } else if (typeof value === 'number' || typeof value === 'boolean') {
            sanitized[key] = String(value);
        } else if (value === null || value === undefined) {
            // Skip null/undefined
        } else {
            // For objects/arrays, just note the type
            sanitized[key] = `[${typeof value}]`;
        }
    }

    return sanitized;
}

/**
 * Build a complete OperationLogEntry from execution parameters
 * 
 * @param params - Operation execution parameters
 * @returns Complete log entry with semantic description
 */
export function buildOperationLogEntry(params: OperationLogParams): OperationLogEntry {
    const keyArgs = sanitizeArgs(params.args);

    const entry: OperationLogEntry = {
        id: generateLogId(),
        actor: params.actor,
        timestamp: Date.now(),
        durationMs: params.durationMs,
        desktopId: params.desktopId,
        appId: params.appId,
        appName: params.appName,
        viewId: params.viewId,
        viewName: params.viewName,
        scope: params.scope,
        operationName: params.operationName,
        keyArgs,
        success: params.success,
        errorMessage: params.errorMessage,
        semanticDescription: '' // Will be set below
    };

    // Generate semantic description
    entry.semanticDescription = formatOperationLog(entry);

    return entry;
}

// ============================================================================
// Markdown Formatter for Snapshot
// ============================================================================

/**
 * Format operation logs as Markdown list for snapshot inclusion
 * 
 * @param logs - Array of log entries
 * @returns Markdown formatted string
 */
export function formatLogsAsMarkdown(logs: OperationLogEntry[]): string {
    if (logs.length === 0) {
        return '';
    }

    return logs
        .map(log => `- ${log.semanticDescription}`)
        .join('\n');
}
