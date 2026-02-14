/**
 * Operation Log Formatter Unit Tests
 * 
 * [RFC-008] Operation Execution Optimization
 */

import { describe, it, expect } from 'vitest';
import {
    formatOperationLog,
    buildOperationLogEntry,
    formatLogsAsMarkdown
} from './operation-log-formatter.js';
import type { OperationLogEntry } from '../../spi/index.js';
import { createDesktopId, createAppId, createViewId, createOperationId } from '../../spi/index.js';

describe('formatOperationLog', () => {
    const baseEntry: OperationLogEntry = {
        id: 'log_1',
        actor: 'Gemini',
        timestamp: new Date('2026-01-15T15:32:45.000Z').getTime(),
        durationMs: 12,
        desktopId: createDesktopId('desktop_0'),
        scope: 'system',
        operationName: createOperationId('test_op'),
        keyArgs: {},
        success: true,
        semanticDescription: ''
    };



    it('should format send_message with content preview', () => {
        const entry: OperationLogEntry = {
            ...baseEntry,
            scope: 'app',
            operationName: createOperationId('send_message'),
            appId: createAppId('app_chat'),
            appName: 'System-Chat',
            viewName: 'ChatView',
            keyArgs: { content: 'Hello, how can I help you today?' }
        };

        const formatted = formatOperationLog(entry);

        expect(formatted).toContain('sent message "Hello, how can I hel..."');
        expect(formatted).toContain('in System-Chat/ChatView');
    });

    it('should format open_app correctly', () => {
        const entry: OperationLogEntry = {
            ...baseEntry,
            operationName: createOperationId('open_app'),
            keyArgs: { appId: 'system-chat' }
        };

        const formatted = formatOperationLog(entry);

        expect(formatted).toContain('opened app system-chat');
    });

    it('should format dismount_view with target view name', () => {
        const entry: OperationLogEntry = {
            ...baseEntry,
            operationName: createOperationId('dismount_view'),
            appName: 'System-Chat',
            viewName: 'ChatView',
            keyArgs: { view_id: 'view_1' }
        };

        const formatted = formatOperationLog(entry);

        expect(formatted).toContain('Gemini');
        // baseEntry has actor: 'Gemini'. 
        // formatOperationLog output: `${time} ${status} ${entry.actor} ...`
        // Wait, expect says 'Gemini'.
        expect(formatted).toContain('Gemini');
        expect(formatted).toContain('in System-Chat');
        expect(formatted).toContain('dismounted view_1');
    });

    it('should include ❌ for failed operations', () => {
        const entry: OperationLogEntry = {
            ...baseEntry,
            success: false,
            errorMessage: 'App not found',
            operationName: createOperationId('open_app'),
            keyArgs: { appId: 'unknown-app' }
        };

        const formatted = formatOperationLog(entry);

        expect(formatted).toContain('❌');
        expect(formatted).toContain('failed to open app');
        expect(formatted).toContain('App not found');
    });

    it('should handle unknown operations with generic format', () => {
        const entry: OperationLogEntry = {
            ...baseEntry,
            operationName: createOperationId('custom_action'),
            appName: 'TestApp',
            keyArgs: { param1: 'value1', param2: 'value2' }
        };

        const formatted = formatOperationLog(entry);

        expect(formatted).toContain('executed custom_action');
        expect(formatted).toContain('param1=value1');
    });
});

describe('buildOperationLogEntry', () => {
    it('should create a complete log entry with semantic description', () => {
        const entry = buildOperationLogEntry({
            actor: 'DeepSeek',
            desktopId: createDesktopId('desktop_1'),
            scope: 'app',
            operationName: createOperationId('send_message'),
            args: { content: 'Hello world' },
            success: true,
            durationMs: 25,
            appId: createAppId('app_chat'),
            appName: 'System-Chat',
            viewName: 'ChatView'
        });

        expect(entry.id).toBeTruthy();
        expect(entry.actor).toBe('DeepSeek');
        expect(entry.scope).toBe('app');
        expect(entry.keyArgs.content).toBe('Hello world');
        expect(entry.semanticDescription).toContain('DeepSeek');
        expect(entry.semanticDescription).toContain('sent message');
    });

    it('should sanitize sensitive arguments', () => {
        const entry = buildOperationLogEntry({
            actor: 'Gemini',
            desktopId: createDesktopId('desktop_0'),
            scope: 'app',
            operationName: createOperationId('login'),
            args: {
                username: 'user123',
                password: 'secret123',
                token: 'abc123'
            },
            success: true,
            durationMs: 100
        });

        expect(entry.keyArgs.username).toBe('user123');
        expect(entry.keyArgs.password).toBeUndefined();
        expect(entry.keyArgs.token).toBeUndefined();
    });

    it('should truncate long argument values', () => {
        const longContent = 'A'.repeat(100);

        const entry = buildOperationLogEntry({
            actor: 'Gemini',
            desktopId: createDesktopId('desktop_0'),
            scope: 'app',
            operationName: createOperationId('send_message'),
            args: { content: longContent },
            success: true,
            durationMs: 10
        });

        expect(entry.keyArgs.content.length).toBeLessThanOrEqual(53); // 50 + '...'
        expect(entry.keyArgs.content.endsWith('...')).toBe(true);
    });
});

describe('formatLogsAsMarkdown', () => {
    it('should format logs as markdown list', () => {
        const logs: OperationLogEntry[] = [
            {
                id: 'log_1',
                actor: 'Gemini',
                timestamp: Date.now(),
                durationMs: 10,
                desktopId: createDesktopId('desktop_0'),
                scope: 'system',
                operationName: createOperationId('open_app'),
                keyArgs: { appId: 'chat' },
                success: true,
                semanticDescription: '15:00:00 ✅ Gemini opened app chat (10ms)'
            },
        ];

        const markdown = formatLogsAsMarkdown(logs);

        expect(markdown).toContain('- 15:00:00 ✅ Gemini opened app chat (10ms)');
    });

    it('should return empty string for empty logs', () => {
        const markdown = formatLogsAsMarkdown([]);
        expect(markdown).toBe('');
    });
});
