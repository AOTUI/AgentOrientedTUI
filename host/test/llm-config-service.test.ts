/**
 * @aotui/host - LLMConfigService Tests
 * 
 * 测试 LLM 配置管理服务
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMConfigService } from '../src/core/llm-config-service.js';
import type { LLMConfigInput } from '../src/types/llm-config.js';
import * as llmConfigDb from '../src/db/llm-config-db.js';
import type { ModelRegistry } from '../src/services/model-registry.js';

// Mock database
const mockDb = {
    run: vi.fn(),
    prepare: vi.fn(() => ({
        bind: vi.fn(),
        step: vi.fn(() => false),
        getAsObject: vi.fn(),
        free: vi.fn()
    })),
    exec: vi.fn(() => [[{ values: [[1]] }]])
} as any;

let mockConfigs: any[] = [];

vi.mock('../src/db/index.js', () => ({
    getDb: () => mockDb
}));

// Mock ModelRegistry
const createMockModelRegistry = (): ModelRegistry => ({
    getProviders: vi.fn().mockResolvedValue([
        { id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', modelCount: 2 },
        { id: 'anthropic', name: 'Anthropic', baseURL: 'https://api.anthropic.com/v1', modelCount: 2 },
    ]),
    getProviderConfig: vi.fn().mockResolvedValue({
        id: 'openai',
        name: 'OpenAI',
        baseURL: 'https://api.openai.com/v1',
        envKeys: ['OPENAI_API_KEY'],
        supportedModels: ['gpt-4', 'gpt-4o'],
    }),
    getModels: vi.fn().mockResolvedValue([
        { id: 'openai/gpt-4', name: 'GPT-4', tool_call: true, reasoning: false },
        { id: 'openai/gpt-4o', name: 'GPT-4o', tool_call: true, reasoning: false },
        { id: 'anthropic/claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', tool_call: true, reasoning: false },
    ]),
    refresh: vi.fn().mockResolvedValue(undefined),
    getCacheStatus: vi.fn().mockReturnValue({
        lastFetch: Date.now(),
        isStale: false,
        providerCount: 2,
        modelCount: 3,
    }),
    getProviderRegistry: vi.fn().mockResolvedValue({}),
} as any);

describe('LLMConfigService', () => {
    let service: LLMConfigService;
    let mockModelRegistry: ModelRegistry;

    beforeEach(() => {
        vi.clearAllMocks();
        mockConfigs = [];
        mockModelRegistry = createMockModelRegistry();

        // Mock createLLMConfig
        vi.spyOn(llmConfigDb, 'createLLMConfig').mockImplementation((db, input) => {
            const record = {
                id: mockConfigs.length + 1,
                name: input.name,
                model: input.model,
                providerId: input.providerId,
                baseUrl: input.baseUrl,
                apiKey: input.apiKey,
                temperature: input.temperature ?? 0.7,
                maxSteps: input.maxSteps ?? 10,
                isActive: mockConfigs.length === 0,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };
            mockConfigs.push(record);
            return record;
        });

        // Mock getAllLLMConfigs
        vi.spyOn(llmConfigDb, 'getAllLLMConfigs').mockImplementation(() => mockConfigs);

        // Mock getActiveLLMConfig
        vi.spyOn(llmConfigDb, 'getActiveLLMConfig').mockImplementation(() => {
            return mockConfigs.find(c => c.isActive) || null;
        });

        // Mock getLLMConfig
        vi.spyOn(llmConfigDb, 'getLLMConfig').mockImplementation((db, id) => {
            return mockConfigs.find(c => c.id === id) || null;
        });

        // Mock setActiveLLMConfig
        vi.spyOn(llmConfigDb, 'setActiveLLMConfig').mockImplementation((db, id) => {
            mockConfigs.forEach(c => c.isActive = false);
            const config = mockConfigs.find(c => c.id === id);
            if (config) config.isActive = true;
        });

        // Mock updateLLMConfig
        vi.spyOn(llmConfigDb, 'updateLLMConfig').mockImplementation((db, id, updates) => {
            const config = mockConfigs.find(c => c.id === id);
            if (config) {
                Object.assign(config, updates);
                config.updatedAt = Date.now();
            }
        });

        // Mock deleteLLMConfig
        vi.spyOn(llmConfigDb, 'deleteLLMConfig').mockImplementation((db, id) => {
            const index = mockConfigs.findIndex(c => c.id === id);
            if (index !== -1) mockConfigs.splice(index, 1);
        });

        service = new LLMConfigService(mockModelRegistry);
    });

    describe('createConfig', () => {
        it('should create new config', async () => {
            const input: LLMConfigInput = {
                name: 'OpenAI GPT-4',
                model: 'gpt-4',
                providerId: 'openai',
                apiKey: 'sk-test',
                temperature: 0.7,
                maxSteps: 10
            };

            const result = await service.createConfig(input);

            expect(result.id).toBe(1);
            expect(result.name).toBe('OpenAI GPT-4');
            expect(result.model).toBe('gpt-4');
            expect(result.isActive).toBe(true); // First config is auto-active
        });

        it('should set first config as active', async () => {
            const input: LLMConfigInput = {
                name: 'Config 1',
                model: 'gpt-4',
            };

            const result = await service.createConfig(input);

            expect(result.isActive).toBe(true);
        });

        it('should not set second config as active', async () => {
            await service.createConfig({ name: 'Config 1', model: 'gpt-4' });
            const result = await service.createConfig({ name: 'Config 2', model: 'claude-3' });

            expect(result.isActive).toBe(false);
        });

        it('should validate model when providerId is provided', async () => {
            const input: LLMConfigInput = {
                name: 'OpenAI GPT-4',
                model: 'gpt-4',
                providerId: 'openai',
            };

            await service.createConfig(input);

            expect(mockModelRegistry.getModels).toHaveBeenCalledWith({ providerId: 'openai' });
        });

        it('should throw error when model validation fails', async () => {
            const input: LLMConfigInput = {
                name: 'Invalid Model',
                model: 'invalid-model',
                providerId: 'openai',
            };

            await expect(service.createConfig(input)).rejects.toThrow(
                'Model "invalid-model" not found in provider "openai"'
            );
        });

        it('should skip validation when skipValidation is true', async () => {
            const input: LLMConfigInput = {
                name: 'Custom Model',
                model: 'custom-model',
                providerId: 'openai',
                skipValidation: true,
            };

            const result = await service.createConfig(input);

            expect(result.model).toBe('custom-model');
        });
    });

    describe('getActiveLLMConfig', () => {
        it('should return active config', () => {
            service.createConfig({
                name: 'Active Config',
                model: 'gpt-4',
                apiKey: 'sk-test'
            });

            const config = service.getActiveLLMConfig();

            expect(config).not.toBeNull();
            expect(config?.model).toBe('gpt-4');
            expect(config?.apiKey).toBe('sk-test');
        });

        it('should return null when no active config', () => {
            const config = service.getActiveLLMConfig();
            expect(config).toBeNull();
        });

        it('should convert to AgentDriverV2 LLMConfig format', () => {
            service.createConfig({
                name: 'OpenAI Config',
                model: 'gpt-4',
                providerId: 'openai',
                baseUrl: 'https://api.openai.com/v1',
                apiKey: 'sk-test',
                temperature: 0.8,
                maxSteps: 15
            });

            const config = service.getActiveLLMConfig();

            expect(config).toMatchObject({
                model: 'gpt-4',
                apiKey: 'sk-test',
                temperature: 0.8,
                maxSteps: 15,
                provider: {
                    id: 'openai',
                    baseURL: 'https://api.openai.com/v1'
                }
            });
        });
    });

    describe('getAllConfigs', () => {
        it('should return all configs', () => {
            service.createConfig({ name: 'Config 1', model: 'gpt-4' });
            service.createConfig({ name: 'Config 2', model: 'claude-3' });

            const configs = service.getAllConfigs();

            expect(configs.length).toBe(2);
        });

        it('should return empty array when no configs', () => {
            const configs = service.getAllConfigs();
            expect(configs).toEqual([]);
        });
    });

    describe('setActiveConfig', () => {
        it('should set config as active', () => {
            const config1 = service.createConfig({ name: 'Config 1', model: 'gpt-4' });
            const config2 = service.createConfig({ name: 'Config 2', model: 'claude-3' });

            service.setActiveConfig(config2.id);

            const activeRecord = service.getActiveLLMConfigRecord();
            expect(activeRecord?.id).toBe(config2.id);
        });

        it('should deactivate previous active config', () => {
            const config1 = service.createConfig({ name: 'Config 1', model: 'gpt-4' });
            const config2 = service.createConfig({ name: 'Config 2', model: 'claude-3' });

            service.setActiveConfig(config2.id);

            const allConfigs = service.getAllConfigs();
            const prevActive = allConfigs.find(c => c.id === config1.id);

            expect(prevActive?.isActive).toBe(false);
        });
    });

    describe('updateConfig', () => {
        it('should update config', () => {
            const config = service.createConfig({
                name: 'Original',
                model: 'gpt-4'
            });

            service.updateConfig(config.id, {
                name: 'Updated',
                temperature: 0.9
            });

            const updated = service.getConfig(config.id);
            expect(updated?.name).toBe('Updated');
            expect(updated?.temperature).toBe(0.9);
        });
    });

    describe('deleteConfig', () => {
        it('should delete config', () => {
            const config = service.createConfig({ name: 'To Delete', model: 'gpt-4' });
            const config2 = service.createConfig({ name: 'Keep', model: 'claude-3' });

            service.setActiveConfig(config2.id); // Make config2 active
            service.deleteConfig(config.id);

            const allConfigs = service.getAllConfigs();
            expect(allConfigs.length).toBe(1);
            expect(allConfigs[0].name).toBe('Keep');
        });

        it('should allow deleting active config and clear active state', () => {
            const config = service.createConfig({ name: 'Active', model: 'gpt-4' });

            // Should not throw error
            expect(() => service.deleteConfig(config.id)).not.toThrow();

            // Config should be deleted
            const allConfigs = service.getAllConfigs();
            expect(allConfigs.length).toBe(0);
        });
    });

    describe('getAvailableProviders', () => {
        it('should return provider list', async () => {
            const providers = await service.getAvailableProviders();

            expect(providers.length).toBeGreaterThan(0);
            expect(providers.some(p => p.id === 'openai')).toBe(true);
            expect(providers.some(p => p.id === 'anthropic')).toBe(true);
        });
    });
});
