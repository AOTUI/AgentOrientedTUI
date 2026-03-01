import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Config } from '../../src/config/config.js';
import { IMGateway, LARK_WEBHOOK_PATH } from '../../src/im/gateway.js';
import { buildIMSessionKey, buildLarkSessionKey, topicIdFromSessionKey } from '../../src/im/session-key.js';
import { LarkPlugin } from '../../src/im/lark-plugin.js';
import type { IMChannelPlugin } from '../../src/im/types.js';

vi.mock('../../src/config/config.js', () => ({
    Config: {
        get: vi.fn(),
    },
}));

const topics = new Map<string, any>();
vi.mock('../../src/db/index.js', () => ({
    getTopic: vi.fn((id: string) => topics.get(id) ?? null),
    createTopic: vi.fn((topic: any) => {
        topics.set(topic.id, topic);
    }),
}));

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aotui-im-gateway-'));
    tempDirs.push(dir);
    return dir;
}

async function wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

afterEach(async () => {
    vi.clearAllMocks();
    topics.clear();
    await Promise.all(
        tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
});

describe('IMGateway', () => {
    it('registers webhook routes from plugin registry', async () => {
        const hostManager = {
            ensureSessionForTopic: vi.fn().mockResolvedValue(undefined),
            sendUserMessage: vi.fn().mockResolvedValue(undefined),
            onGuiUpdate: vi.fn(() => () => {}),
        };

        const telegramPlugin: IMChannelPlugin = {
            channel: 'telegram',
            async processWebhook() {
                return { statusCode: 200, responseBody: { ok: true } };
            },
            async sendPayload() {
                return {};
            },
        };

        const gateway = new IMGateway({
            hostManager: hostManager as any,
            stateDir: await createTempDir(),
            plugins: [new LarkPlugin(), telegramPlugin],
        });

        const registeredPaths: string[] = [];
        const app = {
            post: vi.fn((path: string) => {
                registeredPaths.push(path);
                return app;
            }),
        };

        gateway.registerHttpRoutes(app as any);

        expect(registeredPaths).toContain(LARK_WEBHOOK_PATH);
        expect(registeredPaths).toContain('/api/im/telegram/:accountId/webhook');
    });

    it('accepts lark webhook and delivers assistant reply back through plugin', async () => {
        vi.mocked(Config.get).mockResolvedValue({
            im: {
                channels: {
                    lark: {
                        enabled: true,
                        verificationToken: 'verify-token',
                    },
                },
            },
        } as any);

        let guiHandler: ((event: any) => void) | null = null;
        const hostManager = {
            ensureSessionForTopic: vi.fn().mockResolvedValue(undefined),
            sendUserMessage: vi.fn().mockResolvedValue(undefined),
            onGuiUpdate: vi.fn((callback: (event: any) => void) => {
                guiHandler = callback;
                return () => {
                    guiHandler = null;
                };
            }),
        };

        const gateway = new IMGateway({
            hostManager: hostManager as any,
            stateDir: await createTempDir(),
        });
        await gateway.start();

        const larkPlugin = (gateway as any).plugins.get('lark');
        const sendSpy = vi.spyOn(larkPlugin, 'sendText').mockResolvedValue({ messageId: 'om_sent_01' });
        const webhookPayload = {
            schema: '2.0',
            header: {
                event_type: 'im.message.receive_v1',
                event_id: 'event_001',
                token: 'verify-token',
            },
            event: {
                sender: {
                    sender_type: 'user',
                    sender_id: {
                        open_id: 'ou_001',
                    },
                },
                message: {
                    message_id: 'om_001',
                    chat_id: 'oc_001',
                    message_type: 'text',
                    content: JSON.stringify({ text: 'hello host' }),
                },
            },
        };

        const responseState: { statusCode?: number; body?: unknown } = {};
        const req = {
            params: { accountId: 'default' },
            headers: {},
            body: JSON.stringify(webhookPayload),
        };
        const res = {
            status(code: number) {
                responseState.statusCode = code;
                return this;
            },
            json(body: unknown) {
                responseState.body = body;
                return this;
            },
            type() {
                return this;
            },
            send(body: unknown) {
                responseState.body = body;
                return this;
            },
        };

        try {
            await (gateway as any).handleLarkWebhook(req, res);

            expect(responseState.statusCode).toBe(200);
            expect(hostManager.ensureSessionForTopic).toHaveBeenCalledTimes(1);
            expect(hostManager.sendUserMessage).toHaveBeenCalledWith('hello host', expect.any(String), 'om_001');

            const sessionKey = buildLarkSessionKey('default', 'oc_001');
            const topicId = topicIdFromSessionKey(sessionKey);
            expect(guiHandler).toBeTruthy();

            guiHandler?.({
                topicId,
                type: 'assistant',
                message: {
                    role: 'assistant',
                    content: 'reply from assistant',
                },
            });

            await wait(40);
            expect(sendSpy).toHaveBeenCalledTimes(1);
            expect(sendSpy).toHaveBeenCalledWith({
                route: expect.objectContaining({
                    channel: 'lark',
                    receiveId: 'oc_001',
                }),
                text: 'reply from assistant',
            });
        } finally {
            await gateway.stop();
        }
    });

    it('accepts feishu webhook and delivers assistant reply back through plugin', async () => {
        vi.mocked(Config.get).mockResolvedValue({
            im: {
                channels: {
                    feishu: {
                        enabled: true,
                        verificationToken: 'verify-token-feishu',
                        dmPolicy: 'open',
                    },
                },
            },
        } as any);

        let guiHandler: ((event: any) => void) | null = null;
        const hostManager = {
            ensureSessionForTopic: vi.fn().mockResolvedValue(undefined),
            sendUserMessage: vi.fn().mockResolvedValue(undefined),
            onGuiUpdate: vi.fn((callback: (event: any) => void) => {
                guiHandler = callback;
                return () => {
                    guiHandler = null;
                };
            }),
        };

        const gateway = new IMGateway({
            hostManager: hostManager as any,
            stateDir: await createTempDir(),
        });
        await gateway.start();

        const feishuPlugin = (gateway as any).plugins.get('feishu');
        const sendSpy = vi.spyOn(feishuPlugin, 'sendPayload').mockResolvedValue({ messageId: 'om_sent_02' });
        const webhookPayload = {
            schema: '2.0',
            header: {
                event_type: 'im.message.receive_v1',
                event_id: 'event_feishu_001',
                token: 'verify-token-feishu',
            },
            event: {
                sender: {
                    sender_type: 'user',
                    sender_id: {
                        open_id: 'ou_feishu_001',
                    },
                },
                message: {
                    message_id: 'om_feishu_001',
                    chat_id: 'oc_feishu_001',
                    message_type: 'text',
                    content: JSON.stringify({ text: 'hello host from feishu' }),
                },
            },
        };

        const responseState: { statusCode?: number; body?: unknown } = {};
        const req = {
            params: { accountId: 'main' },
            headers: {},
            body: JSON.stringify(webhookPayload),
        };
        const res = {
            status(code: number) {
                responseState.statusCode = code;
                return this;
            },
            json(body: unknown) {
                responseState.body = body;
                return this;
            },
            type() {
                return this;
            },
            send(body: unknown) {
                responseState.body = body;
                return this;
            },
        };

        try {
            await (gateway as any).handleWebhook(req, res, 'feishu');

            expect(responseState.statusCode).toBe(200);
            expect(hostManager.ensureSessionForTopic).toHaveBeenCalledTimes(1);
            expect(hostManager.sendUserMessage).toHaveBeenCalledWith(
                'hello host from feishu',
                expect.any(String),
                'om_feishu_001',
            );

            const sessionKey = buildIMSessionKey({
                channel: 'feishu',
                accountId: 'main',
                peerId: 'oc_feishu_001',
            });
            const topicId = topicIdFromSessionKey(sessionKey);
            expect(guiHandler).toBeTruthy();

            guiHandler?.({
                topicId,
                type: 'assistant',
                message: {
                    role: 'assistant',
                    content: 'reply from assistant to feishu',
                },
            });

            await wait(40);
            expect(sendSpy).toHaveBeenCalledTimes(1);
            expect(sendSpy).toHaveBeenCalledWith({
                route: expect.objectContaining({
                    channel: 'feishu',
                    receiveId: 'oc_feishu_001',
                }),
                payload: expect.objectContaining({
                    text: 'reply from assistant to feishu',
                }),
            });
        } finally {
            await gateway.stop();
        }
    });

    it('invokes plugin runtime lifecycle start/stop hooks', async () => {
        const hostManager = {
            ensureSessionForTopic: vi.fn().mockResolvedValue(undefined),
            sendUserMessage: vi.fn().mockResolvedValue(undefined),
            onGuiUpdate: vi.fn(() => () => {}),
        };

        const startSpy = vi.fn().mockResolvedValue(undefined);
        const stopSpy = vi.fn().mockResolvedValue(undefined);
        const lifecyclePlugin: IMChannelPlugin = {
            channel: 'lifecycle',
            start: startSpy,
            stop: stopSpy,
            async processWebhook() {
                return { statusCode: 200, responseBody: { ok: true } };
            },
            async sendPayload() {
                return {};
            },
        };

        const gateway = new IMGateway({
            hostManager: hostManager as any,
            stateDir: await createTempDir(),
            plugins: [lifecyclePlugin],
        });

        await gateway.start();
        expect(startSpy).toHaveBeenCalledTimes(1);
        const startArg = startSpy.mock.calls[0]?.[0];
        expect(startArg).toBeTruthy();
        expect(typeof startArg.emitInboundMessage).toBe('function');

        await gateway.stop();
        expect(stopSpy).toHaveBeenCalledTimes(1);
    });
});
