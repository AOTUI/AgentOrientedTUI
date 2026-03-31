import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appRouter } from '../src/trpc/router.js';
import { Config } from '../src/config/config.js';

describe('tRPC im router', () => {
    let caller: ReturnType<typeof appRouter.createCaller>;
    let hostManager: {
        getIMSessions: ReturnType<typeof vi.fn>;
        getIMSession: ReturnType<typeof vi.fn>;
        getIMMessages: ReturnType<typeof vi.fn>;
        getIMRuntime: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        hostManager = {
            getIMSessions: vi.fn(() => []),
            getIMSession: vi.fn(() => null),
            getIMMessages: vi.fn(() => []),
            getIMRuntime: vi.fn(() => ({})),
        };
        caller = appRouter.createCaller({
            hostManager: hostManager as any,
            llmConfigService: {} as any,
            modelRegistry: {} as any,
            messageService: {} as any,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('getConfig reads from Config.getGlobalIm and normalizes disabled fields', async () => {
        vi.spyOn(Config, 'getGlobalIm').mockResolvedValue({
            enabled: true,
            channels: {
                feishu: {
                    disabled: true,
                    accounts: {
                        main: {
                            disabled: true,
                            appId: 'cli_xxx',
                        },
                    },
                },
            },
        } as any);

        const result = await caller.im.getConfig();

        expect(Config.getGlobalIm).toHaveBeenCalledTimes(1);
        expect(result.enabled).toBe(true);
        expect(result.channels.feishu.enabled).toBe(false);
        expect(result.channels.feishu.accounts.main.enabled).toBe(false);
        expect(result.channels.feishu.accounts.main.appId).toBe('cli_xxx');
    });

    it('getRuntime delegates to hostManager runtime surface', async () => {
        hostManager.getIMRuntime.mockReturnValue({
            started: true,
            channels: [
                {
                    id: 'feishu',
                    meta: { label: 'Feishu' },
                    capabilities: { chatTypes: ['direct', 'group'], threads: true },
                    active: true,
                    runtime: {
                        started: true,
                        connectionMode: 'websocket',
                        accountIds: ['default'],
                        sessionScopes: ['peer', 'peer_thread'],
                    },
                },
            ],
        });

        const result = await caller.im.getRuntime();
        expect(hostManager.getIMRuntime).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            started: true,
            channels: [
                {
                    id: 'feishu',
                    meta: { label: 'Feishu' },
                    capabilities: { chatTypes: ['direct', 'group'], threads: true },
                    active: true,
                    runtime: {
                        started: true,
                        connectionMode: 'websocket',
                        accountIds: ['default'],
                        sessionScopes: ['peer', 'peer_thread'],
                    },
                },
            ],
        });
    });

    it('getImConfig remains available as compatibility alias', async () => {
        vi.spyOn(Config, 'getGlobalIm').mockResolvedValue({
            channels: {
                feishu: {
                    enabled: true,
                },
            },
        } as any);

        const result = await caller.im.getImConfig();

        expect(result).toEqual({
            channels: {
                feishu: {
                    enabled: true,
                },
            },
        });
    });

    it('updateConfig writes normalized config via Config.replaceGlobalIm', async () => {
        const replaceSpy = vi.spyOn(Config, 'replaceGlobalIm').mockResolvedValue(undefined);

        await caller.im.updateConfig({
            im: {
                enabled: true,
                channels: {
                    feishu: {
                        enabled: true,
                        accounts: {
                            main: {
                                appId: 'cli_new',
                                disabled: true,
                            },
                        },
                    },
                },
            },
        });

        expect(replaceSpy).toHaveBeenCalledTimes(1);
        expect(replaceSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                enabled: true,
                channels: expect.objectContaining({
                    feishu: expect.objectContaining({
                        enabled: true,
                        accounts: expect.objectContaining({
                            main: expect.objectContaining({
                                appId: 'cli_new',
                                enabled: false,
                            }),
                        }),
                    }),
                }),
            }),
        );
    });

    it('saveImConfig preserves extended session scopes supported by IM runtime', async () => {
        const replaceSpy = vi.spyOn(Config, 'replaceGlobalIm').mockResolvedValue(undefined);

        await caller.im.saveImConfig({
            channels: {
                feishu: {
                    sessionScope: 'peer_sender',
                    accounts: {
                        main: {
                            sessionScope: 'peer_thread_sender',
                            appId: 'cli_nested',
                        },
                    },
                },
            },
        });

        expect(replaceSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                channels: expect.objectContaining({
                    feishu: expect.objectContaining({
                        sessionScope: 'peer_sender',
                        accounts: expect.objectContaining({
                            main: expect.objectContaining({
                                sessionScope: 'peer_thread_sender',
                            }),
                        }),
                    }),
                }),
            }),
        );
    });

    it('listSessions delegates to hostManager IM query surface', async () => {
        hostManager.getIMSessions.mockReturnValue([
            {
                sessionKey: 'agent:a:feishu:direct:ou_1',
                agentId: 'agent-a',
                channel: 'feishu',
                chatType: 'direct',
                peerId: 'ou_1',
                createdAt: 1,
                updatedAt: 2,
                lastAccessTime: 2,
            },
        ]);

        const result = await caller.im.listSessions();

        expect(hostManager.getIMSessions).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(1);
        expect(result[0].sessionKey).toBe('agent:a:feishu:direct:ou_1');
    });

    it('getSession delegates to hostManager IM query surface', async () => {
        hostManager.getIMSession.mockReturnValue({
            sessionKey: 'agent:a:feishu:group:oc_1',
            agentId: 'agent-a',
            channel: 'feishu',
            chatType: 'group',
            peerId: 'oc_1',
            accountId: 'tenant-1',
            createdAt: 1,
            updatedAt: 3,
            lastAccessTime: 3,
        });

        const result = await caller.im.getSession({ sessionKey: 'agent:a:feishu:group:oc_1' });

        expect(hostManager.getIMSession).toHaveBeenCalledWith('agent:a:feishu:group:oc_1');
        expect(result?.accountId).toBe('tenant-1');
    });

    it('getMessages delegates to hostManager IM message query surface', async () => {
        hostManager.getIMMessages.mockReturnValue([
            { role: 'user', content: 'hello', timestamp: 1_000 },
            { role: 'assistant', content: 'world', timestamp: 1_100 },
        ]);

        const result = await caller.im.getMessages({ sessionKey: 'agent:a:feishu:direct:ou_9' });

        expect(hostManager.getIMMessages).toHaveBeenCalledWith('agent:a:feishu:direct:ou_9');
        expect(result).toEqual([
            { role: 'user', content: 'hello', timestamp: 1_000 },
            { role: 'assistant', content: 'world', timestamp: 1_100 },
        ]);
    });
});
