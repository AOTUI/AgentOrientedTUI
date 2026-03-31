import { describe, expect, it } from 'vitest';
import { buildSessionKey, isIMSessionKey, resolveIMRoute } from '../../src/im/routing.js';

describe('buildSessionKey', () => {
    it('builds direct session key by schema', () => {
        expect(buildSessionKey('agent-A', 'feishu', 'direct', 'ou_123')).toBe(
            'agent:agent-A:feishu:direct:ou_123',
        );
    });

    it('builds group session key by schema', () => {
        expect(buildSessionKey('agent-A', 'feishu', 'group', 'oc_123')).toBe(
            'agent:agent-A:feishu:group:oc_123',
        );
    });

    it('builds bot-scoped session key when bot identity is provided', () => {
        expect(buildSessionKey('agent-A', 'feishu', 'group', 'oc_123', 'cli_bot_a')).toBe(
            'agent:agent-A:feishu:bot:cli_bot_a:group:oc_123',
        );
    });

    it('throws when peer id is empty', () => {
        expect(() => buildSessionKey('agent-A', 'feishu', 'group', '   ')).toThrowError(/peerId/i);
    });

    it('recognizes IM session keys by schema', () => {
        expect(isIMSessionKey('agent:agent-A:feishu:direct:ou_123')).toBe(true);
        expect(isIMSessionKey('agent:agent-A:lark:group:oc_123')).toBe(true);
        expect(isIMSessionKey('agent:agent-A:feishu:bot:cli_bot_a:group:oc_123')).toBe(true);
    });

    it('does not misclassify regular GUI topics as IM sessions', () => {
        expect(isIMSessionKey('topic_123')).toBe(false);
        expect(isIMSessionKey('desktop_abc')).toBe(false);
        expect(isIMSessionKey('agent:missing:parts')).toBe(false);
    });
});

describe('resolveIMRoute', () => {
    it('uses channel botAgentId with highest priority', () => {
        const result = resolveIMRoute({
            config: {
                agents: { list: [], activeAgentId: 'active-agent' },
                im: {
                    channels: {
                        feishu: {
                            botAgentId: 'bound-agent',
                        },
                    },
                },
            },
            channel: 'feishu',
            chatType: 'direct',
            peerId: 'ou_1',
            botIdentity: 'cli_bot_a',
        });

        expect(result).toEqual({
            agentId: 'bound-agent',
            sessionKey: 'agent:bound-agent:feishu:bot:cli_bot_a:direct:ou_1',
        });
    });

    it('falls back to account-level botAgentId when accountId is provided', () => {
        const result = resolveIMRoute({
            config: {
                agents: { list: [], activeAgentId: 'active-agent' },
                im: {
                    channels: {
                        feishu: {
                            accounts: {
                                corpA: {
                                    botAgentId: 'corp-agent',
                                },
                            },
                        },
                    },
                },
            },
            channel: 'feishu',
            chatType: 'group',
            peerId: 'oc_99',
            accountId: 'corpA',
            botIdentity: 'cli_bot_corp',
        });

        expect(result).toEqual({
            agentId: 'corp-agent',
            sessionKey: 'agent:corp-agent:feishu:bot:cli_bot_corp:group:oc_99',
        });
    });

    it('falls back to activeAgentId when no channel binding exists', () => {
        const result = resolveIMRoute({
            config: {
                agents: { list: [], activeAgentId: 'active-agent' },
                im: {
                    channels: {
                        feishu: {},
                    },
                },
            },
            channel: 'feishu',
            chatType: 'direct',
            peerId: 'ou_2',
            botIdentity: 'cli_bot_default',
        });

        expect(result).toEqual({
            agentId: 'active-agent',
            sessionKey: 'agent:active-agent:feishu:bot:cli_bot_default:direct:ou_2',
        });
    });

    it('throws when route cannot resolve any agent', () => {
        expect(() =>
            resolveIMRoute({
                config: {
                    agents: { list: [] },
                    im: {
                        channels: {
                            feishu: {},
                        },
                    },
                },
                channel: 'feishu',
                chatType: 'direct',
                peerId: 'ou_3',
            }),
        ).toThrowError(/agent/i);
    });
});
