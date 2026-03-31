
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HostManagerV2 } from '../src/core/host-manager-v2';
import type { ModelMessage } from 'ai';
import type { ModelRegistry } from '../src/services/model-registry.js';

// Mock MessageServiceV2
const mockAddMessage = vi.fn();
const mockGetMessages = vi.fn();

vi.mock('../src/core/message-service-v2', () => ({
    MessageServiceV2: vi.fn(() => ({
        addMessage: mockAddMessage,
        getMessages: mockGetMessages
    }))
}));

let sessionManagerMock: {
    on: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
    ensureSession: ReturnType<typeof vi.fn>;
    cleanup: ReturnType<typeof vi.fn>;
    emitMessage: (event: any) => void;
};

let imSessionManagerMock: {
    ensureSession: ReturnType<typeof vi.fn>;
    dispatch: ReturnType<typeof vi.fn>;
    destroyAllSessions: ReturnType<typeof vi.fn>;
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

vi.mock('../src/im/im-session-manager.js', () => ({
    IMSessionManager: vi.fn(() => imSessionManagerMock),
}));

const configGetMock = vi.fn();
vi.mock('../src/config/config.js', () => ({
    Config: {
        get: (...args: unknown[]) => configGetMock(...args),
    },
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

describe('HostManagerV2 Integration', () => {
    let hostManager: HostManagerV2;
    let mockModelRegistry: ModelRegistry;
    const testTopicId = 'test-topic';

    beforeEach(() => {
        vi.clearAllMocks();
        sessionManagerMock = createSessionManagerMock();
        imSessionManagerMock = {
            ensureSession: vi.fn().mockResolvedValue({
                source: {
                    maybeCompactByThreshold: vi.fn().mockResolvedValue({
                        compacted: false,
                        syntheticMessages: [],
                        summary: '',
                        compactedMessageCount: 0,
                        cleanedToolResultCount: 0,
                        currentTokens: 0,
                        thresholdTokens: 4500,
                    }),
                },
            }),
            dispatch: vi.fn().mockResolvedValue(undefined),
            destroyAllSessions: vi.fn().mockResolvedValue(undefined),
        };
        configGetMock.mockResolvedValue({
            experimental: {
                contextCompaction: {
                    enabled: true,
                    minMessages: 14,
                    keepRecentMessages: 8,
                    hardFallbackThresholdTokens: 4500,
                },
            },
            agents: {
                list: [],
            },
        });
        mockModelRegistry = createMockModelRegistry();
        hostManager = new HostManagerV2(testTopicId, mockModelRegistry);
    });

    it('should initialize SessionManager and register message handler', async () => {
        const mockDesktop = {} as any;
        const mockKernel = {} as any;
        const mockDesktopManager = {} as any;

        await hostManager.initAgentDriver(mockDesktop, mockKernel, mockDesktopManager);

        expect(sessionManagerMock.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should delegate sendUserMessage to SessionManager', async () => {
        const mockDesktop = {} as any;
        const mockKernel = {} as any;
        const mockDesktopManager = {} as any;

        await hostManager.initAgentDriver(mockDesktop, mockKernel, mockDesktopManager);

        await hostManager.sendUserMessage('Hello World');

        expect(sessionManagerMock.sendMessage).toHaveBeenCalledWith(testTopicId, 'Hello World', undefined, undefined);
    });

    it('should emit GUI update when session message is received', async () => {
        const mockDesktop = {} as any;
        const mockKernel = {} as any;
        const mockDesktopManager = {} as any;

        await hostManager.initAgentDriver(mockDesktop, mockKernel, mockDesktopManager);

        const assistantMessage: ModelMessage = {
            role: 'assistant',
            content: 'Hello World'
        };

        const onGuiUpdateSpy = vi.fn();
        hostManager.onGuiUpdate(onGuiUpdateSpy);

        sessionManagerMock.emitMessage({
            type: 'assistant',
            message: assistantMessage,
            topicId: testTopicId
        });

        expect(onGuiUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: 'assistant',
            message: assistantMessage,
            topicId: testTopicId
        }));
    });

    it('should apply IM compaction policy before dispatching inbound IM message', async () => {
        const mockDesktop = {} as any;
        const mockKernel = {} as any;
        const mockDesktopManager = {} as any;

        const maybeCompactByThreshold = vi.fn().mockResolvedValue({
            compacted: true,
            syntheticMessages: [
                { role: 'assistant', content: [], timestamp: 1_000 },
                { role: 'tool', content: [], timestamp: 1_001 },
            ],
            summary: 'compacted',
            compactedMessageCount: 5,
            cleanedToolResultCount: 2,
            currentTokens: 5_200,
            thresholdTokens: 3_200,
        });
        imSessionManagerMock.ensureSession.mockResolvedValue({
            source: {
                maybeCompactByThreshold,
            },
        });
        configGetMock.mockResolvedValue({
            experimental: {
                contextCompaction: {
                    enabled: true,
                    minMessages: 20,
                    keepRecentMessages: 6,
                    hardFallbackThresholdTokens: 3_200,
                },
            },
            agents: {
                list: [
                    { id: 'agent-main', modelId: 'openai:gpt-4o' },
                ],
            },
        });

        await hostManager.initAgentDriver(mockDesktop, mockKernel, mockDesktopManager);

        const onGuiUpdateSpy = vi.fn();
        hostManager.onGuiUpdate(onGuiUpdateSpy);

        await hostManager.sendIMMessage({
            sessionKey: 'agent:agent-main:feishu:direct:ou_1',
            agentId: 'agent-main',
            channel: 'feishu',
            chatType: 'direct',
            peerId: 'ou_1',
            body: 'hello from feishu',
            messageId: 'om_1',
            senderId: 'ou_1',
            chatId: 'oc_1',
            timestamp: 1_234,
        });

        expect(imSessionManagerMock.ensureSession).toHaveBeenCalledWith('agent:agent-main:feishu:direct:ou_1', 'agent-main');
        expect(maybeCompactByThreshold).toHaveBeenCalledWith({
            enabled: true,
            maxContextTokens: 3_200,
            minMessages: 20,
            keepRecentMessages: 6,
            modelHint: 'openai:gpt-4o',
        });
        expect(imSessionManagerMock.dispatch).toHaveBeenCalledWith(expect.objectContaining({
            sessionKey: 'agent:agent-main:feishu:direct:ou_1',
            body: 'hello from feishu',
        }));
        expect(onGuiUpdateSpy.mock.calls.map((call) => call[0].type)).toEqual(['assistant', 'tool', 'user']);
    });
});
