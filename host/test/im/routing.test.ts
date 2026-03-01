import { describe, expect, it } from 'vitest';
import { resolveInboundRoute } from '../../src/im/routing.js';
import type { IMInboundMessage } from '../../src/im/types.js';

function createInbound(overrides: Partial<IMInboundMessage> = {}): IMInboundMessage {
    return {
        channel: 'lark',
        accountId: 'default',
        eventId: 'event_001',
        externalMessageId: 'om_001',
        senderId: 'ou_001',
        chatId: 'oc_001',
        text: 'hello',
        ...overrides,
    };
}

describe('IM routing strategy', () => {
    it('uses peer+thread scope by default', () => {
        const resolved = resolveInboundRoute(createInbound({ threadId: 'thread01' }), {
            receiveIdType: 'chat_id',
        });

        expect(resolved.sessionKey).toBe('im:lark:default:oc_001:thread:thread01');
        expect(resolved.route.sessionScope).toBe('peer_thread');
        expect(resolved.route.threadId).toBe('thread01');
    });

    it('supports peer scope to collapse threads', () => {
        const resolved = resolveInboundRoute(createInbound({ threadId: 'thread01' }), {
            sessionScope: 'peer',
            receiveIdType: 'chat_id',
        });

        expect(resolved.sessionKey).toBe('im:lark:default:oc_001');
        expect(resolved.route.sessionScope).toBe('peer');
        expect(resolved.route.threadId).toBe('thread01');
    });
});
