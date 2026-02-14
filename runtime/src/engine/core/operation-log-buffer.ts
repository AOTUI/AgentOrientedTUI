/**
 * Operation Log Buffer
 * 
 * Ring buffer implementation for storing operation execution logs.
 * Maintains separate views for system-level and per-app logs.
 * 
 * [RFC-008] Operation Execution Optimization
 * 
 * @module @aotui/runtime/engine/core
 */

import type {
    IOperationLogBuffer,
    OperationLogEntry,
    AppID
} from '../../spi/index.js';

/**
 * OperationLogBuffer
 * 
 * Implements a ring buffer for operation logs with filtering capabilities.
 * 
 * @example
 * ```typescript
 * const buffer = new OperationLogBuffer(50);
 * buffer.push(entry);
 * 
 * // Get recent system logs
 * const systemLogs = buffer.getSystemLogs(5);
 * 
 * // Get recent app logs
 * const appLogs = buffer.getAppLogs('app_chat' as AppID, 3);
 * ```
 */
export class OperationLogBuffer implements IOperationLogBuffer {
    private logs: OperationLogEntry[] = [];
    private readonly maxSize: number;
    private logCounter = 0;

    /**
     * Create a new OperationLogBuffer
     * 
     * @param maxSize - Maximum number of logs to retain (default: 50)
     */
    constructor(maxSize: number = 50) {
        this.maxSize = maxSize;
    }

    /**
     * Generate unique log ID
     */
    private generateLogId(): string {
        return `log_${++this.logCounter}`;
    }

    /**
     * Push a new log entry to the buffer
     * 
     * Automatically assigns an ID if not provided.
     * Implements ring buffer behavior - oldest entries are removed when full.
     */
    push(entry: OperationLogEntry): void {
        // Ensure entry has an ID
        const entryWithId: OperationLogEntry = {
            ...entry,
            id: entry.id || this.generateLogId()
        };

        this.logs.push(entryWithId);

        // Ring buffer: remove oldest when exceeding maxSize
        if (this.logs.length > this.maxSize) {
            this.logs.shift();
        }
    }

    /**
     * Get recent system-scope logs
     * 
     * @param count - Maximum number of logs to return
     * @returns Array of log entries, most recent last
     */
    getSystemLogs(count: number): OperationLogEntry[] {
        return this.logs
            .filter(e => e.scope === 'system')
            .slice(-count);
    }

    /**
     * Get recent logs for a specific app
     * 
     * @param appId - The app ID to filter by
     * @param count - Maximum number of logs to return
     * @returns Array of log entries, most recent last
     */
    getAppLogs(appId: AppID, count: number): OperationLogEntry[] {
        return this.logs
            .filter(e => e.scope === 'app' && e.appId === appId)
            .slice(-count);
    }

    /**
     * Get all logs (for debugging)
     * 
     * @returns Copy of all log entries
     */
    getAllLogs(): OperationLogEntry[] {
        return [...this.logs];
    }

    /**
     * Get the total number of logs currently stored
     */
    getSize(): number {
        return this.logs.length;
    }

    /**
     * Clear all logs
     */
    clear(): void {
        this.logs = [];
    }
}
