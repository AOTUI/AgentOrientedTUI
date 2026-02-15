/**
 * @aotui/host - LLMConfigService Integration Tests
 * 
 * 测试 LLMConfigService 与 ModelRegistry 的集成
 * 
 * Requirements: 8.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LLMConfigService } from '../src/core/llm-config-service.js';
import { ModelRegistry } from '../src/services/model-registry.js';
import type { LLMConfigInput } from '../src/types/llm-config.js';
import * as llmConfigDb from '../src/db/llm-config-db.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

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

// Mock fetch for models.dev API
const mockModelsDevResponse = {
    anthropic: {
        id: 'anthropic',
        name: 'Anthropic',
        env: ['ANTHROPIC_API_KEY'],
        api: 'https://api.anthropic.com/v1',
        models: {
            'claude-3-5-sonnet-20241022': {
                id: 'anthropic/claude-3-5-sonnet-20241022',
                name: 'Claude 3.5 Sonnet',
                tool_call: true,
                reasoning: false,
                cost: { input: 3, output: 15 },
                limit: { context: 200000, output: 8192 },
            },
            'claude-3-5-haiku-20241022': {
                id: 'anthropic/claude-3-5-haiku-20241022',
                name: 'Claude 3.5 Haiku',
                tool_call: true,
                reasoning: false,
                cost: { input: 1, output: 5 },
                limit: { context: 200000, output: 8192 },
            },
        },
    },
    openai: {
        id: 'openai',
        name: 'OpenAI',
        env: ['OPENAI_API_KEY'],
        api: 'https://api.openai.com/v1',
        models: {
            'gpt-4o': {
                id: 'openai/gpt-4o',
                name: 'GPT-4o',
                tool_call: true,
                reasoning: false,
                cost: { input: 2.5, output: 10 },
                limit: { context: 128000, output: 16384 },
            },
            'o1': {
                id: 'openai/o1',
                name: 'OpenAI o1',
                tool_call: true,
                reasoning: true,
                cost: { input: 15, output: 60 },
                limit: { context: 200000, output: 100000 },
            },
        },
    },
};

describe('LLMConfigService Integration Tests', () => {
    let service: LLMConfigService;
    let modelRegistry: ModelRegistry;
    let cacheDir: string;
    let cacheFile: string;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockConfigs = [];

        // Setup cache directory
        cacheDir = path.join(os.homedir(), '.aotui', 'cache');
        cacheFile = path.join(cacheDir, 'models-dev.json');

        // Mock database operations
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

        vi.spyOn(llmConfigDb, 'getAllLLMConfigs').mockImplementation(() => mockConfigs);
        vi.spyOn(llmConfigDb, 'getActiveLLMConfig').mockImplementation(() => {
            return mockConfigs.find(c => c.isActive) || null;
        });
        vi.spyOn(llmConfigDb, 'getLLMConfig').mockImplementation((db, id) => {
            return mockConfigs.find(c => c.id === id) || null;
        });

        // Mock fetch for models.dev API
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => mockModelsDevResponse,
        } as any);

        // Create real ModelRegistry instance
        modelRegistry = new ModelRegistry();
        service = new LLMConfigService(modelRegistry);
    });

    afterEach(async () => {
        // Clean up cache file
        try {
            await fs.unlink(cacheFile);
        } catch (error) {
            // Ignore if file doesn't exist
        }
    });

    describe('Configuration Validation with ModelRegistry', () => {
        it('should validate model exists in ModelRegistry', async () => {
            const input: LLMConfigInput = {
                name: 'Claude Config',
                model: 'claude-3-5-sonnet-20241022',
                providerId: 'anthropic',
                apiKey: 'sk-test',
            };

            const result = await service.createConfig(input);

            expect(result.model).toBe('claude-3-5-sonnet-20241022');
            expect(result.providerId).toBe('anthropic');
        });

        it('should reject invalid model from ModelRegistry', async () => {
            const input: LLMConfigInput = {
                name: 'Invalid Model',
                model: 'invalid-model-xyz',
                providerId: 'anthropic',
                apiKey: 'sk-test',
            };

            await expect(service.createConfig(input)).rejects.toThrow(
                'Model "invalid-model-xyz" not found in provider "anthropic"'
            );
        });

        it('should allow custom model with skipValidation', async () => {
            const input: LLMConfigInput = {
                name: 'Custom Model',
                model: 'my-custom-model',
                providerId: 'anthropic',
                apiKey: 'sk-test',
                skipValidation: true,
            };

            const result = await service.createConfig(input);

            expect(result.model).toBe('my-custom-model');
        });

        it('should validate model with full ID format', async () => {
            const input: LLMConfigInput = {
                name: 'GPT-4o Config',
                model: 'gpt-4o',
                providerId: 'openai',
                apiKey: 'sk-test',
            };

            const result = await service.createConfig(input);

            expect(result.model).toBe('gpt-4o');
        });
    });

    describe('Recommended Configuration Generation', () => {
        it('should recommend lower temperature for reasoning models', async () => {
            const config = await service.getModelRecommendedConfig('openai', 'o1');

            expect(config.temperature).toBe(0.5);
            expect(config.maxSteps).toBe(20);
        });

        it('should recommend standard config for tool-calling models', async () => {
            const config = await service.getModelRecommendedConfig('openai', 'gpt-4o');

            expect(config.temperature).toBe(0.7);
            expect(config.maxSteps).toBe(10);
        });

        it('should return default config for unknown models', async () => {
            const config = await service.getModelRecommendedConfig('openai', 'unknown-model');

            expect(config.temperature).toBe(0.7);
            expect(config.maxSteps).toBe(10);
        });

        it('should handle reasoning models from different providers', async () => {
            // Add a reasoning model to anthropic
            const modifiedResponse = {
                ...mockModelsDevResponse,
                anthropic: {
                    ...mockModelsDevResponse.anthropic,
                    models: {
                        ...mockModelsDevResponse.anthropic.models,
                        'claude-3-opus-reasoning': {
                            id: 'anthropic/claude-3-opus-reasoning',
                            name: 'Claude 3 Opus Reasoning',
                            tool_call: true,
                            reasoning: true,
                            cost: { input: 15, output: 75 },
                            limit: { context: 200000, output: 8192 },
                        },
                    },
                },
            };

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => modifiedResponse,
            } as any);

            // Create new registry to pick up the modified response
            const newRegistry = new ModelRegistry();
            const newService = new LLMConfigService(newRegistry);

            const config = await newService.getModelRecommendedConfig(
                'anthropic',
                'claude-3-opus-reasoning'
            );

            expect(config.temperature).toBe(0.5);
            expect(config.maxSteps).toBe(20);
        });
    });

    describe('Error Handling', () => {
        it('should handle ModelRegistry API failure gracefully', async () => {
            // Mock fetch to fail
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            // Create new registry that will use fallback
            const newRegistry = new ModelRegistry();
            const newService = new LLMConfigService(newRegistry);

            // Should still work with default providers
            const input: LLMConfigInput = {
                name: 'Fallback Config',
                model: 'claude-3-5-sonnet-20241022',
                providerId: 'anthropic',
                apiKey: 'sk-test',
            };

            const result = await newService.createConfig(input);

            expect(result.model).toBe('claude-3-5-sonnet-20241022');
        });

        it('should handle validation errors without crashing', async () => {
            // Mock getModels to throw error
            vi.spyOn(modelRegistry, 'getModels').mockRejectedValue(
                new Error('Registry error')
            );

            const input: LLMConfigInput = {
                name: 'Error Test',
                model: 'gpt-4o',
                providerId: 'openai',
                apiKey: 'sk-test',
            };

            // Should reject because validation failed
            await expect(service.createConfig(input)).rejects.toThrow(
                'Model "gpt-4o" not found in provider "openai"'
            );
        });

        it('should handle getModelRecommendedConfig errors gracefully', async () => {
            // Mock getModels to throw error
            vi.spyOn(modelRegistry, 'getModels').mockRejectedValue(
                new Error('Registry error')
            );

            const config = await service.getModelRecommendedConfig('openai', 'gpt-4o');

            // Should return default config
            expect(config.temperature).toBe(0.7);
            expect(config.maxSteps).toBe(10);
        });
    });

    describe('Cache Integration', () => {
        it('should use cached data after first fetch', async () => {
            // First call - fetches from API
            await service.validateModel('openai', 'gpt-4o');

            expect(global.fetch).toHaveBeenCalledTimes(1);

            // Second call - uses cache
            await service.validateModel('openai', 'gpt-4o');

            // Should still be 1 because cache is used
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should persist cache to filesystem', async () => {
            await service.validateModel('openai', 'gpt-4o');

            // Wait a bit for async file write
            await new Promise(resolve => setTimeout(resolve, 100));

            // Check if cache file exists
            const cacheExists = await fs
                .access(cacheFile)
                .then(() => true)
                .catch(() => false);

            expect(cacheExists).toBe(true);
        });

        it('should load from cache on subsequent registry creation', async () => {
            // First registry - fetches and caches
            await service.validateModel('openai', 'gpt-4o');

            // Wait for cache to be written
            await new Promise(resolve => setTimeout(resolve, 100));

            // Mock fetch to fail - this will force cache usage
            global.fetch = vi.fn().mockRejectedValue(new Error('Network unavailable'));

            // Create new registry - should load from cache when fetch fails
            const newRegistry = new ModelRegistry();
            const newService = new LLMConfigService(newRegistry);

            const isValid = await newService.validateModel('openai', 'gpt-4o');

            // Should successfully validate using cached data
            expect(isValid).toBe(true);
        });
    });

    describe('Provider Filtering', () => {
        it('should validate models only from specified provider', async () => {
            const isValidOpenAI = await service.validateModel('openai', 'gpt-4o');
            const isValidAnthropic = await service.validateModel(
                'anthropic',
                'claude-3-5-sonnet-20241022'
            );

            expect(isValidOpenAI).toBe(true);
            expect(isValidAnthropic).toBe(true);
        });

        it('should reject model from wrong provider', async () => {
            // Try to validate OpenAI model as Anthropic
            const isValid = await service.validateModel('anthropic', 'gpt-4o');

            expect(isValid).toBe(false);
        });

        it('should get recommended config for specific provider models', async () => {
            const openaiConfig = await service.getModelRecommendedConfig('openai', 'o1');
            const anthropicConfig = await service.getModelRecommendedConfig(
                'anthropic',
                'claude-3-5-sonnet-20241022'
            );

            expect(openaiConfig.temperature).toBe(0.5); // reasoning model
            expect(anthropicConfig.temperature).toBe(0.7); // standard model
        });
    });

    describe('Model Capabilities', () => {
        it('should identify tool-calling models', async () => {
            const models = await modelRegistry.getModels({ capability: 'tool_call' });

            expect(models.length).toBeGreaterThan(0);
            expect(models.every(m => m.tool_call === true)).toBe(true);
        });

        it('should identify reasoning models', async () => {
            const models = await modelRegistry.getModels({ capability: 'reasoning' });

            expect(models.length).toBeGreaterThan(0);
            expect(models.every(m => m.reasoning === true)).toBe(true);
        });

        it('should recommend appropriate config based on capabilities', async () => {
            // Get all reasoning models
            const reasoningModels = await modelRegistry.getModels({ capability: 'reasoning' });

            for (const model of reasoningModels) {
                const [providerId, modelId] = model.id.split('/');
                const config = await service.getModelRecommendedConfig(providerId, modelId);

                expect(config.temperature).toBe(0.5);
                expect(config.maxSteps).toBe(20);
            }
        });
    });

    describe('End-to-End Configuration Flow', () => {
        it('should create valid config with ModelRegistry validation', async () => {
            const input: LLMConfigInput = {
                name: 'Production Config',
                model: 'claude-3-5-sonnet-20241022',
                providerId: 'anthropic',
                apiKey: 'sk-prod-key',
                temperature: 0.8,
                maxSteps: 15,
            };

            const config = await service.createConfig(input);

            expect(config.id).toBeDefined();
            expect(config.name).toBe('Production Config');
            expect(config.model).toBe('claude-3-5-sonnet-20241022');
            expect(config.providerId).toBe('anthropic');
            expect(config.temperature).toBe(0.8);
            expect(config.maxSteps).toBe(15);
        });

        it('should use recommended config when creating new config', async () => {
            const recommendedConfig = await service.getModelRecommendedConfig('openai', 'o1');

            const input: LLMConfigInput = {
                name: 'Reasoning Config',
                model: 'o1',
                providerId: 'openai',
                apiKey: 'sk-test',
                temperature: recommendedConfig.temperature,
                maxSteps: recommendedConfig.maxSteps,
            };

            const config = await service.createConfig(input);

            expect(config.temperature).toBe(0.5);
            expect(config.maxSteps).toBe(20);
        });

        it('should validate and create multiple configs', async () => {
            const configs = [
                {
                    name: 'OpenAI Config',
                    model: 'gpt-4o',
                    providerId: 'openai',
                    apiKey: 'sk-openai',
                },
                {
                    name: 'Anthropic Config',
                    model: 'claude-3-5-sonnet-20241022',
                    providerId: 'anthropic',
                    apiKey: 'sk-anthropic',
                },
            ];

            for (const input of configs) {
                const result = await service.createConfig(input);
                expect(result.id).toBeDefined();
                expect(result.model).toBe(input.model);
            }

            expect(mockConfigs.length).toBe(2);
        });
    });
});
