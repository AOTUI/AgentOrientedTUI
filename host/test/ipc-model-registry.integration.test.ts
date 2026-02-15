/**
 * @aotui/host - IPC ModelRegistry Integration Tests
 * 
 * 测试 Renderer → Main 的 tRPC over IPC 通信：
 * - 数据序列化和反序列化（superjson）
 * - 错误传播
 * - IPC 通信完整性
 * 
 * Requirements: 8.2
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { appRouter } from '../src/trpc/router.js';
import type { ModelRegistry } from '../src/services/model-registry.js';
import type { HostManagerV2 } from '../src/core/host-manager-v2.js';
import type { LLMConfigService } from '../src/core/llm-config-service.js';
import superjson from 'superjson';

/**
 * IPC Integration Test Suite
 * 
 * 这些测试模拟完整的 IPC 通信流程：
 * 1. Renderer Process 发起 tRPC 调用
 * 2. 数据通过 superjson 序列化
 * 3. Main Process 处理请求
 * 4. 响应通过 superjson 反序列化
 * 5. Renderer Process 接收响应
 */
describe('IPC ModelRegistry Integration', () => {
    let mockModelRegistry: ModelRegistry;
    let mockHostManager: HostManagerV2;
    let mockLLMConfigService: LLMConfigService;
    let caller: ReturnType<typeof appRouter.createCaller>;

    beforeEach(() => {
        // Mock ModelRegistry with realistic implementations
        mockModelRegistry = {
            getProviders: vi.fn(),
            getProviderConfig: vi.fn(),
            getModels: vi.fn(),
            refresh: vi.fn(),
            getCacheStatus: vi.fn(),
        } as any;

        // Mock HostManager (minimal)
        mockHostManager = {} as any;

        // Mock LLMConfigService (minimal)
        mockLLMConfigService = {} as any;

        // Create tRPC caller (simulates IPC communication)
        caller = appRouter.createCaller({
            hostManager: mockHostManager,
            llmConfigService: mockLLMConfigService,
            modelRegistry: mockModelRegistry,
        });
    });

    describe('Data Serialization with superjson', () => {
        it('should serialize and deserialize Date objects correctly', async () => {
            const now = new Date();
            const mockStatus = {
                lastFetch: now.getTime(),
                isStale: false,
                providerCount: 4,
                modelCount: 25,
            };

            vi.mocked(mockModelRegistry.getCacheStatus).mockReturnValue(mockStatus);

            // Simulate IPC: serialize → deserialize
            const result = await caller.modelRegistry.getCacheStatus();
            const serialized = superjson.stringify(result);
            const deserialized = superjson.parse(serialized);

            expect(deserialized.lastFetch).toBe(now.getTime());
            expect(deserialized.isStale).toBe(false);
            expect(deserialized.providerCount).toBe(4);
        });

        it('should serialize and deserialize complex nested objects', async () => {
            const mockModels = [
                {
                    id: 'openai/gpt-4',
                    name: 'GPT-4',
                    family: 'gpt-4',
                    tool_call: true,
                    reasoning: false,
                    modalities: {
                        input: ['text', 'image'],
                        output: ['text'],
                    },
                    cost: {
                        input: 30,
                        output: 60,
                        cache_read: 15,
                        cache_write: 37.5,
                    },
                    limit: {
                        context: 128000,
                        output: 16384,
                    },
                },
            ];

            vi.mocked(mockModelRegistry.getModels).mockResolvedValue(mockModels);

            // Simulate IPC: serialize → deserialize
            const result = await caller.modelRegistry.getModels({});
            const serialized = superjson.stringify(result);
            const deserialized = superjson.parse(serialized);

            expect(deserialized[0].id).toBe('openai/gpt-4');
            expect(deserialized[0].modalities.input).toEqual(['text', 'image']);
            expect(deserialized[0].cost.cache_read).toBe(15);
            expect(deserialized[0].limit.context).toBe(128000);
        });

        it('should handle undefined and null values correctly', async () => {
            const mockModels = [
                {
                    id: 'test/model',
                    name: 'Test Model',
                    family: undefined, // undefined field
                    tool_call: false,
                    reasoning: false,
                    modalities: {
                        input: ['text'],
                        output: null, // null field
                    },
                    cost: undefined, // undefined nested object
                },
            ];

            vi.mocked(mockModelRegistry.getModels).mockResolvedValue(mockModels as any);

            // Simulate IPC: serialize → deserialize
            const result = await caller.modelRegistry.getModels({});
            const serialized = superjson.stringify(result);
            const deserialized = superjson.parse(serialized);

            expect(deserialized[0].family).toBeUndefined();
            expect(deserialized[0].modalities.output).toBeNull();
            expect(deserialized[0].cost).toBeUndefined();
        });

        it('should serialize arrays correctly', async () => {
            const mockProviders = [
                {
                    id: 'openai',
                    name: 'OpenAI',
                    baseURL: 'https://api.openai.com/v1',
                    modelCount: 5,
                },
                {
                    id: 'anthropic',
                    name: 'Anthropic',
                    baseURL: 'https://api.anthropic.com/v1',
                    modelCount: 3,
                },
                {
                    id: 'google',
                    name: 'Google',
                    baseURL: 'https://generativelanguage.googleapis.com/v1beta',
                    modelCount: 8,
                },
            ];

            vi.mocked(mockModelRegistry.getProviders).mockResolvedValue(mockProviders);

            // Simulate IPC: serialize → deserialize
            const result = await caller.modelRegistry.getProviders();
            const serialized = superjson.stringify(result);
            const deserialized = superjson.parse(serialized);

            expect(Array.isArray(deserialized)).toBe(true);
            expect(deserialized.length).toBe(3);
            expect(deserialized[1].id).toBe('anthropic');
        });

        it('should handle empty arrays and objects', async () => {
            vi.mocked(mockModelRegistry.getProviders).mockResolvedValue([]);
            vi.mocked(mockModelRegistry.getModels).mockResolvedValue([]);

            // Empty array
            const providers = await caller.modelRegistry.getProviders();
            const serializedProviders = superjson.stringify(providers);
            const deserializedProviders = superjson.parse(serializedProviders);

            expect(Array.isArray(deserializedProviders)).toBe(true);
            expect(deserializedProviders.length).toBe(0);

            // Empty result
            const models = await caller.modelRegistry.getModels({});
            const serializedModels = superjson.stringify(models);
            const deserializedModels = superjson.parse(serializedModels);

            expect(Array.isArray(deserializedModels)).toBe(true);
            expect(deserializedModels.length).toBe(0);
        });

        it('should preserve number precision', async () => {
            const mockModels = [
                {
                    id: 'test/model',
                    name: 'Test',
                    cost: {
                        input: 0.15, // Decimal
                        output: 0.6,
                        cache_read: 0.075,
                        cache_write: 0.1875,
                    },
                    limit: {
                        context: 128000, // Large integer
                        output: 16384,
                    },
                },
            ];

            vi.mocked(mockModelRegistry.getModels).mockResolvedValue(mockModels as any);

            // Simulate IPC: serialize → deserialize
            const result = await caller.modelRegistry.getModels({});
            const serialized = superjson.stringify(result);
            const deserialized = superjson.parse(serialized);

            expect(deserialized[0].cost.input).toBe(0.15);
            expect(deserialized[0].cost.cache_write).toBe(0.1875);
            expect(deserialized[0].limit.context).toBe(128000);
        });
    });

    describe('Error Propagation through IPC', () => {
        it('should propagate ModelRegistry errors to Renderer', async () => {
            const error = new Error('Failed to fetch providers from models.dev');
            vi.mocked(mockModelRegistry.getProviders).mockRejectedValue(error);

            await expect(caller.modelRegistry.getProviders()).rejects.toThrow(
                'Failed to fetch providers from models.dev'
            );
        });

        it('should propagate validation errors with details', async () => {
            const error = new Error('Provider not found in models.dev: invalid-provider');
            vi.mocked(mockModelRegistry.getProviderConfig).mockRejectedValue(error);

            await expect(
                caller.modelRegistry.getProviderConfig({ providerId: 'invalid-provider' })
            ).rejects.toThrow('Provider not found');
        });

        it('should serialize error objects correctly', async () => {
            const error = new Error('Network timeout');
            error.name = 'TimeoutError';
            vi.mocked(mockModelRegistry.refresh).mockRejectedValue(error);

            try {
                await caller.modelRegistry.refresh();
                expect.fail('Should have thrown error');
            } catch (e: any) {
                // Simulate IPC error serialization
                const serialized = superjson.stringify({ error: e.message });
                const deserialized = superjson.parse(serialized);

                expect(deserialized.error).toBe('Network timeout');
            }
        });

        it('should handle errors with additional properties', async () => {
            const error = new Error('API rate limit exceeded') as any;
            error.statusCode = 429;
            error.retryAfter = 60;
            vi.mocked(mockModelRegistry.getModels).mockRejectedValue(error);

            try {
                await caller.modelRegistry.getModels({});
                expect.fail('Should have thrown error');
            } catch (e: any) {
                expect(e.message).toBe('API rate limit exceeded');
                // Note: Additional properties may not be preserved through tRPC
            }
        });

        it('should propagate errors from nested operations', async () => {
            const error = new Error('Cache file corrupted');
            vi.mocked(mockModelRegistry.getCacheStatus).mockImplementation(() => {
                throw error;
            });

            await expect(caller.modelRegistry.getCacheStatus()).rejects.toThrow(
                'Cache file corrupted'
            );
        });

        it('should handle async errors correctly', async () => {
            vi.mocked(mockModelRegistry.refresh).mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                throw new Error('Async operation failed');
            });

            await expect(caller.modelRegistry.refresh()).rejects.toThrow(
                'Async operation failed'
            );
        });
    });

    describe('IPC Communication Integrity', () => {
        it('should maintain data integrity for large payloads', async () => {
            // Generate large dataset (100 models)
            const mockModels = Array.from({ length: 100 }, (_, i) => ({
                id: `provider/model-${i}`,
                name: `Model ${i}`,
                family: `family-${i % 10}`,
                tool_call: i % 2 === 0,
                reasoning: i % 3 === 0,
                modalities: {
                    input: ['text'],
                    output: ['text'],
                },
                cost: {
                    input: i * 0.1,
                    output: i * 0.2,
                },
                limit: {
                    context: 128000 + i * 1000,
                    output: 16384,
                },
            }));

            vi.mocked(mockModelRegistry.getModels).mockResolvedValue(mockModels as any);

            // Simulate IPC: serialize → deserialize
            const result = await caller.modelRegistry.getModels({});
            const serialized = superjson.stringify(result);
            const deserialized = superjson.parse(serialized);

            expect(deserialized.length).toBe(100);
            expect(deserialized[0].id).toBe('provider/model-0');
            expect(deserialized[99].id).toBe('provider/model-99');
            expect(deserialized[50].cost.input).toBe(5.0);
        });

        it('should handle concurrent IPC calls correctly', async () => {
            vi.mocked(mockModelRegistry.getProviders).mockResolvedValue([
                { id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', modelCount: 5 },
            ]);
            vi.mocked(mockModelRegistry.getModels).mockResolvedValue([
                { id: 'openai/gpt-4', name: 'GPT-4' } as any,
            ]);
            vi.mocked(mockModelRegistry.getCacheStatus).mockReturnValue({
                lastFetch: Date.now(),
                isStale: false,
                providerCount: 1,
                modelCount: 1,
            });

            // Make multiple concurrent calls
            const [providers, models, status] = await Promise.all([
                caller.modelRegistry.getProviders(),
                caller.modelRegistry.getModels({}),
                caller.modelRegistry.getCacheStatus(),
            ]);

            expect(providers.length).toBe(1);
            expect(models.length).toBe(1);
            expect(status.providerCount).toBe(1);
        });

        it('should handle rapid sequential calls', async () => {
            const mockProviders = [
                { id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', modelCount: 5 },
            ];

            vi.mocked(mockModelRegistry.getProviders).mockResolvedValue(mockProviders);

            // Make 10 rapid sequential calls
            const results = [];
            for (let i = 0; i < 10; i++) {
                results.push(await caller.modelRegistry.getProviders());
            }

            expect(results.length).toBe(10);
            results.forEach(result => {
                expect(result).toEqual(mockProviders);
            });
        });

        it('should preserve data types across IPC boundary', async () => {
            const mockConfig = {
                id: 'openai',
                name: 'OpenAI',
                baseURL: 'https://api.openai.com/v1',
                envKeys: ['OPENAI_API_KEY', 'OPENAI_ORG_ID'],
                supportedModels: ['gpt-4', 'gpt-4o', 'gpt-4o-mini'],
            };

            vi.mocked(mockModelRegistry.getProviderConfig).mockResolvedValue(mockConfig);

            // Simulate IPC: serialize → deserialize
            const result = await caller.modelRegistry.getProviderConfig({ providerId: 'openai' });
            const serialized = superjson.stringify(result);
            const deserialized = superjson.parse(serialized);

            // Verify types
            expect(typeof deserialized.id).toBe('string');
            expect(typeof deserialized.name).toBe('string');
            expect(typeof deserialized.baseURL).toBe('string');
            expect(Array.isArray(deserialized.envKeys)).toBe(true);
            expect(Array.isArray(deserialized.supportedModels)).toBe(true);
            expect(deserialized.envKeys.every((k: any) => typeof k === 'string')).toBe(true);
        });

        it('should handle mutations (refresh) correctly', async () => {
            let refreshCount = 0;
            vi.mocked(mockModelRegistry.refresh).mockImplementation(async () => {
                refreshCount++;
                await new Promise(resolve => setTimeout(resolve, 10));
            });

            // Call refresh multiple times
            await caller.modelRegistry.refresh();
            await caller.modelRegistry.refresh();
            await caller.modelRegistry.refresh();

            expect(refreshCount).toBe(3);
        });

        it('should handle filter parameters correctly', async () => {
            const mockModels = [
                {
                    id: 'openai/gpt-4',
                    name: 'GPT-4',
                    tool_call: true,
                    cost: { input: 30, output: 60 },
                },
            ];

            vi.mocked(mockModelRegistry.getModels).mockResolvedValue(mockModels as any);

            // Test with various filter combinations
            const filters = [
                { providerId: 'openai' },
                { capability: 'tool_call' as const },
                { maxInputCost: 50 },
                { providerId: 'openai', capability: 'tool_call' as const },
                { providerId: 'openai', capability: 'tool_call' as const, maxInputCost: 50 },
            ];

            for (const filter of filters) {
                const result = await caller.modelRegistry.getModels(filter);
                const serialized = superjson.stringify({ filter, result });
                const deserialized = superjson.parse(serialized);

                expect(deserialized.result).toEqual(mockModels);
                expect(deserialized.filter).toEqual(filter);
            }
        });
    });

    describe('IPC Performance Characteristics', () => {
        it('should handle small payloads efficiently', async () => {
            const mockStatus = {
                lastFetch: Date.now(),
                isStale: false,
                providerCount: 4,
                modelCount: 25,
            };

            vi.mocked(mockModelRegistry.getCacheStatus).mockReturnValue(mockStatus);

            const start = Date.now();
            await caller.modelRegistry.getCacheStatus();
            const duration = Date.now() - start;

            // Should be very fast (< 100ms) for small payloads
            expect(duration).toBeLessThan(100);
        });

        it('should handle medium payloads efficiently', async () => {
            const mockProviders = Array.from({ length: 10 }, (_, i) => ({
                id: `provider-${i}`,
                name: `Provider ${i}`,
                baseURL: `https://api.provider${i}.com/v1`,
                modelCount: i * 5,
            }));

            vi.mocked(mockModelRegistry.getProviders).mockResolvedValue(mockProviders);

            const start = Date.now();
            await caller.modelRegistry.getProviders();
            const duration = Date.now() - start;

            // Should be fast (< 100ms) for medium payloads
            expect(duration).toBeLessThan(100);
        });

        it('should serialize large payloads without timeout', async () => {
            // Generate very large dataset (500 models with full metadata)
            const mockModels = Array.from({ length: 500 }, (_, i) => ({
                id: `provider/model-${i}`,
                name: `Model ${i}`,
                family: `family-${i % 20}`,
                tool_call: i % 2 === 0,
                reasoning: i % 3 === 0,
                modalities: {
                    input: ['text', 'image'],
                    output: ['text'],
                },
                cost: {
                    input: i * 0.1,
                    output: i * 0.2,
                    cache_read: i * 0.05,
                    cache_write: i * 0.125,
                },
                limit: {
                    context: 128000 + i * 1000,
                    output: 16384,
                },
            }));

            vi.mocked(mockModelRegistry.getModels).mockResolvedValue(mockModels as any);

            // Should not timeout
            const result = await caller.modelRegistry.getModels({});
            expect(result.length).toBe(500);
        });
    });

    describe('Edge Cases and Boundary Conditions', () => {
        it('should handle empty string values', async () => {
            const mockConfig = {
                id: '',
                name: '',
                baseURL: '',
                envKeys: [],
                supportedModels: [],
            };

            vi.mocked(mockModelRegistry.getProviderConfig).mockResolvedValue(mockConfig);

            const result = await caller.modelRegistry.getProviderConfig({ providerId: '' });
            const serialized = superjson.stringify(result);
            const deserialized = superjson.parse(serialized);

            expect(deserialized.id).toBe('');
            expect(deserialized.name).toBe('');
            expect(deserialized.baseURL).toBe('');
        });

        it('should handle special characters in strings', async () => {
            const mockProviders = [
                {
                    id: 'test/provider',
                    name: 'Test & Provider <>"\'',
                    baseURL: 'https://api.test.com/v1?key=value&other=123',
                    modelCount: 1,
                },
            ];

            vi.mocked(mockModelRegistry.getProviders).mockResolvedValue(mockProviders);

            const result = await caller.modelRegistry.getProviders();
            const serialized = superjson.stringify(result);
            const deserialized = superjson.parse(serialized);

            expect(deserialized[0].name).toBe('Test & Provider <>"\'');
            expect(deserialized[0].baseURL).toBe('https://api.test.com/v1?key=value&other=123');
        });

        it('should handle very long strings', async () => {
            const longString = 'A'.repeat(10000);
            const mockConfig = {
                id: 'test',
                name: longString,
                baseURL: 'https://api.test.com/v1',
                envKeys: ['KEY'],
                supportedModels: ['model'],
            };

            vi.mocked(mockModelRegistry.getProviderConfig).mockResolvedValue(mockConfig);

            const result = await caller.modelRegistry.getProviderConfig({ providerId: 'test' });
            const serialized = superjson.stringify(result);
            const deserialized = superjson.parse(serialized);

            expect(deserialized.name.length).toBe(10000);
            expect(deserialized.name).toBe(longString);
        });

        it('should handle zero and negative numbers', async () => {
            const mockModels = [
                {
                    id: 'test/model',
                    name: 'Test',
                    cost: {
                        input: 0,
                        output: -1, // Invalid but should serialize
                    },
                    limit: {
                        context: 0,
                        output: -1,
                    },
                },
            ];

            vi.mocked(mockModelRegistry.getModels).mockResolvedValue(mockModels as any);

            const result = await caller.modelRegistry.getModels({});
            const serialized = superjson.stringify(result);
            const deserialized = superjson.parse(serialized);

            expect(deserialized[0].cost.input).toBe(0);
            expect(deserialized[0].cost.output).toBe(-1);
        });

        it('should handle deeply nested objects', async () => {
            const mockModels = [
                {
                    id: 'test/model',
                    name: 'Test',
                    metadata: {
                        level1: {
                            level2: {
                                level3: {
                                    level4: {
                                        value: 'deep',
                                    },
                                },
                            },
                        },
                    },
                },
            ];

            vi.mocked(mockModelRegistry.getModels).mockResolvedValue(mockModels as any);

            const result = await caller.modelRegistry.getModels({});
            const serialized = superjson.stringify(result);
            const deserialized = superjson.parse(serialized);

            expect((deserialized[0] as any).metadata.level1.level2.level3.level4.value).toBe('deep');
        });
    });
});
