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

    it('passes agentId when creating topic with overrides', async () => {
        const bridge = ChatBridge.getInstance();

        const mockTrpcClient = {
            db: {
                createTopic: {
                    mutate: vi.fn().mockResolvedValue({ ...topic, id: 'desktop_agent' })
                }
            }
        };

        (bridge as any).getTrpcClient = () => mockTrpcClient;

        await bridge.createTopic('Agent Topic', 'project_1', {
            modelOverride: 'openai:gpt-4.1',
            promptOverride: 'system prompt',
            agentId: 'agent_alpha',
            sourceControls: {
                apps: { enabled: true, disabledItems: [] },
                mcp: { enabled: true, disabledItems: [] },
                skill: { enabled: true, disabledItems: [] },
            },
        });

        expect(mockTrpcClient.db.createTopic.mutate).toHaveBeenCalledWith({
            title: 'Agent Topic',
            projectId: 'project_1',
            modelOverride: 'openai:gpt-4.1',
            promptOverride: 'system prompt',
            agentId: 'agent_alpha',
            sourceControls: {
                apps: { enabled: true, disabledItems: [] },
                mcp: { enabled: true, disabledItems: [] },
                skill: { enabled: true, disabledItems: [] },
            },
        });
    });

    it('clears active topic without stale rebound', async () => {
        const bridge = ChatBridge.getInstance();
        const events: Array<{ type: string; topicId?: string }> = [];

        (bridge as any).topics.set(topic.id, topic);
        (bridge as any).messages.set(topic.id, []);

        const unsubscribe = bridge.subscribe((event) => {
            events.push({ type: event.type, topicId: event.topicId });
        });

        await bridge.setActiveTopic(topic.id);
        expect(bridge.getActiveTopicId()).toBe(topic.id);

        bridge.clearActiveTopic();

        expect(bridge.getActiveTopicId()).toBeNull();
        expect(events.some(e => e.type === 'topic' && e.topicId === topic.id)).toBe(true);
        expect(events.some(e => e.type === 'topic' && e.topicId === undefined)).toBe(true);

        unsubscribe();
    });

    it('normalizes assistant reasoning + text without prefixing Reasoning block', () => {
        const bridge = ChatBridge.getInstance();
        const normalized = (bridge as any).normalizeMessages([
            {
                role: 'assistant',
                content: [
                    { type: 'reasoning', text: 'Analyze the request' },
                    { type: 'text', text: 'Final answer' },
                ],
            },
        ]);

        expect(normalized).toHaveLength(1);
        expect(normalized[0].messageType).toBe('text');
        expect(normalized[0].content).toBe('Final answer');
        expect(normalized[0].metadata?.reasoning).toBe('Analyze the request');
    });

    it('keeps reasoning-only assistant message as raw reasoning text', () => {
        const bridge = ChatBridge.getInstance();
        const normalized = (bridge as any).normalizeMessages([
            {
                role: 'assistant',
                content: [{ type: 'reasoning', text: 'Thinking in progress' }],
            },
        ]);

        expect(normalized).toHaveLength(1);
        expect(normalized[0].messageType).toBe('reasoning');
        expect(normalized[0].content).toBe('Thinking in progress');
        expect(normalized[0].metadata?.reasoning).toBe('Thinking in progress');
    });

    it('normalizes user file parts into attachment metadata for image and pdf', () => {
        const bridge = ChatBridge.getInstance();
        const normalized = (bridge as any).normalizeMessages([
            {
                id: 'msg_with_files',
                role: 'user',
                content: [
                    { type: 'text', text: 'Please inspect attachments' },
                    { type: 'file', mediaType: 'image/png', data: 'abcd', filename: 'diagram.png' },
                    { type: 'file', mediaType: 'application/pdf', data: 'efgh', filename: 'design.pdf' },
                ],
            },
        ]);

        expect(normalized).toHaveLength(1);
        expect(normalized[0].content).toBe('Please inspect attachments');
        expect(normalized[0].metadata?.attachments).toEqual([
            {
                id: 'msg_with_files_att_0',
                mime: 'image/png',
                url: 'data:image/png;base64,abcd',
                filename: 'diagram.png',
            },
            {
                id: 'msg_with_files_att_1',
                mime: 'application/pdf',
                url: 'data:application/pdf;base64,efgh',
                filename: 'design.pdf',
            },
        ]);
    });

    it('strips attachments from non-user messages (tool-result bridge disabled)', () => {
        const bridge = ChatBridge.getInstance();
        const normalized = (bridge as any).normalizeMessages([
            {
                id: 'tool_result_1',
                role: 'tool',
                messageType: 'tool_result',
                content: 'ok',
                metadata: {
                    attachments: [
                        {
                            id: 'att_tool_1',
                            mime: 'image/png',
                            url: 'data:image/png;base64,abcd',
                            filename: 'tool.png',
                        },
                    ],
                    toolName: 'mock_tool',
                },
            },
        ]);

        expect(normalized).toHaveLength(1);
        expect(normalized[0].role).toBe('tool');
        expect(normalized[0].metadata?.attachments).toBeUndefined();
        expect(normalized[0].metadata?.toolName).toBe('mock_tool');
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
