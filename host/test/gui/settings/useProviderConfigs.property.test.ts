/**
 * useProviderConfigs Hook - Property-Based Tests
 * 
 * Property-based tests for useProviderConfigs hook using fast-check
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sortProviders } from '../../../src/gui/hooks/useProviderConfigs.js';
import type { ProviderConfig } from '../../../src/gui/hooks/useProviderConfigs.js';

/**
 * Arbitrary generator for ProviderConfig
 */
function arbitraryProviderConfig(overrides?: Partial<ProviderConfig>): fc.Arbitrary<ProviderConfig> {
    return fc.record({
        id: fc.integer({ min: 1, max: 10000 }),
        providerId: fc.constantFrom('openai', 'anthropic', 'google', 'xai', 'groq', 'mistral'),
        customName: fc.string({ minLength: 3, maxLength: 50 }),
        apiKey: fc.string({ minLength: 10, maxLength: 100 }),
        isActive: fc.boolean(),
        model: fc.string({ minLength: 1, maxLength: 100 }),
        temperature: fc.double({ min: 0, max: 1 }),
        maxSteps: fc.integer({ min: 1, max: 100 }),
        createdAt: fc.integer({ min: 1000000000000, max: 9999999999999 }),
        updatedAt: fc.integer({ min: 1000000000000, max: 9999999999999 }),
    }).map(config => ({ ...config, ...overrides }));
}

describe('useProviderConfigs - Property-Based Tests', () => {
    /**
     * Feature: settings-panel-v2, Property 3: Active Provider First Position
     * Validates: Requirements 3.5
     * 
     * For any list of providers, if one provider is marked as active,
     * it should appear at index 0 in the displayed list.
     */
    it('active provider appears first in sorted list', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryProviderConfig({ isActive: false }), { minLength: 1, maxLength: 20 }),
                fc.integer({ min: 0, max: 19 }),
                (providers, activeIndex) => {
                    // Ensure we have at least one provider
                    if (providers.length === 0) return true;

                    // Mark one provider as active
                    const actualIndex = activeIndex % providers.length;
                    const providersWithActive = providers.map((p, i) => ({
                        ...p,
                        isActive: i === actualIndex,
                    }));

                    // Sort providers
                    const sorted = sortProviders(providersWithActive);

                    // Verify active provider is first
                    return sorted[0].isActive === true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any list of providers with no active provider,
     * the order should remain unchanged
     */
    it('providers without active remain in original order', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryProviderConfig({ isActive: false }), { minLength: 1, maxLength: 20 }),
                (providers) => {
                    // Sort providers
                    const sorted = sortProviders(providers);

                    // Verify no provider is marked as active
                    const hasActive = sorted.some(p => p.isActive);

                    // Verify order is preserved (since no active provider)
                    const idsMatch = sorted.every((p, i) => p.id === providers[i].id);

                    return !hasActive && idsMatch;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any list of providers with multiple active providers (edge case),
     * at least one active provider should be first
     */
    it('at least one active provider is first when multiple are active', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryProviderConfig(), { minLength: 2, maxLength: 20 }),
                (providers) => {
                    // Ensure at least one provider is active
                    const providersWithActive = providers.map((p, i) => ({
                        ...p,
                        isActive: i < 2, // Make first two active
                    }));

                    // Sort providers
                    const sorted = sortProviders(providersWithActive);

                    // Verify first provider is active
                    return sorted[0].isActive === true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any list of providers, sorting should not modify the original array
     */
    it('sorting does not mutate original array', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryProviderConfig(), { minLength: 1, maxLength: 20 }),
                (providers) => {
                    // Create a copy of the original array
                    const originalIds = providers.map(p => p.id);

                    // Sort providers
                    sortProviders(providers);

                    // Verify original array is unchanged
                    const currentIds = providers.map(p => p.id);
                    return originalIds.every((id, i) => id === currentIds[i]);
                }
            ),
            { numRuns: 100 }
        );
    });
});
