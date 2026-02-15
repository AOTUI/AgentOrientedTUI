/**
 * @aotui/host - SessionManager V3 Integration Tests
 * 
 * 测试 SessionManagerV3 的完整功能：
 * - Topic-Desktop-AgentDriver 生命周期
 * - 多 Session 并发支持
 * - 消息流完整性（SystemPrompt + AOTUI Instruction + Desktop State）
 * - Session 清理和资源管理
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { ModelMessage } from 'ai';
import { SessionManagerV3 } from '../src/core/session-manager-v3.js';
import { MessageServiceV2 } from '../src/core/message-service-v2.js';
import { LLMConfigService } from '../src/core/llm-config-service.js';
import type { IDesktop, IKernel } from '@aotui/runtime/spi';
import type { LLMConfig } from '@aotui/agent-driver-v2';
import type { ModelRegistry } from '../src/services/model-registry.js';
import * as dbV2 from '../src/db-v2.js';

// Mock database
const mockDb = {
    run: vi.fn(),
    prepare: vi.fn(() => ({
        bind: vi.fn(),
        step: vi.fn(() => false),
        getAsObject: vi.fn(),
        free: vi.fn()
    })),
    exec: vi.fn()
} as any;

const mockMessages: any[] = [];

vi.mock('../src/db/index.js', () => ({
    getDb: () => mockDb
}));

// Mock ModelRegistry
const createMockModelRegistry = (): ModelRegistry => ({
    getProviders: vi.fn().mockResolvedValue([]),
    getProviderConfig: vi.fn().mockResolvedValue({}),
    getModels: vi.fn().mockResolvedValue([]),
    refresh: vi.fn().mockResolvedValue(undefined),
    getCacheStatus: vi.fn().mockReturnValue({
        lastFetch: Date.now(),
        isStale: false,
        providerCount: 0,
        modelCount: 0,
    }),
    getProviderRegistry: vi.fn().mockResolvedValue({}),
} as any);

// Mock Kernel
const createMockKernel = (): IKernel => {
    const desktops = new Map<string, IDesktop>();
    
    return {
        createDesktop: vi.fn(async (desktopId: any) => {
            if (!desktops.has(desktopId)) {
                const mockDesktop: IDesktop = {
                    id: desktopId,
                    output: {
                        subscribe: vi.fn(),
                        unsubscribe: vi.fn(),
                    } as any,
                    query: vi.fn().mockResolvedValue({}),
                    pull: vi.fn().mockResolvedValue(null),
                    lease: vi.fn().mockResolvedValue(null),
                    stop: vi.fn().mockResolvedValue(undefined),
                } as any;
                desktops.set(desktopId, mockDesktop);
            }
            return desktops.get(desktopId);
        }),
        getDesktop: vi.fn((desktopId: any) => desktops.get(desktopId)),
        destroyDesktop: vi.fn(async (desktopId: any) => {
            desktops.delete(desktopId);
        }),
        // ✅ Add acquireSnapshot and releaseSnapshot for AOTUIDrivenSource
        acquireSnapshot: vi.fn(() => ({
            state: { components: [] },
            timestamp: Date.now(),
        })),
        releaseSnapshot: vi.fn(),
    } as any;
};

describe('SessionManager V3 Integration', () => {
    let sessionManager: SessionManagerV3;
    let messageService: MessageServiceV2;
    let llmConfigService: LLMConfigService;
    let mockKernel: IKernel;
    let mockModelRegistry: ModelRegistry;

    beforeEach(() => {
        vi.clearAllMocks();
        mockMessages.length = 0;

        // Mock DB operations
        vi.spyOn(dbV2, 'createMessageV2').mockImplementation((db, topicId, message) => {
            mockMessages.push({ ...message, topic_id: topicId });
        });

        vi.spyOn(dbV2, 'getMessagesV2').mockImplementation((db, topicId) => {
            return mockMessages
                .filter(m => m.topic_id === topicId)
                .sort((a, b) => a.timestamp - b.timestamp);
        });

        // Create services
        messageService = new MessageServiceV2();
        mockModelRegistry = createMockModelRegistry();
        llmConfigService = new LLMConfigService(mockModelRegistry);
        
        // ✅ Mock getActiveLLMConfig to return a valid config
        vi.spyOn(llmConfigService, 'getActiveLLMConfig').mockResolvedValue({
            model: 'gpt-4',
            provider: 'openai',
            apiKey: 'test-key',
        } as any);
        
        mockKernel = createMockKernel();

        // Create SessionManager
        sessionManager = new SessionManagerV3(
            mockKernel,
            llmConfigService,
            messageService
        );
    });

    afterEach(() => {
        // Clean up
        if (sessionManager) {
            sessionManager.cleanup();
        }
    });

    describe('Session Lifecycle', () => {
        it('should create a new session for a topic', async () => {
            const topicId = 'topic_test_1';

            // Act
            const session = await sessionManager.getOrCreateSession(topicId);

            // Assert
            expect(session).toBeDefined();
            expect(session.topicId).toBe(topicId);
            expect(session.desktop).toBeDefined();
            expect(session.agentDriver).toBeDefined();
            expect(session.state).toBe('active');
            expect(mockKernel.createDesktop).toHaveBeenCalledWith(topicId);
        });

        it('should reuse existing session for the same topic', async () => {
            const topicId = 'topic_test_2';

            // Act
            const session1 = await sessionManager.getOrCreateSession(topicId);
            const session2 = await sessionManager.getOrCreateSession(topicId);

            // Assert
            expect(session1).toBe(session2);
            expect(mockKernel.createDesktop).toHaveBeenCalledTimes(1);
        });

        it('should create separate sessions for different topics', async () => {
            const topic1 = 'topic_test_3a';
            const topic2 = 'topic_test_3b';

            // Act
            const session1 = await sessionManager.getOrCreateSession(topic1);
            const session2 = await sessionManager.getOrCreateSession(topic2);

            // Assert
            expect(session1).not.toBe(session2);
            expect(session1.topicId).toBe(topic1);
            expect(session2.topicId).toBe(topic2);
            expect(mockKernel.createDesktop).toHaveBeenCalledTimes(2);
        });

        it('should enforce max concurrent sessions limit', async () => {
            // Create sessions up to the limit (10)
            const sessions: any[] = [];
            for (let i = 0; i < 11; i++) {
                const topicId = `topic_test_limit_${i}`;
                const session = await sessionManager.getOrCreateSession(topicId);
                sessions.push(session);
            }

            // Assert: Should have evicted the oldest session
            // The first session should no longer exist
            expect(sessions[0].state).toBe('destroyed');
        });
    });

    describe('Message Flow', () => {
        it('should include system prompt in message flow', async () => {
            const topicId = 'topic_test_message_1';

            // Act
            await sessionManager.getOrCreateSession(topicId);
            
            // Get messages through DrivenSources
            const session = (sessionManager as any).sessions.get(topicId);
            const allMessages: ModelMessage[] = [];
            
            // Iterate over sources object properties
            const sources = [session.sources.systemPrompt, session.sources.aotui, session.sources.host];
            for (const source of sources) {
                const messages = await source.getMessages();
                allMessages.push(...messages as ModelMessage[]);
            }

            // Assert: Should have SystemPrompt, AOTUI Instruction, and Desktop State
            expect(allMessages.length).toBeGreaterThanOrEqual(2);
            
            // Find SystemPrompt (timestamp=0)
            const systemPromptMsg = allMessages.find(m => 
                (m as any).timestamp === 0 && m.role === 'system'
            );
            expect(systemPromptMsg).toBeDefined();
            expect(systemPromptMsg?.content).toContain('AI assistant');

            // Find AOTUI Instruction (timestamp=1)
            const aotuiMsg = allMessages.find(m => 
                (m as any).timestamp === 1 && m.role === 'system'
            );
            expect(aotuiMsg).toBeDefined();
        });

        it('should save user message to database', async () => {
            const topicId = 'topic_test_message_2';
            const content = 'Hello, AI!';

            // Act
            await sessionManager.getOrCreateSession(topicId);
            await sessionManager.sendMessage(topicId, content);

            // Assert
            expect(dbV2.createMessageV2).toHaveBeenCalledWith(
                expect.anything(),
                topicId,
                expect.objectContaining({
                    role: 'user',
                    content,
                })
            );
        });

        it('should emit GUI update event on message send', async () => {
            const topicId = 'topic_test_message_3';
            const content = 'Test message';
            
            // Promise to wait for event
            const eventPromise = new Promise<any>((resolve) => {
                sessionManager.on('message', (event) => {
                    resolve(event);
                });
            });

            // Act
            await sessionManager.getOrCreateSession(topicId);
            await sessionManager.sendMessage(topicId, content);

            // Wait for event with timeout
            const event = await Promise.race([
                eventPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000))
            ]);

            // Assert
            expect(event).toBeDefined();
            expect(event.topicId).toBe(topicId);
            expect(event.type).toBe('user');
            expect(event.message.content).toBe(content);
        });
    });

    describe('Session Cleanup', () => {
        it('should destroy session and clean up resources', async () => {
            const topicId = 'topic_test_cleanup_1';

            // Act
            const session = await sessionManager.getOrCreateSession(topicId);
            await sessionManager.destroySession(topicId);

            // Assert
            expect(session.state).toBe('destroyed');
            expect(mockKernel.destroyDesktop).toHaveBeenCalledWith(topicId);
            
            // Verify session is removed from map
            expect((sessionManager as any).sessions.has(topicId)).toBe(false);
        });

        it('should handle destroy of non-existent session', async () => {
            // Act & Assert - should not throw
            await expect(
                sessionManager.destroySession('non_existent_topic')
            ).resolves.not.toThrow();
        });
    });

    describe('Topic Switching', () => {
        it('should switch active topic and create session if needed', async () => {
            const topic1 = 'topic_switch_1';
            const topic2 = 'topic_switch_2';

            // Act
            await sessionManager.switchTopic(topic1);
            await sessionManager.switchTopic(topic2);

            // Assert
            expect(mockKernel.createDesktop).toHaveBeenCalledWith(topic1);
            expect(mockKernel.createDesktop).toHaveBeenCalledWith(topic2);
            expect(mockKernel.createDesktop).toHaveBeenCalledTimes(2);
        });
    });

    describe('Concurrent Sessions', () => {
        it('should handle multiple concurrent sessions', async () => {
            const topicIds = ['topic_concurrent_1', 'topic_concurrent_2', 'topic_concurrent_3'];

            // Act - Create sessions concurrently
            await Promise.all(
                topicIds.map(id => sessionManager.getOrCreateSession(id))
            );

            // Assert
            for (const topicId of topicIds) {
                const session = (sessionManager as any).sessions.get(topicId);
                expect(session).toBeDefined();
                expect(session.state).toBe('active');
            }
        });

        it('should isolate messages between different sessions', async () => {
            const topic1 = 'topic_isolate_1';
            const topic2 = 'topic_isolate_2';
            const message1 = 'Message for topic 1';
            const message2 = 'Message for topic 2';

            // Act
            await sessionManager.getOrCreateSession(topic1);
            await sessionManager.getOrCreateSession(topic2);
            await sessionManager.sendMessage(topic1, message1);
            await sessionManager.sendMessage(topic2, message2);

            // Assert
            const topic1Messages = messageService.getMessages(topic1);
            const topic2Messages = messageService.getMessages(topic2);

            expect(topic1Messages.find(m => m.content === message1)).toBeDefined();
            expect(topic1Messages.find(m => m.content === message2)).toBeUndefined();
            
            expect(topic2Messages.find(m => m.content === message2)).toBeDefined();
            expect(topic2Messages.find(m => m.content === message1)).toBeUndefined();
        });
    });
});
