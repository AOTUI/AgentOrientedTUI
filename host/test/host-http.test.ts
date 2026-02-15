import { describe, it, expect } from 'vitest';
import { createHostV2 as createHost } from '../src/server/host-v2.js';

describe('Host HTTP API', () => {
    it('handles topic and message CRUD via Host', async () => {
        const wss = await createHost(0);
        const server = (wss as any).httpServer as import('http').Server;

        await new Promise<void>((resolve) => {
            if (server.listening) {
                resolve();
                return;
            }
            server.once('listening', () => resolve());
        });

        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        const baseUrl = `http://localhost:${port}`;

        const createTopicResponse = await fetch(`${baseUrl}/api/topics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Test Topic' })
        });
        const createTopicJson = await createTopicResponse.json();

        expect(createTopicJson.success).toBe(true);
        const topicId = createTopicJson.data.id as string;

        const createMessageResponse = await fetch(`${baseUrl}/api/topics/${topicId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'user', content: 'Hello' })
        });
        const createMessageJson = await createMessageResponse.json();

        expect(createMessageJson.success).toBe(true);

        const messagesResponse = await fetch(`${baseUrl}/api/topics/${topicId}/messages`);
        const messagesJson = await messagesResponse.json();

        expect(messagesJson.success).toBe(true);
        expect(messagesJson.data.length).toBeGreaterThan(0);

        const deleteResponse = await fetch(`${baseUrl}/api/topics/${topicId}`, {
            method: 'DELETE'
        });
        const deleteJson = await deleteResponse.json();
        expect(deleteJson.success).toBe(true);

        const getAfterDelete = await fetch(`${baseUrl}/api/topics/${topicId}`);
        expect(getAfterDelete.status).toBe(404);

        wss.close();
        server.close();
    });
});
