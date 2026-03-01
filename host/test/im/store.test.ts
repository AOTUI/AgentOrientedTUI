import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { IMStateStore } from '../../src/im/store.js';
import type { IMRouteContext } from '../../src/im/types.js';

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aotui-im-store-'));
    tempDirs.push(dir);
    return dir;
}

afterEach(async () => {
    await Promise.all(
        tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
});

describe('IMStateStore', () => {
    it('binds route and resolves topic by session key', async () => {
        const store = new IMStateStore(await createTempDir());
        await store.init();

        const route: IMRouteContext = {
            channel: 'lark',
            accountId: 'acc01',
            receiveId: 'chat01',
            receiveIdType: 'chat_id',
            sessionKey: 'im:lark:acc01:chat01',
            updatedAt: Date.now(),
        };

        await store.bindRoute({
            topicId: 'topic01',
            sessionKey: route.sessionKey,
            route,
        });

        expect(store.getTopicIdBySessionKey(route.sessionKey)).toBe('topic01');
        expect(store.getRouteByTopicId('topic01')?.receiveId).toBe('chat01');
    });

    it('tracks processed event keys and supports unmark', async () => {
        const store = new IMStateStore(await createTempDir());
        await store.init();

        const eventKey = 'lark:acc01:event01';
        expect(store.isEventProcessed(eventKey)).toBe(false);

        const existedBefore = await store.markEventProcessed(eventKey);
        expect(existedBefore).toBe(false);
        expect(store.isEventProcessed(eventKey)).toBe(true);

        const existedAfter = await store.markEventProcessed(eventKey);
        expect(existedAfter).toBe(true);

        await store.unmarkEventProcessed(eventKey);
        expect(store.isEventProcessed(eventKey)).toBe(false);
    });
});
