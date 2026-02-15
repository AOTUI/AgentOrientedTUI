/**
 * @aotui/host - HostManager V2 Integration Tests
 * 
 * 测试 Host 与 AgentDriver V2 的集成：
 * - 消息流完整闭环
 * - Assistant message 自动保存
 * - Tool message 自动保存
 * - GUI 事件触发
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ModelMessage } from 'ai';
import { HostManagerV2 } from '../src/core/host-manager-v2.js';
import type { ModelRegistry } from '../src/services/model-registry.js';

// Mock LLMConfigService to avoid DB calls
vi.mock('../src/core/llm-config-service.js', () => {
    return {
        LLMConfigService: vi.fn().mockImplementation(() => ({
            getActiveLLMConfig: vi.fn(),
            getAvailableProviders: vi.fn()
        }))
    };
});

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

let sessionManagerMock: {
    on: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    ensureSession: ReturnType<typeof vi.fn>;
    cleanup: ReturnType<typeof vi.fn>;
    emitMessage: (event: any) => void;
};

const createSessionManagerMock = () => {
    let messageHandler: ((event: any) => void) | null = null;
    return {
        on: vi.fn((event: string, handler: (event: any) => void) => {
            if (event === 'message') {
                messageHandler = handler;
            }
        }),
        sendMessage: vi.fn().mockResolvedValue(undefined),
        ensureSession: vi.fn().mockResolvedValue(undefined),
        cleanup: vi.fn().mockResolvedValue(undefined),
        emitMessage: (event: any) => {
            if (messageHandler) {
                messageHandler(event);
            }
        }
    };
};

vi.mock('../src/core/session-manager-v3.js', () => ({
    SessionManagerV3: vi.fn(() => sessionManagerMock)
}));

describe('HostManager V2 Integration', () => {
    let hostManager: HostManagerV2;
    let mockModelRegistry: ModelRegistry;
    const testTopicId = 'topic_integration_test';

    beforeEach(() => {
        vi.clearAllMocks();
        sessionManagerMock = createSessionManagerMock();
        mockModelRegistry = createMockModelRegistry();

        // Create HostManager
        hostManager = new HostManagerV2(testTopicId, mockModelRegistry);
    });

    describe('Message Flow Closure', () => {
        it('should delegate user message to SessionManager', async () => {
            const mockDesktop = {} as any;
            const mockKernel = {} as any;
            const mockDesktopManager = {} as any;

            await hostManager.initAgentDriver(mockDesktop, mockKernel, mockDesktopManager);

            await hostManager.sendUserMessage('Search for AI news');

            expect(sessionManagerMock.sendMessage).toHaveBeenCalledWith(testTopicId, 'Search for AI news', undefined);
        });

        it('should emit GUI update events for message types', async () => {
            const mockDesktop = {} as any;
            const mockKernel = {} as any;
            const mockDesktopManager = {} as any;

            await hostManager.initAgentDriver(mockDesktop, mockKernel, mockDesktopManager);

            const guiEvents: any[] = [];
            hostManager.onGuiUpdate((event) => {
                guiEvents.push(event);
            });

            const assistantMessage: ModelMessage = {
                role: 'assistant',
                content: 'Test response'
            };

            const toolMessage: ModelMessage = {
                role: 'tool',
                content: []
            };

            sessionManagerMock.emitMessage({
                type: 'user',
                message: { role: 'user', content: 'Test message' } as ModelMessage,
                topicId: testTopicId
            });

            sessionManagerMock.emitMessage({
                type: 'assistant',
                message: assistantMessage,
                topicId: testTopicId
            });

            sessionManagerMock.emitMessage({
                type: 'tool',
                message: toolMessage,
                topicId: testTopicId
            });

            expect(guiEvents.length).toBe(3);
            expect(guiEvents[0].type).toBe('user');
            expect(guiEvents[1].type).toBe('assistant');
            expect(guiEvents[2].type).toBe('tool');
        });
    });

    describe('Topic Switching', () => {
        it('should route messages to current topic', async () => {
            const mockDesktop = {} as any;
            const mockKernel = {} as any;
            const mockDesktopManager = {} as any;

            await hostManager.initAgentDriver(mockDesktop, mockKernel, mockDesktopManager);

            const topic1 = 'topic_1';
            const topic2 = 'topic_2';

            await hostManager.switchTopic(topic1);
            await hostManager.sendUserMessage('Message in topic 1');

            await hostManager.switchTopic(topic2);
            await hostManager.sendUserMessage('Message in topic 2');

            expect(sessionManagerMock.sendMessage).toHaveBeenNthCalledWith(1, topic1, 'Message in topic 1', undefined);
            expect(sessionManagerMock.sendMessage).toHaveBeenNthCalledWith(2, topic2, 'Message in topic 2', undefined);
        });
    });
});
