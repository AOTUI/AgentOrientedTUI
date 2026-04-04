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
                    desktopTimestamp: 150,
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
                    desktopTimestamp: 110,
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

    it('uses structured.desktopTimestamp for desktop state messages', async () => {
        const kernel = {
            acquireSnapshot: vi.fn().mockResolvedValue({
                id: 'snap_desktop_ts',
                createdAt: 100,
                structured: {
                    desktopState: 'desktop-state',
                    desktopTimestamp: 999,
                    appStates: [
                        { appId: 'app_1', appName: 'system_ide', markup: 'IDE MARKUP', timestamp: 101 },
                    ],
                },
                indexMap: {},
            }),
            releaseSnapshot: vi.fn(),
            acquireLock: vi.fn(),
            releaseLock: vi.fn(),
            execute: vi.fn(),
            getSystemToolDefinitions: vi.fn().mockReturnValue([]),
        } as any;

        const desktop = {
            id: 'desktop_desktop_ts',
            output: {
                subscribe: vi.fn(),
                unsubscribe: vi.fn(),
            },
        } as any;

        const source = new AOTUIDrivenSource(desktop, kernel);
        const messages = await source.getMessages();
        const desktopMessage = messages.find((message) => message.content === 'desktop-state');

        expect(desktopMessage?.timestamp).toBe(999);
    });

    it('supplements only externally exposed system tools', async () => {
        const kernel = {
            acquireSnapshot: vi.fn().mockResolvedValue({
                id: 'snap_system_tools',
                indexMap: {},
            }),
            releaseSnapshot: vi.fn(),
            acquireLock: vi.fn(),
            releaseLock: vi.fn(),
            execute: vi.fn(),
            getSystemToolDefinitions: vi.fn().mockReturnValue([
                {
                    type: 'function',
                    function: {
                        name: 'system-open_app',
                        description: 'Open an app',
                        parameters: {
                            type: 'object',
                            properties: {
                                app_id: { type: 'string', description: 'Application ID' },
                            },
                            required: ['app_id'],
                        },
                    },
                },
                {
                    type: 'function',
                    function: {
                        name: 'system-close_app',
                        description: 'Close an app',
                        parameters: {
                            type: 'object',
                            properties: {
                                app_id: { type: 'string', description: 'Application ID' },
                            },
                            required: ['app_id'],
                        },
                    },
                },
            ]),
        } as any;

        const desktop = {
            id: 'desktop_tools',
            output: {
                subscribe: vi.fn(),
                unsubscribe: vi.fn(),
            },
        } as any;

        const source = new AOTUIDrivenSource(desktop, kernel, { includeInstruction: false });
        const tools = await source.getTools();

        expect(Object.keys(tools)).toContain('system-open_app');
        expect(Object.keys(tools)).toContain('system-close_app');
        expect(Object.keys(tools)).not.toContain('system-dismount_view');
    });

    it('emits view-level messages when structured.viewStates exists', async () => {
        const kernel = {
            acquireSnapshot: vi.fn().mockResolvedValue({
                id: 'snap_4',
                createdAt: 1705305600000,
                structured: {
                    desktopState: 'desktop-state',
                    appStates: [
                        { appId: 'app_1', appName: 'system_ide', markup: 'APP-MARKUP', timestamp: 1705305601000 },
                    ],
                    viewStates: [
                        {
                            appId: 'app_1',
                            appName: 'system_ide',
                            viewId: 'workspace',
                            viewType: 'Workspace',
                            viewName: 'Workspace',
                            markup: '<view id="workspace">Workspace Content</view>',
                            timestamp: 1705305602000,
                        },
                        {
                            appId: 'app_1',
                            appName: 'system_ide',
                            viewId: 'fd_0',
                            viewType: 'FileDetail',
                            viewName: 'File Detail',
                            markup: '<view id="fd_0">FileA Content</view>',
                            timestamp: 1705305603000,
                        }
                    ]
                },
                indexMap: {},
            }),
            releaseSnapshot: vi.fn(),
            acquireLock: vi.fn(),
            releaseLock: vi.fn(),
            execute: vi.fn(),
            getSystemToolDefinitions: vi.fn().mockReturnValue([]),
        } as any;

        const desktop = {
            id: 'desktop_4',
            output: {
                subscribe: vi.fn(),
                unsubscribe: vi.fn(),
            },
        } as any;

        const source = new AOTUIDrivenSource(desktop, kernel, { includeInstruction: false });
        const messages = await source.getMessages();

        expect(messages).toHaveLength(3);
        expect(messages[0]?.content).toBe('desktop-state');
        expect(messages[1]?.timestamp).toBe(1705305602000);
        expect(String(messages[1]?.content)).toContain('<view id="workspace" type="Workspace" name="Workspace" app_id="app_1" app_name="system_ide">');
        expect(String(messages[1]?.content)).toContain('Workspace Content</view>');
        expect((String(messages[1]?.content).match(/<view\b/gi) || []).length).toBe(1);
        expect(messages[2]?.timestamp).toBe(1705305603000);
        expect(String(messages[2]?.content)).toContain('<view id="fd_0" type="FileDetail" name="File Detail" app_id="app_1" app_name="system_ide">');

        const combinedContent = messages.map((message) => String(message.content)).join('\n');
        expect(combinedContent).not.toContain('APP-MARKUP');
        expect(combinedContent).not.toContain('<View ');
    });

    it('escapes XML attributes in view-level message wrapper', async () => {
        const kernel = {
            acquireSnapshot: vi.fn().mockResolvedValue({
                id: 'snap_5',
                createdAt: 1705305600000,
                structured: {
                    desktopState: 'desktop-state',
                    appStates: [],
                    viewStates: [
                        {
                            appId: 'app_1',
                            appName: 'sys"ide<prod>',
                            viewId: 'fd_"0',
                            viewType: 'File&Detail',
                            viewName: 'File"Detail<One>',
                            markup: '<view id="fd_0">Escaped</view>',
                            timestamp: 1705305605000,
                        }
                    ]
                },
                indexMap: {},
            }),
            releaseSnapshot: vi.fn(),
            acquireLock: vi.fn(),
            releaseLock: vi.fn(),
            execute: vi.fn(),
            getSystemToolDefinitions: vi.fn().mockReturnValue([]),
        } as any;

        const desktop = {
            id: 'desktop_5',
            output: {
                subscribe: vi.fn(),
                unsubscribe: vi.fn(),
            },
        } as any;

        const source = new AOTUIDrivenSource(desktop, kernel, { includeInstruction: false });
        const messages = await source.getMessages();

        expect(messages).toHaveLength(2);
        const wrapper = String(messages[1]?.content);
        expect(wrapper).toContain('<view id="fd_&quot;0" type="File&amp;Detail" name="File&quot;Detail&lt;One&gt;"');
        expect(wrapper).toContain('app_name="sys&quot;ide&lt;prod&gt;"');
        expect(wrapper).not.toContain('<View ');
    });

    it('emits application instructions as static messages and business views as dynamic messages', async () => {
        const kernel = {
            acquireSnapshot: vi.fn().mockResolvedValue({
                id: 'snap_regions',
                createdAt: 1705305600000,
                structured: {
                    desktopState: 'desktop-state',
                    desktopTimestamp: 1705305600500,
                    applicationInstructions: [
                        {
                            appId: 'app_1',
                            appName: 'system_ide',
                            viewId: 'root',
                            viewType: 'Root',
                            viewName: 'Application Instruction',
                            markup: '<view data-role="application-instruction">Application Instruction</view>',
                            timestamp: 1705305601000,
                            kind: 'application-instruction',
                        },
                    ],
                    appStates: [
                        { appId: 'app_1', appName: 'system_ide', markup: 'APP-MARKUP', timestamp: 1705305601200 },
                    ],
                    viewStates: [
                        {
                            appId: 'app_1',
                            appName: 'system_ide',
                            viewId: 'workspace',
                            viewType: 'Workspace',
                            viewName: 'Workspace',
                            markup: '<view id="workspace">Workspace Content</view>',
                            timestamp: 1705305602000,
                        },
                    ],
                },
                indexMap: {},
            }),
            releaseSnapshot: vi.fn(),
            acquireLock: vi.fn(),
            releaseLock: vi.fn(),
            execute: vi.fn(),
            getSystemToolDefinitions: vi.fn().mockReturnValue([]),
        } as any;

        const desktop = {
            id: 'desktop_regions',
            output: {
                subscribe: vi.fn(),
                unsubscribe: vi.fn(),
            },
        } as any;

        const source = new AOTUIDrivenSource(desktop, kernel, { includeInstruction: false });
        const messages = await source.getMessages();

        expect(messages).toHaveLength(3);
        expect(messages[0]).toMatchObject({
            role: 'user',
            region: 'static',
        });
        expect(String(messages[0]?.content)).toContain('Application Instruction');
        expect(messages[1]).toMatchObject({
            role: 'user',
            content: 'desktop-state',
            region: 'dynamic',
        });
        expect(messages[2]).toMatchObject({
            role: 'user',
            region: 'dynamic',
        });
        expect(String(messages[2]?.content)).toContain('Workspace Content');
        expect(messages.filter((message) => (message as any).region === 'dynamic')).toHaveLength(2);
        expect(messages.filter((message) => (message as any).region === 'static')).toHaveLength(1);
        expect(messages.filter((message) => (message as any).region === 'dynamic').map((message) => String(message.content)).join('\n')).not.toContain('Application Instruction');
    });
});
