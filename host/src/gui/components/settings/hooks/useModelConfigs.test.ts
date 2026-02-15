/**
 * Property-Based Tests for useModelConfigs Hook
 * 
 * Tests universal properties that should hold across all configurations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import * as fc from 'fast-check';
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
}));

/**
 * Arbitrary generator for LLMConfigRecord
 */
function arbitraryLLMConfig(overrides?: Partial<LLMConfigRecord>): fc.Arbitrary<LLMConfigRecord> {
    return fc.record({
        id: fc.integer({ min: 1, max: 10000 }),
        name: fc.string({ minLength: 3, maxLength: 50 }),
        model: fc.constantFrom('gpt-4', 'claude-3-5-sonnet', 'gemini-pro', 'grok-beta'),
        providerId: fc.constantFrom('openai', 'anthropic', 'google', 'xai'),
        baseUrl: fc.option(fc.webUrl(), { nil: undefined }),
        apiKey: fc.option(fc.string({ minLength: 20, maxLength: 100 }), { nil: undefined }),
        temperature: fc.double({ min: 0, max: 1 }),
        maxSteps: fc.integer({ min: 1, max: 100 }),
        isActive: fc.boolean(),
        createdAt: fc.integer({ min: 1000000000000, max: 2000000000000 }),
        updatedAt: fc.integer({ min: 1000000000000, max: 2000000000000 }),
    }).map(config => ({ ...config, ...overrides }));
}

/**
 * Ensure exactly one config is active in an array
 */
function ensureOneActive(configs: LLMConfigRecord[]): LLMConfigRecord[] {
    if (configs.length === 0) return configs;
    
    // Set first config as active, rest as inactive
    return configs.map((config, index) => ({
        ...config,
        isActive: index === 0,
    }));
}

describe('useModelConfigs - Property-Based Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Feature: settings-panel, Property 1: Active Configuration Uniqueness
     * Validates: Requirements 2.4
     * 
     * For any set of model configurations, exactly one configuration should be 
     * marked as active at any given time.
     */
    it('Property 1: Active Configuration Uniqueness - exactly one config is active', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(arbitraryLLMConfig(), { minLength: 1, maxLength: 20 }),
                async (generatedConfigs) => {
                    // Ensure exactly one config is active
                    const configs = ensureOneActive(generatedConfigs);
                    const activeConfig = configs.find(c => c.isActive) || null;

                    // Mock service responses
                    vi.mocked(llmConfigService.getAllConfigs).mockReturnValue(configs);
                    vi.mocked(llmConfigService.getActiveLLMConfigRecord).mockReturnValue(activeConfig);

                    // Render hook
                    const { result } = renderHook(() => useModelConfigs());

                    // Wait for loading to complete
                    await act(async () => {
                        await new Promise(resolve => setTimeout(resolve, 0));
                    });

                    // Verify exactly one active config
                    const activeCount = result.current.configs.filter(c => c.isActive).length;
                    expect(activeCount).toBe(1);

                    // Verify activeConfigId matches the active config
                    expect(result.current.activeConfigId).toBe(activeConfig?.id || null);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Additional property test: Active config ID consistency
     * 
     * For any set of configurations, the activeConfigId should always match
     * the ID of the configuration marked as isActive: true
     */
    it('Property: Active config ID matches isActive flag', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(arbitraryLLMConfig(), { minLength: 1, maxLength: 20 }),
                async (generatedConfigs) => {
                    const configs = ensureOneActive(generatedConfigs);
                    const activeConfig = configs.find(c => c.isActive) || null;

                    vi.mocked(llmConfigService.getAllConfigs).mockReturnValue(configs);
                    vi.mocked(llmConfigService.getActiveLLMConfigRecord).mockReturnValue(activeConfig);

                    const { result } = renderHook(() => useModelConfigs());

                    await act(async () => {
                        await new Promise(resolve => setTimeout(resolve, 0));
                    });

                    // The activeConfigId should match the config with isActive: true
                    const activeInList = result.current.configs.find(c => c.isActive);
                    expect(result.current.activeConfigId).toBe(activeInList?.id || null);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
