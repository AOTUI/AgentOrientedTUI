
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

        expect(sessionManagerMock.sendMessage).toHaveBeenCalledWith(testTopicId, 'Hello World', undefined);
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
});
