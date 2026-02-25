import { describe, expect, it, vi } from 'vitest';
import { AOTUIDrivenSource } from './aotui-driven-source.js';

describe('AOTUIDrivenSource type tool routing', () => {
    it('routes app_name based toolName via indexMap metadata (implicit app_id)', async () => {
        const executeSpy = vi.fn().mockResolvedValue({ success: true, data: { ok: true } });

        const kernel = {
            acquireSnapshot: vi.fn().mockResolvedValue({
                id: 'snap_1',
                indexMap: {
                    'tool:system_ide-FileDetail-lsp_hover': {
                        description: 'hover',
                        params: [],
                        appId: 'app_7',
                        appName: 'system_ide',
                        viewType: 'FileDetail',
                        toolName: 'lsp_hover',
                    },
                },
            }),
            releaseSnapshot: vi.fn(),
            acquireLock: vi.fn(),
            releaseLock: vi.fn(),
            execute: executeSpy,
            getSystemToolDefinitions: vi.fn().mockReturnValue([]),
        } as any;

        const desktop = {
            id: 'desktop_1',
            output: {
                subscribe: vi.fn(),
                unsubscribe: vi.fn(),
            },
        } as any;

        const source = new AOTUIDrivenSource(desktop, kernel);
        const result = await source.executeTool('system_ide-FileDetail-lsp_hover', { line: 1 }, 'call_1');

        expect(result?.error).toBeUndefined();
        expect(executeSpy).toHaveBeenCalledTimes(1);

        const operation = executeSpy.mock.calls[0][1];
        expect(operation.context.appId).toBe('app_7');
        expect(operation.context.viewId).toBe('FileDetail');
        expect(operation.name).toBe('lsp_hover');
    });

    it('filters messages and tools when a specific app is disabled by name', async () => {
        const executeSpy = vi.fn().mockResolvedValue({ success: true, data: { ok: true } });

        const kernel = {
            acquireSnapshot: vi.fn().mockResolvedValue({
                id: 'snap_2',
                createdAt: 100,
                markup: '# legacy',
                structured: {
                    desktopState: 'desktop-state',
                    appStates: [
                        { appId: 'app_1', appName: 'system_ide', markup: 'IDE MARKUP', timestamp: 101 },
                        { appId: 'app_2', appName: 'notes', markup: 'NOTES MARKUP', timestamp: 102 },
                    ],
                },
                indexMap: {
                    op1: {
                        type: 'operation',
                        appId: 'app_1',
                        operation: {
                            id: 'app_1.editor.open_file',
                            displayName: 'open file',
                            params: [],
                        },
                    },
                    op2: {
                        type: 'operation',
                        appId: 'app_2',
                        operation: {
                            id: 'app_2.editor.search',
                            displayName: 'search',
                            params: [],
                        },
                    },
                },
            }),
            releaseSnapshot: vi.fn(),
            acquireLock: vi.fn(),
            releaseLock: vi.fn(),
            execute: executeSpy,
            getSystemToolDefinitions: vi.fn().mockReturnValue([]),
        } as any;

        const desktop = {
            id: 'desktop_2',
            getAppInfo: vi.fn((appId: string) => {
                if (appId === 'app_1') return { name: 'system_ide' };
                if (appId === 'app_2') return { name: 'notes' };
                return undefined;
            }),
            output: {
                subscribe: vi.fn(),
                unsubscribe: vi.fn(),
            },
        } as any;

        const source = new AOTUIDrivenSource(desktop, kernel);
        source.setAppEnabled('system_ide', false);

        const messages = await source.getMessages();
        const content = messages
            .filter((message) => message.role === 'user')
            .map((message) => String(message.content))
            .join('\n');

        expect(content).not.toContain('IDE MARKUP');
        expect(content).toContain('NOTES MARKUP');
        expect(content).not.toContain('desktop-state');

        const tools = await source.getTools();
        expect(Object.keys(tools)).toContain('app_2.editor.search');
        expect(Object.keys(tools)).not.toContain('app_1.editor.open_file');

        const disabledResult = await source.executeTool('app_1.editor.open_file', {}, 'call_disabled');
        expect(disabledResult?.error?.code).toBe('E_APP_DISABLED');

        const enabledResult = await source.executeTool('app_2.editor.search', {}, 'call_enabled');
        expect(enabledResult?.error).toBeUndefined();
        expect(executeSpy).toHaveBeenCalledTimes(1);
    });

    it('returns empty messages/tools and blocks execution when source is disabled', async () => {
        const kernel = {
            acquireSnapshot: vi.fn().mockResolvedValue({
                id: 'snap_3',
                createdAt: 100,
                structured: {
                    desktopState: 'desktop-state',
                    appStates: [
                        { appId: 'app_1', appName: 'system_ide', markup: 'IDE MARKUP', timestamp: 101 },
                    ],
                },
                indexMap: {
                    op1: {
                        type: 'operation',
                        appId: 'app_1',
                        operation: {
                            id: 'app_1.editor.open_file',
                            displayName: 'open file',
                            params: [],
                        },
                    },
                },
            }),
            releaseSnapshot: vi.fn(),
            acquireLock: vi.fn(),
            releaseLock: vi.fn(),
            execute: vi.fn(),
            getSystemToolDefinitions: vi.fn().mockReturnValue([]),
        } as any;

        const desktop = {
            id: 'desktop_3',
            output: {
                subscribe: vi.fn(),
                unsubscribe: vi.fn(),
            },
        } as any;

        const source = new AOTUIDrivenSource(desktop, kernel);
        source.setEnabled(false);

        await expect(source.getMessages()).resolves.toEqual([]);
        await expect(source.getTools()).resolves.toEqual({});

        const result = await source.executeTool('app_1.editor.open_file', {}, 'call_3');
        expect(result?.error?.code).toBe('E_SOURCE_DISABLED');
    });
});
