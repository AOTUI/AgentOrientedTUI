import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatBridge } from '../src/gui/ChatBridge.js';
import type { Topic } from '../src/types.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('ChatBridge Host-only', () => {
    const topic: Topic = {
        id: 'desktop_test',
        title: 'Test',
        createdAt: 1,
        updatedAt: 1,
        status: 'hot'
    };

    beforeEach(() => {
        (ChatBridge as any).instance = null;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        (ChatBridge as any).instance = null;
    });

    it('creates topics through tRPC', async () => {
        const bridge = ChatBridge.getInstance();
        
        const mockTrpcClient = {
            db: {
                createTopic: {
                    mutate: vi.fn().mockResolvedValue(topic)
                }
            }
        };

        // Mock getTrpcClient
        (bridge as any).getTrpcClient = () => mockTrpcClient;

        const created = await bridge.createTopic('Test');

        expect(created?.id).toBe(topic.id);
        expect(mockTrpcClient.db.createTopic.mutate).toHaveBeenCalledWith({ title: 'Test' });
    });
});

describe('Database topic persistence', () => {
    it('persists projectId on topic creation', async () => {
        const dbPath = path.join(
            os.tmpdir(),
            `system-chat-db-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sqlite`
        );
        process.env.DB_PATH = dbPath;
        const db = await import('../src/db/index.js');

        await db.initDatabase();

        const topic = {
            id: 'topic_test',
            title: 'Test Topic',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            status: 'hot' as const,
            projectId: 'project_test'
        };

        db.createTopic(topic);
        const stored = db.getTopic(topic.id);

        expect(stored?.projectId).toBe('project_test');

        db.closeDatabase();
        if (fs.existsSync(dbPath)) {
            fs.rmSync(dbPath, { force: true });
        }
    });
});
