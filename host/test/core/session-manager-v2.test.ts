/**
 * @aotui/host - SessionManagerV2 Tests
 * 
 * 验证 SessionManagerV2 核心功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManagerV2 } from '../../src/core/session-manager-v2.js';
import { LLMConfigService } from '../../src/core/llm-config-service.js';
import { ModelRegistry } from '../../src/services/model-registry.js';
import type { IKernel, IDesktop, DesktopID } from '@aotui/runtime/spi';

// Mock dependencies
const createMockKernel = (): IKernel => ({
    getDesktop: vi.fn((id: DesktopID) => {
        throw new Error(`Desktop ${id} not found`);
    }),
    createDesktop: vi.fn(async (id: DesktopID) => ({
        id,
        output: { subscribe: vi.fn(), unsubscribe: vi.fn() }
    } as any)),
    acquireSnapshot: vi.fn(),
    releaseSnapshot: vi.fn(),
    execute: vi.fn()
} as any);

const createMockLLMConfigService = (): LLMConfigService => ({
    getActiveLLMConfig: vi.fn(async () => ({
        model: 'gpt-4',
        temperature: 0.7,
        maxSteps: 5
    }))
} as any);

const createMockModelRegistry = (): ModelRegistry => ({
    getProviders: vi.fn(async () => []),
    getProviderConfig: vi.fn(async () => ({ id: 'test', name: 'Test', baseURL: '', envKeys: [], supportedModels: [] })),
    getModels: vi.fn(async () => []),
    refresh: vi.fn(async () => {}),
    getCacheStatus: vi.fn(() => ({ lastFetch: 0, isStale: false, providerCount: 0, modelCount: 0 }))
} as any);

describe('SessionManagerV2', () => {
    let sessionManager: SessionManagerV2;
    let mockKernel: IKernel;
    let mockLLMConfigService: LLMConfigService;
    let mockModelRegistry: ModelRegistry;

    beforeEach(() => {
        mockKernel = createMockKernel();
        mockLLMConfigService = createMockLLMConfigService();
        mockModelRegistry = createMockModelRegistry();
        sessionManager = new SessionManagerV2(mockKernel, mockLLMConfigService, mockModelRegistry);
    });

    afterEach(async () => {
        // Cleanup
        await sessionManager.destroyAll();
    });

    describe('getOrCreateSession', () => {
        it('should create a new session if not exists', async () => {
            const topicId = 'test-topic-1';

            const session = await sessionManager.getOrCreateSession(topicId);

            expect(session).toBeDefined();
            expect(mockKernel.createDesktop).toHaveBeenCalledWith(topicId);
            expect(mockLLMConfigService.getActiveLLMConfig).toHaveBeenCalled();
        });

        it('should return existing session if already created', async () => {
            const topicId = 'test-topic-2';

            const session1 = await sessionManager.getOrCreateSession(topicId);
            const session2 = await sessionManager.getOrCreateSession(topicId);

            expect(session1).toBe(session2);
            expect(mockKernel.createDesktop).toHaveBeenCalledTimes(1);
        });

        it('should emit session-created event', async () => {
            const topicId = 'test-topic-3';
            const eventSpy = vi.fn();

            sessionManager.on('session-created', eventSpy);

            await sessionManager.getOrCreateSession(topicId);

            expect(eventSpy).toHaveBeenCalledWith(topicId);
        });
    });

    describe('switchSession', () => {
        it('should switch to a new session', async () => {
            const topicId1 = 'test-topic-4';
            const topicId2 = 'test-topic-5';

            await sessionManager.switchSession(topicId1);
            expect(sessionManager.getCurrentSessionId()).toBe(topicId1);

            await sessionManager.switchSession(topicId2);
            expect(sessionManager.getCurrentSessionId()).toBe(topicId2);
        });

        it('should emit session-switched event', async () => {
            const topicId = 'test-topic-6';
            const eventSpy = vi.fn();

            sessionManager.on('session-switched', eventSpy);

            await sessionManager.switchSession(topicId);

            expect(eventSpy).toHaveBeenCalledWith(topicId);
        });
    });

    describe('getCurrentSession', () => {
        it('should return null if no session is active', () => {
            const current = sessionManager.getCurrentSession();
            expect(current).toBeNull();
        });

        it('should return current session after switch', async () => {
            const topicId = 'test-topic-7';

            await sessionManager.switchSession(topicId);

            const current = sessionManager.getCurrentSession();
            expect(current).toBeDefined();
        });
    });

    describe('destroySession', () => {
        it('should destroy a session', async () => {
            const topicId = 'test-topic-8';

            await sessionManager.getOrCreateSession(topicId);
            await sessionManager.destroySession(topicId);

            const session = sessionManager.getSession(topicId);
            expect(session).toBeUndefined();
        });

        it('should emit session-destroyed event', async () => {
            const topicId = 'test-topic-9';
            const eventSpy = vi.fn();

            await sessionManager.getOrCreateSession(topicId);
            sessionManager.on('session-destroyed', eventSpy);

            await sessionManager.destroySession(topicId);

            expect(eventSpy).toHaveBeenCalledWith(topicId);
        });

        it('should clear currentSessionId if destroying current session', async () => {
            const topicId = 'test-topic-10';

            await sessionManager.switchSession(topicId);
            await sessionManager.destroySession(topicId);

            expect(sessionManager.getCurrentSessionId()).toBeNull();
        });
    });

    describe('getAllSessionIds', () => {
        it('should return all session IDs', async () => {
            await sessionManager.getOrCreateSession('topic-1');
            await sessionManager.getOrCreateSession('topic-2');
            await sessionManager.getOrCreateSession('topic-3');

            const ids = sessionManager.getAllSessionIds();

            expect(ids).toHaveLength(3);
            expect(ids).toContain('topic-1');
            expect(ids).toContain('topic-2');
            expect(ids).toContain('topic-3');
        });
    });

    describe('destroyAll', () => {
        it('should destroy all sessions', async () => {
            await sessionManager.getOrCreateSession('topic-1');
            await sessionManager.getOrCreateSession('topic-2');

            await sessionManager.destroyAll();

            expect(sessionManager.getAllSessionIds()).toHaveLength(0);
        });
    });
});
