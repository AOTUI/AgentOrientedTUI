/**
 * @aotui/host - MessageServiceV2 Tests
 * 
 * 测试消息服务的核心功能：
 * - 保存和检索所有类型的消息（user/assistant/tool/system）
 * - 消息按时间戳排序
 * - 消息持久化
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ModelMessage } from 'ai';
import { MessageServiceV2 } from '../src/core/message-service-v2.js';
import * as db from '../src/db/index.js';
import * as dbV2 from '../src/db-v2.js';

// Mock database
const mockDb = {
    run: vi.fn(),
    prepare: vi.fn(() => ({
        bind: vi.fn(),
        step: vi.fn(() => false),
        getAsObject: vi.fn(),
        free: vi.fn()
    }))
} as any;

const mockMessages: any[] = [];

vi.mock('../src/db/index.js', () => ({
    getDb: () => mockDb,
    persistDatabase: vi.fn(),
}));

describe('MessageServiceV2', () => {
    let messageService: MessageServiceV2;
    const testTopicId = 'topic_test_1';

    beforeEach(() => {
        vi.clearAllMocks();
        mockMessages.length = 0;

        // Mock createMessageV2 to store messages
        vi.spyOn(dbV2, 'createMessageV2').mockImplementation((db, topicId, message) => {
            mockMessages.push({ ...message, topic_id: topicId });
        });

        // Mock getMessagesV2 to return stored messages
        vi.spyOn(dbV2, 'getMessagesV2').mockImplementation((db, topicId) => {
            return mockMessages
                .filter(m => m.topic_id === topicId)
                .sort((a, b) => a.timestamp - b.timestamp);
        });

        vi.spyOn(dbV2, 'updateMessageV2').mockImplementation((db, topicId, message) => {
            const idx = mockMessages.findIndex((m) => m.topic_id === topicId && m.id === message.id);
            if (idx >= 0) {
                mockMessages[idx] = { ...message, topic_id: topicId };
            }
        });

        messageService = new MessageServiceV2();
    });

    describe('addMessage', () => {
        it('should save user message', () => {
            const userMessage: ModelMessage = {
                role: 'user',
                content: 'Hello, can you help me?'
            };

            const saved = messageService.addMessage(testTopicId, userMessage);

            expect(saved.id).toBeDefined();
            expect(saved.role).toBe('user');
            expect(saved.content).toBe('Hello, can you help me?');
            expect(saved.timestamp).toBeDefined();
            expect(mockMessages.length).toBe(1);
        });

        it('should save assistant message with text', () => {
            const assistantMessage: ModelMessage = {
                role: 'assistant',
                content: 'Sure, I can help you with that!'
            };

            const saved = messageService.addMessage(testTopicId, assistantMessage);

            expect(saved.role).toBe('assistant');
            expect(saved.content).toBe('Sure, I can help you with that!');
            expect(mockMessages.length).toBe(1);
        });

        it('should save assistant message with tool calls', () => {
            const assistantMessage: ModelMessage = {
                role: 'assistant',
                content: [
                    {
                        type: 'text',
                        text: 'Let me search for that information.'
                    },
                    {
                        type: 'tool-call',
                        toolCallId: 'call_123',
                        toolName: 'search',
                        args: { query: 'AI news' }
                    }
                ]
            };

            const saved = messageService.addMessage(testTopicId, assistantMessage);

            expect(saved.role).toBe('assistant');
            expect(Array.isArray(saved.content)).toBe(true);
            expect((saved.content as any[]).length).toBe(2);
        });

        it('should save tool message', () => {
            const toolMessage: ModelMessage = {
                role: 'tool',
                content: [
                    {
                        type: 'tool-result',
                        toolCallId: 'call_123',
                        toolName: 'search',
                        result: {
                            data: 'Found 10 results about AI news'
                        }
                    }
                ]
            };

            const saved = messageService.addMessage(testTopicId, toolMessage);

            expect(saved.role).toBe('tool');
            expect(Array.isArray(saved.content)).toBe(true);
        });

        it('should save system message', () => {
            const systemMessage: ModelMessage = {
                role: 'system',
                content: 'You are a helpful assistant.'
            };

            const saved = messageService.addMessage(testTopicId, systemMessage);

            expect(saved.role).toBe('system');
            expect(saved.content).toBe('You are a helpful assistant.');
        });
    });

    describe('getMessages', () => {
        it('should return messages in chronological order', () => {
            // 添加多条消息
            messageService.addMessage(testTopicId, {
                role: 'user',
                content: 'First message'
            });

            messageService.addMessage(testTopicId, {
                role: 'assistant',
                content: 'Second message'
            });

            messageService.addMessage(testTopicId, {
                role: 'user',
                content: 'Third message'
            });

            const messages = messageService.getMessages(testTopicId);

            expect(messages.length).toBe(3);
            expect((messages[0].content as string)).toBe('First message');
            expect((messages[1].content as string)).toBe('Second message');
            expect((messages[2].content as string)).toBe('Third message');
        });

        it('should return all message types', () => {
            messageService.addMessage(testTopicId, {
                role: 'user',
                content: 'User'
            });

            messageService.addMessage(testTopicId, {
                role: 'assistant',
                content: 'Assistant'
            });

            messageService.addMessage(testTopicId, {
                role: 'tool',
                content: [{ type: 'tool-result', toolCallId: 'call_1', toolName: 'test', result: 'Tool' }]
            });

            const messages = messageService.getMessages(testTopicId);

            expect(messages.length).toBe(3);
            expect(messages.some(m => m.role === 'user')).toBe(true);
            expect(messages.some(m => m.role === 'assistant')).toBe(true);
            expect(messages.some(m => m.role === 'tool')).toBe(true);
        });

        it('should return empty array for non-existent topic', () => {
            const messages = messageService.getMessages('non_existent_topic');
            expect(messages).toEqual([]);
        });
    });

    describe('Message Flow Integration', () => {
        it('should complete a full conversation cycle', () => {
            // 1. User message
            messageService.addMessage(testTopicId, {
                role: 'user',
                content: 'Search for AI news'
            });

            // 2. Assistant message with tool call
            messageService.addMessage(testTopicId, {
                role: 'assistant',
                content: [
                    {
                        type: 'tool-call',
                        toolCallId: 'call_123',
                        toolName: 'search',
                        args: { query: 'AI news' }
                    }
                ]
            });

            // 3. Tool result
            messageService.addMessage(testTopicId, {
                role: 'tool',
                content: [
                    {
                        type: 'tool-result',
                        toolCallId: 'call_123',
                        toolName: 'search',
                        result: { data: 'Results...' }
                    }
                ]
            });

            // 4. Final assistant response
            messageService.addMessage(testTopicId, {
                role: 'assistant',
                content: 'Here are the latest AI news...'
            });

            // Verify
            const messages = messageService.getMessages(testTopicId);

            expect(messages.length).toBe(4);
            expect(messages[0].role).toBe('user');
            expect(messages[1].role).toBe('assistant');
            expect(messages[2].role).toBe('tool');
            expect(messages[3].role).toBe('assistant');
        });
    });

    describe('Context Compaction', () => {
        it('should keep full GUI history but filter LLM messages after compaction anchor', () => {
            const keepCount = 10;
            for (let i = 0; i < 16; i += 1) {
                messageService.addMessage(testTopicId, {
                    role: i % 2 === 0 ? 'user' : 'assistant',
                    content: `message-${i}`,
                } as ModelMessage);
            }

            const result = messageService.compactContext(testTopicId, {
                trigger: 'host_fallback',
                createSyntheticMessages: true,
                keepRecentMessages: keepCount,
            });

            expect(result.compacted).toBe(true);
            expect(result.syntheticMessages.length).toBe(2);

            const fullMessages = messageService.getMessages(testTopicId);
            expect(fullMessages.length).toBe(18);

            const llmMessages = messageService.getMessagesForLLM(testTopicId);
            expect(llmMessages.length).toBe(2);
            expect(llmMessages[0].role).toBe('assistant');
            expect(llmMessages[1].role).toBe('tool');
            expect((llmMessages[1] as any)._aotuiCompactionAnchor).toBe(true);
        });

        it('should clean old tool result outputs with placeholder but keep structure', () => {
            const toolCallId = 'call_old_1';
            for (let i = 0; i < 8; i += 1) {
                messageService.addMessage(testTopicId, {
                    role: 'user',
                    content: `seed-${i}`,
                } as ModelMessage);
            }

            messageService.addMessage(testTopicId, {
                role: 'tool',
                content: [
                    {
                        type: 'tool-result',
                        toolCallId,
                        toolName: 'search_code',
                        result: 'VERY_LONG_TOOL_OUTPUT_ABC',
                    },
                ],
            } as ModelMessage);

            for (let i = 0; i < 8; i += 1) {
                messageService.addMessage(testTopicId, {
                    role: i % 2 === 0 ? 'assistant' : 'user',
                    content: `tail-${i}`,
                } as ModelMessage);
            }

            const result = messageService.compactContext(testTopicId, {
                trigger: 'host_fallback',
                createSyntheticMessages: true,
                keepRecentMessages: 6,
            });

            expect(result.compacted).toBe(true);
            expect(result.cleanedToolResultCount).toBeGreaterThan(0);

            const toolMessages = messageService
                .getMessages(testTopicId)
                .filter((message) => message.role === 'tool') as any[];
            const oldToolMessage = toolMessages.find((message) =>
                Array.isArray(message.content) &&
                message.content.some((part: any) => part.toolName === 'search_code')
            );

            expect(oldToolMessage).toBeDefined();
            const resultPart = oldToolMessage.content.find((part: any) => part.toolName === 'search_code');
            expect(resultPart.result).toBe('[Old tool result content cleared by context compaction]');
            expect(resultPart.output).toBe('[Old tool result content cleared by context compaction]');
            expect(resultPart.metadata.aotuiCompacted).toBe(true);
        });

        it('should allow agent-trigger compaction without synthetic messages', () => {
            for (let i = 0; i < 16; i += 1) {
                messageService.addMessage(testTopicId, {
                    role: i % 2 === 0 ? 'user' : 'assistant',
                    content: `agent-${i}`,
                } as ModelMessage);
            }

            const before = messageService.getMessages(testTopicId).length;
            const result = messageService.compactContext(testTopicId, {
                trigger: 'agent',
                createSyntheticMessages: false,
            });
            const after = messageService.getMessages(testTopicId).length;

            expect(result.compacted).toBe(true);
            expect(result.syntheticMessages.length).toBe(0);
            expect(after).toBe(before);
        });

        it('should support repeated compaction across multiple growth cycles without re-compacting old windows', () => {
            for (let i = 0; i < 16; i += 1) {
                messageService.addMessage(testTopicId, {
                    role: i % 2 === 0 ? 'user' : 'assistant',
                    content: `round1-${i}`,
                } as ModelMessage);
            }

            const r1 = messageService.compactContext(testTopicId, {
                trigger: 'host_fallback',
                createSyntheticMessages: true,
                keepRecentMessages: 8,
            });
            expect(r1.compacted).toBe(true);
            expect(r1.compactedMessageCount).toBe(16);

            let llmWindow = messageService.getMessagesForLLM(testTopicId);
            expect(llmWindow.length).toBe(2);
            expect(llmWindow[0].role).toBe('assistant');
            expect(llmWindow[1].role).toBe('tool');

            for (let i = 0; i < 14; i += 1) {
                messageService.addMessage(testTopicId, {
                    role: i % 2 === 0 ? 'user' : 'assistant',
                    content: `round2-${i}`,
                } as ModelMessage);
            }

            const r2 = messageService.compactContext(testTopicId, {
                trigger: 'host_fallback',
                createSyntheticMessages: true,
                keepRecentMessages: 8,
            });
            expect(r2.compacted).toBe(true);
            expect(r2.compactedMessageCount).toBe(14);

            llmWindow = messageService.getMessagesForLLM(testTopicId);
            expect(llmWindow.length).toBe(2);
            expect(llmWindow[0].role).toBe('assistant');
            expect(llmWindow[1].role).toBe('tool');
            expect((llmWindow[1] as any)._aotuiCompactionAnchor).toBe(true);

            for (let i = 0; i < 14; i += 1) {
                messageService.addMessage(testTopicId, {
                    role: i % 2 === 0 ? 'user' : 'assistant',
                    content: `round3-${i}`,
                } as ModelMessage);
            }

            const r3 = messageService.compactContext(testTopicId, {
                trigger: 'host_fallback',
                createSyntheticMessages: true,
                keepRecentMessages: 8,
            });
            expect(r3.compacted).toBe(true);
            expect(r3.compactedMessageCount).toBe(14);

            llmWindow = messageService.getMessagesForLLM(testTopicId);
            expect(llmWindow.length).toBe(2);
            expect(llmWindow[0].role).toBe('assistant');
            expect(llmWindow[1].role).toBe('tool');
            expect((llmWindow[1] as any)._aotuiCompactionAnchor).toBe(true);
        });
    });
});
