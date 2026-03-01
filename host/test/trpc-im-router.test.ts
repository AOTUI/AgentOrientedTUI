import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appRouter } from '../src/trpc/router.js';
import { Config } from '../src/config/config.js';

describe('tRPC im router', () => {
    let caller: ReturnType<typeof appRouter.createCaller>;

    beforeEach(() => {
        caller = appRouter.createCaller({
            hostManager: {} as any,
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

    it('getRuntime returns empty object when IM gateway context is unavailable', async () => {
        const result = await caller.im.getRuntime();
        expect(result).toEqual({});
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
});
