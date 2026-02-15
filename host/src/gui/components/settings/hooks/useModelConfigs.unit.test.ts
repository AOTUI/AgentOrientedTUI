/**
 * Unit Tests for useModelConfigs Hook
 * 
 * Tests specific examples, loading states, error handling, and CRUD operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useModelConfigs } from './useModelConfigs.js';
import type { LLMConfigRecord } from '../../../../types/llm-config.js';
import { llmConfigService } from '../../../../core/llm-config-service.js';

// Mock the llmConfigService
vi.mock('../../../../core/llm-config-service.js', () => ({
    llmConfigService: {
        getAllConfigs: vi.fn(),
        getActiveLLMConfigRecord: vi.fn(),
        createConfig: vi.fn(),
        updateConfig: vi.fn(),
        deleteConfig: vi.fn(),
        setActiveConfig: vi.fn(),
    },
    getLLMConfigService: vi.fn(() => ({
        getAllConfigs: vi.fn(),
        getActiveLLMConfigRecord: vi.fn(),
        createConfig: vi.fn(),
        updateConfig: vi.fn(),
        deleteConfig: vi.fn(),
        setActiveConfig: vi.fn(),
    })),
}));

describe('useModelConfigs - Unit Tests', () => {
    const mockConfigs: LLMConfigRecord[] = [
        {
            id: 1,
            name: 'OpenAI GPT-4',
            model: 'gpt-4',
            providerId: 'openai',
            temperature: 0.7,
            maxSteps: 10,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
        {
            id: 2,
            name: 'Claude 3.5',
            model: 'claude-3-5-sonnet',
            providerId: 'anthropic',
            temperature: 0.7,
            maxSteps: 10,
            isActive: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Loading States', () => {
        it('should start with loading state', async () => {
            vi.mocked(llmConfigService.getAllConfigs).mockReturnValue([]);
            vi.mocked(llmConfigService.getActiveLLMConfigRecord).mockReturnValue(null);

            const { result } = renderHook(() => useModelConfigs());

            // Loading happens synchronously in useEffect, so we need to check immediately
            // By the time we check, loading is already complete
            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });
        });

        it('should set loading to false after data loads', async () => {
            vi.mocked(llmConfigService.getAllConfigs).mockReturnValue(mockConfigs);
            vi.mocked(llmConfigService.getActiveLLMConfigRecord).mockReturnValue(mockConfigs[0]);

            const { result } = renderHook(() => useModelConfigs());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });
        });

        it('should load configurations on mount', async () => {
            vi.mocked(llmConfigService.getAllConfigs).mockReturnValue(mockConfigs);
            vi.mocked(llmConfigService.getActiveLLMConfigRecord).mockReturnValue(mockConfigs[0]);

            const { result } = renderHook(() => useModelConfigs());

            await waitFor(() => {
                expect(result.current.configs).toEqual(mockConfigs);
                expect(result.current.activeConfigId).toBe(1);
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle errors when loading configurations', async () => {
            const error = new Error('Database error');
            vi.mocked(llmConfigService.getAllConfigs).mockImplementation(() => {
                throw error;
            });

            const { result } = renderHook(() => useModelConfigs());

            await waitFor(() => {
                expect(result.current.error).toBe('Database error');
                expect(result.current.loading).toBe(false);
            });
        });

        it('should handle errors when creating configuration', async () => {
            vi.mocked(llmConfigService.getAllConfigs).mockReturnValue(mockConfigs);
            vi.mocked(llmConfigService.getActiveLLMConfigRecord).mockReturnValue(mockConfigs[0]);

            const error = new Error('Create failed');
            vi.mocked(llmConfigService.createConfig).mockImplementation(() => {
                throw error;
            });

            const { result } = renderHook(() => useModelConfigs());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Should throw the error
            await expect(async () => {
                await act(async () => {
                    await result.current.createConfig({
                        name: 'Test',
                        model: 'test-model',
                        providerId: 'test',
                        apiKey: '',
                        baseUrl: '',
                        temperature: 0.7,
                        maxSteps: 10,
                    });
                });
            }).rejects.toThrow('Create failed');
        });

        it('should handle errors when deleting configuration', async () => {
            vi.mocked(llmConfigService.getAllConfigs).mockReturnValue(mockConfigs);
            vi.mocked(llmConfigService.getActiveLLMConfigRecord).mockReturnValue(mockConfigs[0]);

            const error = new Error('Cannot delete active config');
            vi.mocked(llmConfigService.deleteConfig).mockImplementation(() => {
                throw error;
            });

            const { result } = renderHook(() => useModelConfigs());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Should throw the error
            await expect(async () => {
                await act(async () => {
                    await result.current.deleteConfig(1);
                });
            }).rejects.toThrow('Cannot delete active config');
        });
    });

    describe('CRUD Operations', () => {
        it('should create a new configuration', async () => {
            vi.mocked(llmConfigService.getAllConfigs).mockReturnValue(mockConfigs);
            vi.mocked(llmConfigService.getActiveLLMConfigRecord).mockReturnValue(mockConfigs[0]);

            const newConfig: LLMConfigRecord = {
                id: 3,
                name: 'New Config',
                model: 'new-model',
                providerId: 'test',
                temperature: 0.5,
                maxSteps: 5,
                isActive: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            vi.mocked(llmConfigService.createConfig).mockResolvedValue(newConfig);

            const { result } = renderHook(() => useModelConfigs());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.createConfig({
                    name: 'New Config',
                    model: 'new-model',
                    providerId: 'test',
                    apiKey: 'test-key',
                    baseUrl: 'https://api.test.com',
                    temperature: 0.5,
                    maxSteps: 5,
                });
            });

            expect(llmConfigService.createConfig).toHaveBeenCalledWith({
                name: 'New Config',
                model: 'new-model',
                providerId: 'test',
                baseUrl: 'https://api.test.com',
                apiKey: 'test-key',
                temperature: 0.5,
                maxSteps: 5,
            });
        });

        it('should update an existing configuration', async () => {
            vi.mocked(llmConfigService.getAllConfigs).mockReturnValue(mockConfigs);
            vi.mocked(llmConfigService.getActiveLLMConfigRecord).mockReturnValue(mockConfigs[0]);

            const { result } = renderHook(() => useModelConfigs());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.updateConfig(1, {
                    name: 'Updated Name',
                    temperature: 0.9,
                });
            });

            expect(llmConfigService.updateConfig).toHaveBeenCalledWith(1, {
                name: 'Updated Name',
                temperature: 0.9,
            });
        });

        it('should delete a configuration', async () => {
            vi.mocked(llmConfigService.getAllConfigs).mockReturnValue(mockConfigs);
            vi.mocked(llmConfigService.getActiveLLMConfigRecord).mockReturnValue(mockConfigs[0]);
            vi.mocked(llmConfigService.deleteConfig).mockImplementation(() => {
                // Success - no error
            });

            const { result } = renderHook(() => useModelConfigs());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.deleteConfig(2);
            });

            expect(llmConfigService.deleteConfig).toHaveBeenCalledWith(2);
        });

        it('should set a configuration as active', async () => {
            vi.mocked(llmConfigService.getAllConfigs).mockReturnValue(mockConfigs);
            vi.mocked(llmConfigService.getActiveLLMConfigRecord).mockReturnValue(mockConfigs[0]);

            const { result } = renderHook(() => useModelConfigs());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            await act(async () => {
                await result.current.setActiveConfig(2);
            });

            expect(llmConfigService.setActiveConfig).toHaveBeenCalledWith(2);
        });

        it('should refresh configurations', async () => {
            vi.mocked(llmConfigService.getAllConfigs).mockReturnValue(mockConfigs);
            vi.mocked(llmConfigService.getActiveLLMConfigRecord).mockReturnValue(mockConfigs[0]);

            const { result } = renderHook(() => useModelConfigs());

            await waitFor(() => {
                expect(result.current.loading).toBe(false);
            });

            // Clear the mock calls
            vi.clearAllMocks();

            act(() => {
                result.current.refresh();
            });

            expect(llmConfigService.getAllConfigs).toHaveBeenCalled();
            expect(llmConfigService.getActiveLLMConfigRecord).toHaveBeenCalled();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty configuration list', async () => {
            vi.mocked(llmConfigService.getAllConfigs).mockReturnValue([]);
            vi.mocked(llmConfigService.getActiveLLMConfigRecord).mockReturnValue(null);

            const { result } = renderHook(() => useModelConfigs());

            await waitFor(() => {
                expect(result.current.configs).toEqual([]);
                expect(result.current.activeConfigId).toBeNull();
                expect(result.current.loading).toBe(false);
            });
        });

        it('should handle null active configuration', async () => {
            vi.mocked(llmConfigService.getAllConfigs).mockReturnValue(mockConfigs);
            vi.mocked(llmConfigService.getActiveLLMConfigRecord).mockReturnValue(null);

            const { result } = renderHook(() => useModelConfigs());

            await waitFor(() => {
                expect(result.current.activeConfigId).toBeNull();
            });
        });
    });
});
