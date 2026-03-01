import { describe, expect, it } from 'vitest';
import { buildSessionKey, resolveIMRoute } from '../../src/im/routing.js';

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

    it('throws when peer id is empty', () => {
        expect(() => buildSessionKey('agent-A', 'feishu', 'group', '   ')).toThrowError(/peerId/i);
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
        });

        expect(result).toEqual({
            agentId: 'bound-agent',
            sessionKey: 'agent:bound-agent:feishu:direct:ou_1',
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
        });

        expect(result).toEqual({
            agentId: 'corp-agent',
            sessionKey: 'agent:corp-agent:feishu:group:oc_99',
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
        });

        expect(result).toEqual({
            agentId: 'active-agent',
            sessionKey: 'agent:active-agent:feishu:direct:ou_2',
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
