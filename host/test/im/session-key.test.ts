import { describe, expect, it } from 'vitest';
import { buildIMSessionKey, buildLarkSessionKey, topicIdFromSessionKey } from '../../src/im/session-key.js';

describe('IM session key utilities', () => {
    it('builds a normalized session key', () => {
        const key = buildIMSessionKey({
            channel: 'LARK',
            accountId: ' Account-A ',
            peerId: ' CHAT_001 ',
        });

        expect(key).toBe('im:lark:account-a:chat_001');
    });

    it('includes thread id when provided', () => {
        const key = buildLarkSessionKey('acc01', 'chat01', 'thread01');
        expect(key).toBe('im:lark:acc01:chat01:thread:thread01');
    });

    it('supports thread-collapsed session scope', () => {
        const key = buildIMSessionKey({
            channel: 'lark',
            accountId: 'acc01',
            peerId: 'chat01',
            threadId: 'thread01',
            sessionScope: 'peer',
        });
        expect(key).toBe('im:lark:acc01:chat01');
    });

    it('derives deterministic topic id from session key', () => {
        const sessionKey = 'im:lark:acc01:chat01';
        const topicA = topicIdFromSessionKey(sessionKey);
        const topicB = topicIdFromSessionKey(sessionKey);

        expect(topicA).toBe(topicB);
        expect(topicA.startsWith('im_')).toBe(true);
    });
});
