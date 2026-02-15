/**
 * Property-Based Tests for useProviders Hook
 * 
 * Tests universal properties that should hold across all providers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';
import { useProviders } from './useProviders.js';
import type { ModelsDevModel } from '../../../../services/index.js';
import { useChatBridge } from '../../../ChatBridge.js';

// Mock ChatBridge
const mockGetModels = vi.fn();
const mockGetProviders = vi.fn();

vi.mock('../../../ChatBridge.js', () => ({
    useChatBridge: vi.fn(() => ({
        getTrpcClient: vi.fn(() => ({
            modelRegistry: {
                getProviders: {
                    query: mockGetProviders,
                },
                getModels: {
                    query: mockGetModels,
                },
            },
        })),
    })),
}));

/**
 * Arbitrary generator for ModelsDevModel
 */
function arbitraryModel(providerId: string): fc.Arbitrary<ModelsDevModel> {
    return fc.record({
        id: fc.constant(`${providerId}/`).chain(prefix =>
            fc.string({ minLength: 5, maxLength: 30 }).map(suffix => prefix + suffix)
        ),
        name: fc.string({ minLength: 5, maxLength: 50 }),
        family: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
        tool_call: fc.option(fc.boolean(), { nil: undefined }),
        reasoning: fc.option(fc.boolean(), { nil: undefined }),
        modalities: fc.option(
            fc.record({
                input: fc.option(fc.array(fc.constantFrom('text', 'image', 'audio')), { nil: undefined }),
                output: fc.option(fc.array(fc.constantFrom('text', 'image', 'audio')), { nil: undefined }),
            }),
            { nil: undefined }
        ),
        cost: fc.option(
            fc.record({
                input: fc.option(fc.double({ min: 0, max: 100 }), { nil: undefined }),
                output: fc.option(fc.double({ min: 0, max: 100 }), { nil: undefined }),
            }),
            { nil: undefined }
        ),
        limit: fc.option(
            fc.record({
                context: fc.option(fc.integer({ min: 1000, max: 1000000 }), { nil: undefined }),
                output: fc.option(fc.integer({ min: 100, max: 100000 }), { nil: undefined }),
            }),
            { nil: undefined }
        ),
    });
}

describe('useProviders - Property-Based Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Feature: settings-panel, Property 5: Provider Model Availability
     * Validates: Requirements 3.4, 8.2
     * 
     * For any selected provider, the available models list should only contain 
     * models that belong to that provider.
     */
    it('Property 5: Provider Model Availability - models belong to selected provider', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom('openai', 'anthropic', 'google', 'xai', 'groq', 'mistral'),
                fc.array(fc.nat({ max: 20 }), { minLength: 1, maxLength: 20 }),
                async (providerId, modelCounts) => {
                    // Generate models for this provider
                    const models = await fc.sample(
                        arbitraryModel(providerId),
                        modelCounts.length
                    );

                    // Mock the tRPC client to return these models
                    mockGetModels.mockResolvedValue(models);
                    mockGetProviders.mockResolvedValue([
                        { id: providerId, name: providerId, baseURL: '', modelCount: models.length },
                    ]);

                    // Render hook
                    const { result } = renderHook(() => useProviders());

                    // Wait for loading to complete
                    await act(async () => {
                        await new Promise(resolve => setTimeout(resolve, 0));
                    });

                    // Fetch models for the provider
                    let fetchedModels: ModelsDevModel[] = [];
                    await act(async () => {
                        fetchedModels = await result.current.fetchModelsForProvider(providerId);
                    });

                    // Verify all models belong to the provider
                    const allModelsMatchProvider = fetchedModels.every(model =>
                        model.id.startsWith(`${providerId}/`)
                    );

                    expect(allModelsMatchProvider).toBe(true);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Additional property test: Model ID format consistency
     * 
     * For any provider, all model IDs should follow the format "providerId/modelName"
     */
    it('Property: Model IDs follow provider/model format', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom('openai', 'anthropic', 'google', 'xai'),
                fc.array(fc.nat({ max: 10 }), { minLength: 1, maxLength: 10 }),
                async (providerId, modelCounts) => {
                    const models = await fc.sample(
                        arbitraryModel(providerId),
                        modelCounts.length
                    );

                    mockGetModels.mockResolvedValue(models);
                    mockGetProviders.mockResolvedValue([
                        { id: providerId, name: providerId, baseURL: '', modelCount: models.length },
                    ]);

                    const { result } = renderHook(() => useProviders());

                    await act(async () => {
                        await new Promise(resolve => setTimeout(resolve, 0));
                    });

                    let fetchedModels: ModelsDevModel[] = [];
                    await act(async () => {
                        fetchedModels = await result.current.fetchModelsForProvider(providerId);
                    });

                    // Verify all model IDs contain a forward slash
                    const allHaveSlash = fetchedModels.every(model => model.id.includes('/'));
                    expect(allHaveSlash).toBe(true);

                    // Verify all model IDs start with the provider ID
                    const allStartWithProvider = fetchedModels.every(model =>
                        model.id.startsWith(providerId)
                    );
                    expect(allStartWithProvider).toBe(true);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
