/**
 * Operation Log Buffer Unit Tests
 * 
 * [RFC-008] Operation Execution Optimization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OperationLogBuffer } from './operation-log-buffer.js';
import type { OperationLogEntry, DesktopID, AppID, OperationID } from '../../spi/index.js';
import { createDesktopId, createAppId, createOperationId } from '../../spi/index.js';

// Helper to create test entries
function createTestEntry(overrides: Partial<OperationLogEntry> = {}): OperationLogEntry {
    return {
        id: 'test_log_1',
        actor: 'Gemini',
        timestamp: Date.now(),
        durationMs: 10,
        desktopId: createDesktopId('desktop_0'),
        scope: 'system',
        operationName: createOperationId('open_app'),
        keyArgs: { appId: 'app_test' },
        success: true,
        semanticDescription: 'Test log entry',
        ...overrides
    };
}

describe('OperationLogBuffer', () => {
    let buffer: OperationLogBuffer;

    beforeEach(() => {
        buffer = new OperationLogBuffer(10);
    });

    describe('push()', () => {
        it('should store a log entry', () => {
            const entry = createTestEntry();
            buffer.push(entry);

            expect(buffer.getSize()).toBe(1);
            expect(buffer.getAllLogs()).toContainEqual(entry);
        });

        it('should assign an ID if not provided', () => {
            const entry = createTestEntry({ id: '' });
            buffer.push(entry);

            const logs = buffer.getAllLogs();
            expect(logs[0].id).toBeTruthy();
            expect(logs[0].id).toMatch(/^log_\d+$/);
        });

        it('should implement ring buffer behavior', () => {
            // Push 15 entries into a buffer with maxSize 10
            for (let i = 0; i < 15; i++) {
                buffer.push(createTestEntry({ id: `log_${i}` }));
            }

            expect(buffer.getSize()).toBe(10);

            // Should have entries 5-14 (oldest removed)
            const logs = buffer.getAllLogs();
            expect(logs[0].id).toBe('log_5');
            expect(logs[9].id).toBe('log_14');
        });
    });

    describe('getSystemLogs()', () => {
        it('should return only system-scope logs', () => {
            buffer.push(createTestEntry({ id: 'sys_1', scope: 'system' }));
            buffer.push(createTestEntry({ id: 'app_1', scope: 'app', appId: createAppId('app_1') }));
            buffer.push(createTestEntry({ id: 'sys_2', scope: 'system' }));

            const systemLogs = buffer.getSystemLogs(10);
            expect(systemLogs).toHaveLength(2);
            expect(systemLogs.every(l => l.scope === 'system')).toBe(true);
        });

        it('should return at most count entries', () => {
            for (let i = 0; i < 10; i++) {
                buffer.push(createTestEntry({ id: `sys_${i}`, scope: 'system' }));
            }

            const systemLogs = buffer.getSystemLogs(5);
            expect(systemLogs).toHaveLength(5);
        });

        it('should return logs in chronological order (most recent last)', () => {
            buffer.push(createTestEntry({ id: 'first', scope: 'system' }));
            buffer.push(createTestEntry({ id: 'second', scope: 'system' }));
            buffer.push(createTestEntry({ id: 'third', scope: 'system' }));

            const logs = buffer.getSystemLogs(5);
            expect(logs[0].id).toBe('first');
            expect(logs[2].id).toBe('third');
        });
    });

    describe('getAppLogs()', () => {
        it('should return only logs for the specified app', () => {
            const app1 = createAppId('app_1');
            const app2 = createAppId('app_2');

            buffer.push(createTestEntry({ id: 'a1_1', scope: 'app', appId: app1 }));
            buffer.push(createTestEntry({ id: 'a2_1', scope: 'app', appId: app2 }));
            buffer.push(createTestEntry({ id: 'a1_2', scope: 'app', appId: app1 }));
            buffer.push(createTestEntry({ id: 'sys_1', scope: 'system' }));

            const app1Logs = buffer.getAppLogs(app1, 10);
            expect(app1Logs).toHaveLength(2);
            expect(app1Logs.every(l => l.appId === app1)).toBe(true);
        });

        it('should return at most count entries per app', () => {
            const appId = createAppId('app_test');

            for (let i = 0; i < 10; i++) {
                buffer.push(createTestEntry({ id: `app_${i}`, scope: 'app', appId }));
            }

            const appLogs = buffer.getAppLogs(appId, 3);
            expect(appLogs).toHaveLength(3);
        });
    });

    describe('clear()', () => {
        it('should remove all logs', () => {
            buffer.push(createTestEntry());
            buffer.push(createTestEntry());
            buffer.push(createTestEntry());

            expect(buffer.getSize()).toBe(3);

            buffer.clear();

            expect(buffer.getSize()).toBe(0);
            expect(buffer.getAllLogs()).toHaveLength(0);
        });
    });
});
