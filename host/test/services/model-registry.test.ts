/**
 * @aotui/host - ModelRegistry Service Unit Tests
 * 
 * 测试 ModelRegistry 服务的核心功能：
 * - models.dev API 成功响应
 * - API 失败时的降级行为（使用缓存或默认配置）
 * - 缓存机制（保存、加载、TTL）
 * - Provider 查询和过滤
 * - 模型查询和过滤
 * 
 * Requirements: 8.1, 8.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ModelRegistry } from '../../src/services/model-registry.js';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

// Mock fs module
vi.mock('fs/promises');

describe('ModelRegistry Service', () => {
    let registry: ModelRegistry;
    const mockCacheDir = path.join(os.homedir(), '.aotui', 'cache');
    const mockCacheFile = path.join(mockCacheDir, 'models-dev.json');

    // Sample models.dev API response
    const mockModelsDevData = {
        openai: {
            id: 'openai',
            name: 'OpenAI',
            env: ['OPENAI_API_KEY'],
            npm: '@ai-sdk/openai',
            api: 'https://api.openai.com/v1',
            doc: 'https://platform.openai.com/docs',
            models: {
                'gpt-4o': {
                    id: 'openai/gpt-4o',
                    name: 'GPT-4o',
                    family: 'gpt-4',
                    tool_call: true,
                    reasoning: false,
                    cost: {
                        input: 2.5,
                        output: 10,
                    },
                    limit: {
                        context: 128000,
                        output: 16384,
                    },
                },
                'gpt-4o-mini': {
                    id: 'openai/gpt-4o-mini',
                    name: 'GPT-4o Mini',
                    family: 'gpt-4',
                    tool_call: true,
                    reasoning: false,
                    cost: {
                        input: 0.15,
                        output: 0.6,
                    },
                    limit: {
                        context: 128000,
                        output: 16384,
                    },
                },
            },
        },
        anthropic: {
            id: 'anthropic',
            name: 'Anthropic',
            env: ['ANTHROPIC_API_KEY'],
            npm: '@ai-sdk/anthropic',
            api: 'https://api.anthropic.com/v1',
            doc: 'https://docs.anthropic.com',
            models: {
                'claude-3-5-sonnet-20241022': {
                    id: 'anthropic/claude-3-5-sonnet-20241022',
                    name: 'Claude 3.5 Sonnet',
                    family: 'claude-3.5',
                    tool_call: true,
                    reasoning: false,
                    cost: {
                        input: 3,
                        output: 15,
                    },
                    limit: {
                        context: 200000,
                        output: 8192,
                    },
                },
                'claude-3-opus-20240229': {
                    id: 'anthropic/claude-3-opus-20240229',
                    name: 'Claude 3 Opus',
                    family: 'claude-3',
                    tool_call: true,
                    reasoning: true,
                    cost: {
                        input: 15,
                        output: 75,
                    },
                    limit: {
                        context: 200000,
                        output: 4096,
                    },
                },
            },
        },
        google: {
            id: 'google',
            name: 'Google',
            env: ['GOOGLE_GENERATIVE_AI_API_KEY'],
            npm: '@ai-sdk/google',
            api: 'https://generativelanguage.googleapis.com/v1beta',
            doc: 'https://ai.google.dev/docs',
            models: {
                'gemini-2.0-flash-exp': {
                    id: 'google/gemini-2.0-flash-exp',
                    name: 'Gemini 2.0 Flash',
                    family: 'gemini-2.0',
                    tool_call: true,
                    reasoning: false,
                    modalities: {
                        input: ['text', 'image', 'video'],
                        output: ['text'],
                    },
                    cost: {
                        input: 0,
                        output: 0,
                    },
                    limit: {
                        context: 1000000,
                        output: 8192,
                    },
                },
            },
        },
    };

    beforeEach(() => {
        registry = new ModelRegistry();
        vi.clearAllMocks();
        
        // Default mock for fs operations
        vi.mocked(fs.mkdir).mockResolvedValue(undefined);
        vi.mocked(fs.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('models.dev API Success', () => {
        it('should fetch data from models.dev API successfully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });

            const providers = await registry.getProviders();

            expect(mockFetch).toHaveBeenCalledWith(
                'https://models.dev/api.json',
                expect.objectContaining({
                    signal: expect.any(AbortSignal),
                })
            );
            expect(providers).toHaveLength(3);
            expect(providers[0].id).toBe('openai');
            expect(providers[1].id).toBe('anthropic');
            expect(providers[2].id).toBe('google');
        });

        it('should return correct provider information', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });

            const providers = await registry.getProviders();

            expect(providers[0]).toEqual({
                id: 'openai',
                name: 'OpenAI',
                baseURL: 'https://api.openai.com/v1',
                modelCount: 2,
            });
        });

        it('should save fetched data to cache', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });

            await registry.getProviders();

            expect(fs.mkdir).toHaveBeenCalledWith(mockCacheDir, { recursive: true });
            expect(fs.writeFile).toHaveBeenCalledWith(
                mockCacheFile,
                expect.stringContaining('"openai"'),
                'utf-8'
            );
        });

        it('should parse models correctly', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });

            const models = await registry.getModels();

            expect(models).toHaveLength(5); // 2 OpenAI + 2 Anthropic + 1 Google
            expect(models.some(m => m.id === 'openai/gpt-4o')).toBe(true);
            expect(models.some(m => m.id === 'anthropic/claude-3-5-sonnet-20241022')).toBe(true);
        });
    });

    describe('API Failure - Fallback Behavior', () => {
        it('should use cached data when API fails', async () => {
            // Mock cache file exists
            const cachedData = {
                data: mockModelsDevData,
                timestamp: Date.now(),
            };
            vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(cachedData));

            // Mock API failure
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const providers = await registry.getProviders();

            expect(providers).toHaveLength(3);
            expect(providers[0].id).toBe('openai');
        });

        it('should use default providers when API fails and no cache exists', async () => {
            // Mock cache file doesn't exist
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('File not found'));

            // Mock API failure
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const providers = await registry.getProviders();

            // Should return default providers
            expect(providers.length).toBeGreaterThan(0);
            expect(providers.some(p => p.id === 'openai')).toBe(true);
            expect(providers.some(p => p.id === 'anthropic')).toBe(true);
        });

        it('should handle HTTP error responses', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                statusText: 'Internal Server Error',
            });

            // Mock cache exists
            const cachedData = {
                data: mockModelsDevData,
                timestamp: Date.now(),
            };
            vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(cachedData));

            const providers = await registry.getProviders();

            expect(providers).toHaveLength(3);
        });

        it('should handle timeout errors', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Timeout'));

            // Mock cache exists
            const cachedData = {
                data: mockModelsDevData,
                timestamp: Date.now(),
            };
            vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(cachedData));

            const providers = await registry.getProviders();

            expect(providers).toHaveLength(3);
        });

        it('should handle malformed JSON response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => {
                    throw new Error('Invalid JSON');
                },
            });

            // Mock cache exists
            const cachedData = {
                data: mockModelsDevData,
                timestamp: Date.now(),
            };
            vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(cachedData));

            const providers = await registry.getProviders();

            expect(providers).toHaveLength(3);
        });
    });

    describe('Cache Mechanism', () => {
        it('should load data from cache within TTL', async () => {
            const cachedData = {
                data: mockModelsDevData,
                timestamp: Date.now() - 1000 * 60 * 60, // 1 hour ago
            };
            vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(cachedData));

            // Mock API failure to force cache usage
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const providers = await registry.getProviders();

            expect(providers).toHaveLength(3);
            expect(fs.readFile).toHaveBeenCalledWith(mockCacheFile, 'utf-8');
        });

        it('should refresh data when cache is stale (> 24 hours)', async () => {
            const staleCachedData = {
                data: mockModelsDevData,
                timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
            };
            vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(staleCachedData));

            // Mock successful API call
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });

            const providers = await registry.getProviders();

            expect(mockFetch).toHaveBeenCalled();
            expect(providers).toHaveLength(3);
        });

        it('should save cache with correct structure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });

            await registry.getProviders();

            expect(fs.writeFile).toHaveBeenCalledWith(
                mockCacheFile,
                expect.any(String),
                'utf-8'
            );

            const savedData = JSON.parse(
                vi.mocked(fs.writeFile).mock.calls[0][1] as string
            );
            expect(savedData).toHaveProperty('data');
            expect(savedData).toHaveProperty('timestamp');
            expect(savedData.data).toEqual(mockModelsDevData);
        });

        it('should handle cache read errors gracefully', async () => {
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('Permission denied'));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });

            const providers = await registry.getProviders();

            expect(providers).toHaveLength(3);
        });

        it('should handle cache write errors gracefully', async () => {
            vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error('Disk full'));

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });

            // Should not throw, just log error
            const providers = await registry.getProviders();

            expect(providers).toHaveLength(3);
        });

        it('should handle corrupted cache file', async () => {
            vi.mocked(fs.readFile).mockResolvedValueOnce('invalid json {{{');

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });

            const providers = await registry.getProviders();

            expect(providers).toHaveLength(3);
        });
    });

    describe('Provider Queries', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });
            await registry.getProviders(); // Initialize data
        });

        it('should return all providers', async () => {
            const providers = await registry.getProviders();

            expect(providers).toHaveLength(3);
            expect(providers.map(p => p.id)).toEqual(['openai', 'anthropic', 'google']);
        });

        it('should return provider with model count', async () => {
            const providers = await registry.getProviders();

            const openai = providers.find(p => p.id === 'openai');
            expect(openai?.modelCount).toBe(2);

            const anthropic = providers.find(p => p.id === 'anthropic');
            expect(anthropic?.modelCount).toBe(2);
        });

        it('should get specific provider config', async () => {
            const config = await registry.getProviderConfig('openai');

            expect(config).toEqual({
                id: 'openai',
                name: 'OpenAI',
                baseURL: 'https://api.openai.com/v1',
                envKeys: ['OPENAI_API_KEY'],
                supportedModels: ['gpt-4o', 'gpt-4o-mini'],
            });
        });

        it('should throw error for non-existent provider', async () => {
            await expect(
                registry.getProviderConfig('nonexistent')
            ).rejects.toThrow('Provider not found in models.dev: nonexistent');
        });

        it('should return provider with correct baseURL', async () => {
            const providers = await registry.getProviders();

            const openai = providers.find(p => p.id === 'openai');
            expect(openai?.baseURL).toBe('https://api.openai.com/v1');
        });
    });

    describe('Model Queries and Filtering', () => {
        beforeEach(async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });
            await registry.getProviders(); // Initialize data
        });

        it('should return all models without filter', async () => {
            const models = await registry.getModels();

            expect(models).toHaveLength(5);
            expect(models.map(m => m.id)).toContain('openai/gpt-4o');
            expect(models.map(m => m.id)).toContain('anthropic/claude-3-5-sonnet-20241022');
        });

        it('should filter models by providerId', async () => {
            const models = await registry.getModels({ providerId: 'openai' });

            expect(models).toHaveLength(2);
            expect(models.every(m => m.id.startsWith('openai/'))).toBe(true);
            expect(models.map(m => m.id)).toEqual(['openai/gpt-4o', 'openai/gpt-4o-mini']);
        });

        it('should only return models from the specified provider', async () => {
            // Test with anthropic provider
            const anthropicModels = await registry.getModels({ providerId: 'anthropic' });

            expect(anthropicModels).toHaveLength(2);
            expect(anthropicModels.every(m => m.id.startsWith('anthropic/'))).toBe(true);
            
            // Ensure no models from other providers are included
            expect(anthropicModels.some(m => m.id.startsWith('openai/'))).toBe(false);
            expect(anthropicModels.some(m => m.id.startsWith('google/'))).toBe(false);
        });

        it('should return empty array for non-existent provider', async () => {
            const models = await registry.getModels({ providerId: 'nonexistent' });

            expect(models).toHaveLength(0);
        });

        it('should filter models by tool_call capability', async () => {
            const models = await registry.getModels({ capability: 'tool_call' });

            expect(models.length).toBeGreaterThan(0);
            expect(models.every(m => m.tool_call === true)).toBe(true);
        });

        it('should filter models by reasoning capability', async () => {
            const models = await registry.getModels({ capability: 'reasoning' });

            expect(models.length).toBeGreaterThan(0);
            expect(models.every(m => m.reasoning === true)).toBe(true);
            expect(models.some(m => m.id === 'anthropic/claude-3-opus-20240229')).toBe(true);
        });

        it('should filter models by vision capability', async () => {
            const models = await registry.getModels({ capability: 'vision' });

            expect(models.length).toBeGreaterThan(0);
            expect(models.every(m => m.modalities?.input?.includes('image'))).toBe(true);
            expect(models.some(m => m.id === 'google/gemini-2.0-flash-exp')).toBe(true);
        });

        it('should filter models by maxInputCost', async () => {
            const models = await registry.getModels({ maxInputCost: 1 });

            expect(models.length).toBeGreaterThan(0);
            expect(models.every(m => (m.cost?.input ?? Infinity) <= 1)).toBe(true);
            expect(models.some(m => m.id === 'openai/gpt-4o-mini')).toBe(true);
        });

        it('should combine multiple filters', async () => {
            const models = await registry.getModels({
                providerId: 'openai',
                capability: 'tool_call',
                maxInputCost: 1,
            });

            expect(models).toHaveLength(1);
            expect(models[0].id).toBe('openai/gpt-4o-mini');
        });

        it('should return empty array when no models match filter', async () => {
            const models = await registry.getModels({
                providerId: 'openai',
                maxInputCost: 0.01,
            });

            expect(models).toHaveLength(0);
        });

        it('should handle models without cost information', async () => {
            const models = await registry.getModels({ maxInputCost: 10 });

            // Google model has 0 cost, should be included
            expect(models.some(m => m.id === 'google/gemini-2.0-flash-exp')).toBe(true);
        });
    });

    describe('Cache Status', () => {
        it('should return correct cache status after fetch', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });

            await registry.getProviders();

            const status = registry.getCacheStatus();

            expect(status.lastFetch).toBeGreaterThan(0);
            expect(status.isStale).toBe(false);
            expect(status.providerCount).toBe(3);
            expect(status.modelCount).toBe(5);
        });

        it('should indicate stale cache after TTL', async () => {
            // Mock old cached data
            const oldCachedData = {
                data: mockModelsDevData,
                timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
            };
            vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(oldCachedData));

            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            await registry.getProviders();

            const status = registry.getCacheStatus();

            expect(status.isStale).toBe(true);
        });

        it('should return zero counts when no data', async () => {
            const status = registry.getCacheStatus();

            expect(status.lastFetch).toBe(0);
            expect(status.isStale).toBe(true);
            expect(status.providerCount).toBe(0);
            expect(status.modelCount).toBe(0);
        });
    });

    describe('Refresh Functionality', () => {
        it('should force refresh data', async () => {
            // Initial fetch
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });

            await registry.getProviders();

            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Refresh should fetch again
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });

            await registry.refresh();

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should clear provider registry on refresh', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });

            await registry.getProviderRegistry();

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });

            await registry.refresh();

            // Provider registry should be recreated
            const newRegistry = await registry.getProviderRegistry();
            expect(newRegistry).toBeDefined();
        });

        it('should handle refresh errors gracefully', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockModelsDevData,
            });

            await registry.getProviders();

            // Refresh fails
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            // Should use default providers (fallback)
            await registry.refresh();

            const providers = await registry.getProviders();
            expect(providers.length).toBeGreaterThan(0); // Should have default providers
        });
    });

    describe('Default Provider Configuration', () => {
        it('should have default providers for major LLM services', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('No cache'));

            const providers = await registry.getProviders();

            expect(providers.some(p => p.id === 'openai')).toBe(true);
            expect(providers.some(p => p.id === 'anthropic')).toBe(true);
            expect(providers.some(p => p.id === 'google')).toBe(true);
            expect(providers.some(p => p.id === 'xai')).toBe(true);
        });

        it('should have default models for each provider', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('No cache'));

            const models = await registry.getModels();

            expect(models.length).toBeGreaterThan(0);
            expect(models.some(m => m.id.includes('gpt'))).toBe(true);
            expect(models.some(m => m.id.includes('claude'))).toBe(true);
        });

        it('should have cost information in default models', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));
            vi.mocked(fs.readFile).mockRejectedValueOnce(new Error('No cache'));

            const models = await registry.getModels();

            const modelWithCost = models.find(m => m.cost);
            expect(modelWithCost).toBeDefined();
            expect(modelWithCost?.cost?.input).toBeDefined();
            expect(modelWithCost?.cost?.output).toBeDefined();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty models.dev response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({}),
            });

            const providers = await registry.getProviders();

            expect(providers).toHaveLength(0);
        });

        it('should handle provider without models', async () => {
            const dataWithEmptyProvider = {
                empty: {
                    id: 'empty',
                    name: 'Empty Provider',
                    models: {},
                },
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => dataWithEmptyProvider,
            });

            const providers = await registry.getProviders();

            expect(providers).toHaveLength(1);
            expect(providers[0].modelCount).toBe(0);
        });

        it('should handle model without cost information', async () => {
            const dataWithNoCost = {
                test: {
                    id: 'test',
                    name: 'Test',
                    models: {
                        'test-model': {
                            id: 'test/test-model',
                            name: 'Test Model',
                        },
                    },
                },
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => dataWithNoCost,
            });

            const models = await registry.getModels();

            expect(models).toHaveLength(1);
            expect(models[0].cost).toBeUndefined();
        });

        it('should handle concurrent requests', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => mockModelsDevData,
            });

            // Make multiple concurrent requests
            const promises = [
                registry.getProviders(),
                registry.getModels(),
                registry.getProviderConfig('openai'),
            ];

            const results = await Promise.all(promises);

            expect(results[0]).toHaveLength(3); // providers
            expect(results[1]).toHaveLength(5); // models
            expect(results[2].id).toBe('openai'); // config
        });
    });
});
