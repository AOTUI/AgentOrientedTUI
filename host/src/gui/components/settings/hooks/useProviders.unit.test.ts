/**
 * Unit Tests for useProviders Hook
 * 
 * Tests specific examples, loading states, error handling, and model fetching
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useProviders } from './useProviders.js';
import type { ProviderInfo } from '../../../../types/llm-config.js';
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

describe('useProviders - Unit Tests', () => {
    const mockProviderList = [
        { id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', modelCount: 10 },
        { id: 'anthropic', name: 'Anthropic', baseURL: 'https://api.anthropic.com', modelCount: 5 },
        { id: 'google', name: 'Google AI', baseURL: 'https://generativelanguage.googleapis.com/v1beta', modelCount: 3 },
    ];

    const mockModels: ModelsDevModel[] = [
        {
            id: 'openai/gpt-4',
            name: 'GPT-4',
            family: 'gpt-4',
            tool_call: true,
            reasoning: false,
        },
        {
            id: 'openai/gpt-4-turbo',
            name: 'GPT-4 Turbo',
            family: 'gpt-4',
            tool_call: true,
            reasoning: false,
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Loading States', () => {
        it('should start with loading state', () => {
            mockGetProviders.mockResolvedValue([]);

            const { result } = renderHook(() => useProviders());

            expect(result.current.loading).toBe(true);
        });

        it('should set loading to false after data loads', async () => {
            mockGetProviders.mockResolvedValue(mockProviderList);

            const { result } = renderHook(() => useProviders());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });
        });

        it('should load providers on mount', async () => {
            mockGetProviders.mockResolvedValue(mockProviderList);

            const { result } = renderHook(() => useProviders());

            await waitFor(() => {
                expect(result.current.providers.length).toBe(3);
                expect(result.current.providers[0].id).toBe('openai');
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle errors when loading providers', async () => {
            const error = new Error('Failed to load providers');
            mockGetProviders.mockRejectedValue(error);

            const { result } = renderHook(() => useProviders());

            await waitFor(() => {
                expect(result.current.error).toBe('Failed to load providers');
                expect(result.current.loading).toBe(false);
            });
        });

        it('should use fallback providers on error', async () => {
            const error = new Error('Network error');
            mockGetProviders.mockRejectedValue(error);

            const { result } = renderHook(() => useProviders());

            await waitFor(() => {
                expect(result.current.providers.length).toBeGreaterThan(0);
                expect(result.current.providers[0].id).toBe('openai');
            });
        });

        it('should handle errors when fetching models', async () => {
            mockGetProviders.mockResolvedValue(mockProviderList);
            mockGetModels.mockRejectedValue(new Error('API error'));

            const { result } = renderHook(() => useProviders());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            let models: ModelsDevModel[] = [];
            await act(async () => {
                models = await result.current.fetchModelsForProvider('openai');
            });

            // Should return empty array on error
            expect(models).toEqual([]);
        });
    });

    describe('Model Fetching', () => {
        it('should fetch models for a provider', async () => {
            mockGetProviders.mockResolvedValue(mockProviderList);
            mockGetModels.mockResolvedValue(mockModels);

            const { result } = renderHook(() => useProviders());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            let models: ModelsDevModel[] = [];
            await act(async () => {
                models = await result.current.fetchModelsForProvider('openai');
            });

            expect(models).toEqual(mockModels);
            expect(mockGetModels).toHaveBeenCalledWith({ providerId: 'openai' });
        });

        it('should fetch models for different providers', async () => {
            mockGetProviders.mockResolvedValue(mockProviderList);

            const anthropicModels: ModelsDevModel[] = [
                {
                    id: 'anthropic/claude-3-5-sonnet',
                    name: 'Claude 3.5 Sonnet',
                    family: 'claude-3',
                    tool_call: true,
                    reasoning: true,
                },
            ];

            mockGetModels
                .mockResolvedValueOnce(mockModels)
                .mockResolvedValueOnce(anthropicModels);

            const { result } = renderHook(() => useProviders());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            let openaiModels: ModelsDevModel[] = [];
            await act(async () => {
                openaiModels = await result.current.fetchModelsForProvider('openai');
            });

            let claudeModels: ModelsDevModel[] = [];
            await act(async () => {
                claudeModels = await result.current.fetchModelsForProvider('anthropic');
            });

            expect(openaiModels).toEqual(mockModels);
            expect(claudeModels).toEqual(anthropicModels);
        });
    });

    describe('Refresh Functionality', () => {
        it('should refresh providers', async () => {
            mockGetProviders.mockResolvedValue(mockProviderList);

            const { result } = renderHook(() => useProviders());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Clear the mock calls
            vi.clearAllMocks();

            await act(async () => {
                await result.current.refresh();
            });

            expect(mockGetProviders).toHaveBeenCalled();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty provider list', async () => {
            mockGetProviders.mockResolvedValue([]);

            const { result } = renderHook(() => useProviders());

            await waitFor(() => {
                expect(result.current.providers).toEqual([]);
                expect(result.current.loading).toBe(false);
            });
        });

        it('should handle empty model list for a provider', async () => {
            mockGetProviders.mockResolvedValue(mockProviderList);
            mockGetModels.mockResolvedValue([]);

            const { result } = renderHook(() => useProviders());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            let models: ModelsDevModel[] = [];
            await act(async () => {
                models = await result.current.fetchModelsForProvider('openai');
            });

            expect(models).toEqual([]);
        });
    });
});
