import { createHash } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LarkPlugin } from '../../src/im/lark-plugin.js';
import { Config } from '../../src/config/config.js';

vi.mock('../../src/config/config.js', () => ({
    Config: {
        get: vi.fn(),
    },
}));

describe('LarkPlugin', () => {
    const mockedConfigGet = vi.mocked(Config.get);
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('responds to url_verification challenge', async () => {
        mockedConfigGet.mockResolvedValue({
            im: {
                channels: {
                    lark: {
                        enabled: true,
                        verificationToken: 'verify-token',
                    },
                },
            },
        } as any);

        const plugin = new LarkPlugin();
        const result = await plugin.processWebhook({
            accountId: 'default',
            headers: {},
            rawBody: JSON.stringify({
                type: 'url_verification',
                token: 'verify-token',
                challenge: 'challenge-123',
            }),
        });

        expect(result.statusCode).toBe(200);
        expect(result.responseBody).toEqual({ challenge: 'challenge-123' });
    });

    it('parses schema 2 inbound text message', async () => {
        mockedConfigGet.mockResolvedValue({
            im: {
                channels: {
                    lark: {
                        enabled: true,
                        verificationToken: 'verify-token',
                    },
                },
            },
        } as any);

        const plugin = new LarkPlugin();
        const result = await plugin.processWebhook({
            accountId: 'acc01',
            headers: {},
            rawBody: JSON.stringify({
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
                            open_id: 'ou_xxx',
                        },
                    },
                    message: {
                        message_id: 'om_001',
                        chat_id: 'oc_001',
                        message_type: 'text',
                        content: JSON.stringify({ text: 'hello from lark' }),
                    },
                },
            }),
        });

        expect(result.statusCode).toBe(200);
        expect(result.inbound?.channel).toBe('lark');
        expect(result.inbound?.eventId).toBe('event_001');
        expect(result.inbound?.chatId).toBe('oc_001');
        expect(result.inbound?.text).toBe('hello from lark');
    });

    it('accepts digest-style webhook signature with encrypt key', async () => {
        const encryptKey = 'enc_001';
        mockedConfigGet.mockResolvedValue({
            im: {
                channels: {
                    lark: {
                        enabled: true,
                        encryptKey,
                    },
                },
            },
        } as any);

        const payload = {
            type: 'url_verification',
            challenge: 'abc',
        };
        const rawBody = JSON.stringify(payload);
        const timestamp = '1700000000';
        const nonce = 'nonce001';
        const signature = createHash('sha256')
            .update(`${timestamp}${nonce}${encryptKey}${rawBody}`)
            .digest('hex');

        const plugin = new LarkPlugin();
        const result = await plugin.processWebhook({
            accountId: 'default',
            headers: {
                'x-lark-signature': signature,
                'x-lark-request-timestamp': timestamp,
                'x-lark-request-nonce': nonce,
            },
            rawBody,
        });

        expect(result.statusCode).toBe(200);
        expect(result.responseBody).toEqual({ challenge: 'abc' });
    });

    it('sends text message via Lark API with bot token', async () => {
        mockedConfigGet.mockResolvedValue({
            im: {
                channels: {
                    lark: {
                        enabled: true,
                        botToken: 'bot-token-001',
                        apiBaseUrl: 'https://open.feishu.cn',
                    },
                },
            },
        } as any);

        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({
                code: 0,
                data: { message_id: 'om_sent_001' },
            }),
        });
        global.fetch = fetchMock as any;

        const plugin = new LarkPlugin();
        const result = await plugin.sendText({
            route: {
                channel: 'lark',
                accountId: 'default',
                receiveId: 'oc_001',
                receiveIdType: 'chat_id',
                sessionKey: 'im:lark:default:oc_001',
                updatedAt: Date.now(),
            },
            text: 'reply text',
        });

        expect(result.messageId).toBe('om_sent_001');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain('/open-apis/im/v1/messages?receive_id_type=chat_id');
        expect((init as RequestInit).headers).toMatchObject({
            Authorization: 'Bearer bot-token-001',
        });
    });

    it('resolves session route by configured sessionScope', async () => {
        mockedConfigGet.mockResolvedValue({
            im: {
                channels: {
                    lark: {
                        enabled: true,
                        sessionScope: 'peer',
                    },
                },
            },
        } as any);

        const plugin = new LarkPlugin();
        const resolved = await plugin.resolveRoute({
            channel: 'lark',
            accountId: 'default',
            eventId: 'event_001',
            externalMessageId: 'om_001',
            senderId: 'ou_xxx',
            chatId: 'oc_001',
            threadId: 'thread_001',
            text: 'hello',
        });

        expect(resolved.sessionKey).toBe('im:lark:default:oc_001');
        expect(resolved.route.sessionScope).toBe('peer');
        expect(resolved.route.threadId).toBe('thread_001');
    });
});
