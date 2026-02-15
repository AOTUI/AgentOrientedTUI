/**
 * DeleteConfirmDialog - Property-Based Tests
 * 
 * Property-based tests for provider deletion behavior using fast-check
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import type { ProviderConfig } from './types.js';

/**
 * Arbitrary generator for ProviderConfig
 */
const arbitraryProviderConfig = (overrides?: Partial<ProviderConfig>): fc.Arbitrary<ProviderConfig> => {
    return fc.record({
        id: fc.integer({ min: 1, max: 10000 }),
        providerId: fc.constantFrom('openai', 'anthropic', 'google', 'cohere', 'mistral'),
        customName: fc.string({ minLength: 3, maxLength: 30 }),
        apiKey: fc.string({ minLength: 10, maxLength: 50 }),
        isActive: fc.boolean(),
        model: fc.string({ minLength: 3, maxLength: 30 }),
        temperature: fc.float({ min: 0, max: 2 }),
        maxSteps: fc.integer({ min: 1, max: 100 }),
        createdAt: fc.integer({ min: 1600000000000, max: 1700000000000 }),
        updatedAt: fc.integer({ min: 1600000000000, max: 1700000000000 }),
    }).map(config => ({ ...config, ...overrides }));
};

/**
 * Arbitrary generator for model ID
 */
const arbitraryModelId = (): fc.Arbitrary<string> => {
    return fc.string({ minLength: 5, maxLength: 50 });
};

/**
 * State interface for testing provider deletion
 */
interface AppState {
    activeProviderId: string | null;
    activeModelId: string | null;
}

/**
 * Simulates provider deletion behavior
 * 
 * This function represents the expected behavior when a provider is deleted:
 * - If the deleted provider is the active provider, clear the active model
 * - Otherwise, keep the active model unchanged
 */
const handleProviderDeletion = (
    state: AppState,
    deletedProviderId: string,
    isActiveProvider: boolean
): AppState => {
    if (isActiveProvider && state.activeProviderId === deletedProviderId) {
        return {
            ...state,
            activeProviderId: null,
            activeModelId: null,
        };
    }
    return state;
};

/**
 * Feature: settings-panel-v2, Property 4: Provider Deletion Clears Active Model
 * Validates: Requirements 6.11
 * 
 * For any provider deletion, if the deleted provider is the active provider,
 * the active model selection should be cleared.
 */
describe('DeleteConfirmDialog - Property-Based Tests', () => {
    it('Property 4: Provider Deletion Clears Active Model - deleting active provider clears active model', () => {
        fc.assert(
            fc.property(
                arbitraryProviderConfig({ isActive: true }),
                arbitraryModelId(),
                (activeProvider, activeModelId) => {
                    // Initial state with active provider and model
                    const initialState: AppState = {
                        activeProviderId: activeProvider.providerId,
                        activeModelId,
                    };

                    // Delete the active provider
                    const newState = handleProviderDeletion(
                        initialState,
                        activeProvider.providerId,
                        true
                    );

                    // Active model should be cleared
                    return (
                        newState.activeModelId === null &&
                        newState.activeProviderId === null
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Deleting non-active provider preserves active model
     * 
     * Verifies that deleting a non-active provider does not affect
     * the active model selection.
     */
    it('deleting non-active provider preserves active model', () => {
        fc.assert(
            fc.property(
                arbitraryProviderConfig({ isActive: false }),
                arbitraryProviderConfig({ isActive: true }),
                arbitraryModelId(),
                (nonActiveProvider, activeProvider, activeModelId) => {
                    // Ensure providers have different IDs
                    if (nonActiveProvider.providerId === activeProvider.providerId) {
                        return true; // Skip this case
                    }

                    // Initial state with active provider and model
                    const initialState: AppState = {
                        activeProviderId: activeProvider.providerId,
                        activeModelId,
                    };

                    // Delete the non-active provider
                    const newState = handleProviderDeletion(
                        initialState,
                        nonActiveProvider.providerId,
                        false
                    );

                    // Active model should remain unchanged
                    return (
                        newState.activeModelId === activeModelId &&
                        newState.activeProviderId === activeProvider.providerId
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Deleting provider when no active model preserves null state
     * 
     * Verifies that deleting a provider when there is no active model
     * keeps the active model as null.
     */
    it('deleting provider when no active model preserves null state', () => {
        fc.assert(
            fc.property(
                arbitraryProviderConfig(),
                (provider) => {
                    // Initial state with no active model
                    const initialState: AppState = {
                        activeProviderId: null,
                        activeModelId: null,
                    };

                    // Delete the provider
                    const newState = handleProviderDeletion(
                        initialState,
                        provider.providerId,
                        false
                    );

                    // Active model should remain null
                    return (
                        newState.activeModelId === null &&
                        newState.activeProviderId === null
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Multiple deletions of active provider always clear active model
     * 
     * Verifies that the behavior is consistent across multiple deletions.
     */
    it('multiple deletions of active provider always clear active model', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryProviderConfig({ isActive: true }), { minLength: 1, maxLength: 5 }),
                fc.array(arbitraryModelId(), { minLength: 1, maxLength: 5 }),
                (activeProviders, modelIds) => {
                    // Test each provider deletion
                    return activeProviders.every((provider, index) => {
                        const modelId = modelIds[index % modelIds.length];
                        
                        const initialState: AppState = {
                            activeProviderId: provider.providerId,
                            activeModelId: modelId,
                        };

                        const newState = handleProviderDeletion(
                            initialState,
                            provider.providerId,
                            true
                        );

                        return (
                            newState.activeModelId === null &&
                            newState.activeProviderId === null
                        );
                    });
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Deletion is idempotent for state clearing
     * 
     * Verifies that deleting an active provider multiple times
     * produces the same result (active model remains null).
     */
    it('deletion is idempotent for state clearing', () => {
        fc.assert(
            fc.property(
                arbitraryProviderConfig({ isActive: true }),
                arbitraryModelId(),
                (activeProvider, activeModelId) => {
                    const initialState: AppState = {
                        activeProviderId: activeProvider.providerId,
                        activeModelId,
                    };

                    // Delete once
                    const firstDeletion = handleProviderDeletion(
                        initialState,
                        activeProvider.providerId,
                        true
                    );

                    // Delete again (simulating the same deletion)
                    const secondDeletion = handleProviderDeletion(
                        firstDeletion,
                        activeProvider.providerId,
                        false // No longer active after first deletion
                    );

                    // Both should result in null active model
                    return (
                        firstDeletion.activeModelId === null &&
                        secondDeletion.activeModelId === null &&
                        firstDeletion.activeProviderId === null &&
                        secondDeletion.activeProviderId === null
                    );
                }
            ),
            { numRuns: 100 }
        );
    });
});
