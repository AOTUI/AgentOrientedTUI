import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeishuPlugin } from '../../src/im/feishu-plugin.js';
import { Config } from '../../src/config/config.js';

vi.mock('../../src/config/config.js', () => ({
    Config: {
        get: vi.fn(),
    },
}));

describe('FeishuPlugin', () => {
    const mockedConfigGet = vi.mocked(Config.get);
    const originalFetch = global.fetch;

    function buildTextWebhookPayload(params: {
        token: string;
        eventId: string;
        senderId: string;
        chatId: string;
        messageId: string;
        text: string;
        chatType?: 'p2p' | 'group';
    }): string {
        return JSON.stringify({
            schema: '2.0',
            header: {
                event_type: 'im.message.receive_v1',
                event_id: params.eventId,
                token: params.token,
            },
            event: {
                sender: {
                    sender_type: 'user',
                    sender_id: {
                        open_id: params.senderId,
                    },
                },
                message: {
                    message_id: params.messageId,
                    chat_id: params.chatId,
                    chat_type: params.chatType ?? 'p2p',
                    message_type: 'text',
                    content: JSON.stringify({ text: params.text }),
                },
            },
        });
    }

    function getSentTextFromCall(call: any[]): string {
        const init = call[1] as RequestInit;
        const body = JSON.parse(String(init.body ?? '{}'));
        const content = JSON.parse(String(body.content ?? '{}'));
        return String(content.text ?? '');
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('parses schema 2 inbound text message on feishu channel', async () => {
        mockedConfigGet.mockResolvedValue({
            im: {
                channels: {
                    feishu: {
                        enabled: true,
                        verificationToken: 'verify-token',
                        dmPolicy: 'open',
                    },
                },
            },
        } as any);

        const plugin = new FeishuPlugin();
        const result = await plugin.processWebhook({
            accountId: 'main',
            headers: {},
            rawBody: buildTextWebhookPayload({
                token: 'verify-token',
                eventId: 'event_001',
                senderId: 'ou_xxx',
                chatId: 'oc_001',
                messageId: 'om_001',
                text: 'hello from feishu',
            }),
        });

        expect(result.statusCode).toBe(200);
        expect(result.inbound?.channel).toBe('feishu');
        expect(result.inbound?.chatId).toBe('oc_001');
        expect(result.inbound?.text).toBe('hello from feishu');
    });

    it('sends text message using feishu account config', async () => {
        mockedConfigGet.mockResolvedValue({
            im: {
                channels: {
                    feishu: {
                        enabled: true,
                        botToken: 'bot-token-feishu',
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

        const plugin = new FeishuPlugin();
        const result = await plugin.sendPayload({
            route: {
                channel: 'feishu',
                accountId: 'main',
                receiveId: 'oc_001',
                receiveIdType: 'chat_id',
                sessionKey: 'im:feishu:main:oc_001',
                updatedAt: Date.now(),
            },
            payload: {
                text: 'reply text',
            },
        });

        expect(result.messageId).toBe('om_sent_001');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain('/open-apis/im/v1/messages?receive_id_type=chat_id');
        expect((init as RequestInit).headers).toMatchObject({
            Authorization: 'Bearer bot-token-feishu',
        });
    });

    it('blocks unauthorized DM in pairing mode and sends pairing code prompt', async () => {
        mockedConfigGet.mockResolvedValue({
            im: {
                channels: {
                    feishu: {
                        enabled: true,
                        verificationToken: 'verify-token',
                        dmPolicy: 'pairing',
                        botToken: 'bot-token-feishu',
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
                data: { message_id: 'om_sent_pairing' },
            }),
        });
        global.fetch = fetchMock as any;

        const plugin = new FeishuPlugin();
        const result = await plugin.processWebhook({
            accountId: 'main',
            headers: {},
            rawBody: buildTextWebhookPayload({
                token: 'verify-token',
                eventId: 'event_pairing_001',
                senderId: 'ou_guest',
                chatId: 'oc_guest_dm',
                messageId: 'om_guest_001',
                text: 'hello bot',
            }),
        });

        expect(result.statusCode).toBe(200);
        expect(result.inbound).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toContain('/open-apis/im/v1/messages?receive_id_type=chat_id');
        const body = JSON.parse(String((init as RequestInit).body ?? '{}'));
        expect(body.receive_id).toBe('oc_guest_dm');
        const sentText = getSentTextFromCall(fetchMock.mock.calls[0]);
        expect(sentText).toContain('配对码');
    });

    it('approves pairing code from authorized approver and allows requester afterwards', async () => {
        mockedConfigGet.mockResolvedValue({
            im: {
                channels: {
                    feishu: {
                        enabled: true,
                        verificationToken: 'verify-token',
                        dmPolicy: 'pairing',
                        allowFrom: ['ou_admin'],
                        botToken: 'bot-token-feishu',
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
                data: { message_id: 'om_sent_any' },
            }),
        });
        global.fetch = fetchMock as any;

        const plugin = new FeishuPlugin();
        const firstAttempt = await plugin.processWebhook({
            accountId: 'main',
            headers: {},
            rawBody: buildTextWebhookPayload({
                token: 'verify-token',
                eventId: 'event_pairing_101',
                senderId: 'ou_guest',
                chatId: 'oc_guest_dm',
                messageId: 'om_guest_101',
                text: 'hello bot',
            }),
        });
        expect(firstAttempt.inbound).toBeUndefined();

        const challengeText = getSentTextFromCall(fetchMock.mock.calls[0]);
        const codeMatch = challengeText.match(/([A-HJ-NP-Z2-9]{8})/);
        expect(codeMatch?.[1]).toBeTruthy();
        const pairingCode = String(codeMatch?.[1]);

        const approve = await plugin.processWebhook({
            accountId: 'main',
            headers: {},
            rawBody: buildTextWebhookPayload({
                token: 'verify-token',
                eventId: 'event_pairing_102',
                senderId: 'ou_admin',
                chatId: 'oc_admin_dm',
                messageId: 'om_admin_102',
                text: `/pairing approve ${pairingCode}`,
            }),
        });

        expect(approve.inbound).toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(3);

        const secondSendBody = JSON.parse(String((fetchMock.mock.calls[1][1] as RequestInit).body ?? '{}'));
        expect(secondSendBody.receive_id).toBe('oc_admin_dm');
        expect(getSentTextFromCall(fetchMock.mock.calls[1])).toContain('配对成功');

        const thirdSendBody = JSON.parse(String((fetchMock.mock.calls[2][1] as RequestInit).body ?? '{}'));
        expect(thirdSendBody.receive_id).toBe('oc_guest_dm');
        expect(getSentTextFromCall(fetchMock.mock.calls[2])).toContain('配对申请已通过');

        const secondAttempt = await plugin.processWebhook({
            accountId: 'main',
            headers: {},
            rawBody: buildTextWebhookPayload({
                token: 'verify-token',
                eventId: 'event_pairing_103',
                senderId: 'ou_guest',
                chatId: 'oc_guest_dm',
                messageId: 'om_guest_103',
                text: 'now allowed',
            }),
        });

        expect(secondAttempt.inbound?.text).toBe('now allowed');
        expect(secondAttempt.inbound?.senderId).toBe('ou_guest');
    });
});
