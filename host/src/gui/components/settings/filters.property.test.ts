/**
 * Settings Panel - Filter Utilities Property-Based Tests
 * 
 * Property-based tests for provider and model filtering using fast-check
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { filterProviders, filterModels } from './filters.js';
import type { ProviderConfig } from './types.js';
import type { ModelsDevModel } from '../../../services/index.js';

/**
 * Arbitrary generator for ProviderConfig
 */
const arbitraryProviderConfig = (): fc.Arbitrary<ProviderConfig> => {
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
    });
};

/**
 * Arbitrary generator for ModelsDevModel
 */
const arbitraryModelsDevModel = (): fc.Arbitrary<ModelsDevModel> => {
    return fc.record({
        id: fc.string({ minLength: 5, maxLength: 50 }),
        name: fc.string({ minLength: 3, maxLength: 50 }),
        family: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
        tool_call: fc.option(fc.boolean(), { nil: undefined }),
        reasoning: fc.option(fc.boolean(), { nil: undefined }),
        modalities: fc.option(
            fc.record({
                input: fc.option(fc.array(fc.string()), { nil: undefined }),
                output: fc.option(fc.array(fc.string()), { nil: undefined }),
            }),
            { nil: undefined }
        ),
        cost: fc.option(
            fc.record({
                input: fc.option(fc.float({ min: 0, max: 1 }), { nil: undefined }),
                output: fc.option(fc.float({ min: 0, max: 1 }), { nil: undefined }),
            }),
            { nil: undefined }
        ),
        limit: fc.option(
            fc.record({
                context: fc.option(fc.integer({ min: 1000, max: 200000 }), { nil: undefined }),
                output: fc.option(fc.integer({ min: 1000, max: 50000 }), { nil: undefined }),
            }),
            { nil: undefined }
        ),
    });
};

/**
 * Feature: settings-panel-v2, Property 1: Provider Search Filtering
 * Validates: Requirements 4.1, 4.2
 * 
 * For any provider search query, all displayed providers should have names
 * that match the query (case-insensitive).
 */
describe('Filter Utilities - Property-Based Tests', () => {
    it('Property 1: Provider Search Filtering - all results match query', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryProviderConfig(), { minLength: 1, maxLength: 20 }),
                fc.string(),
                (providers, searchQuery) => {
                    const filtered = filterProviders(providers, searchQuery);

                    // If query is empty or whitespace, should return all providers
                    if (!searchQuery || searchQuery.trim() === '') {
                        return filtered.length === providers.length;
                    }

                    const normalizedQuery = searchQuery.toLowerCase().trim();

                    // All filtered providers should match the query
                    return filtered.every(provider =>
                        provider.customName.toLowerCase().includes(normalizedQuery)
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Feature: settings-panel-v2, Property 5: Model Search Filtering
     * Validates: Requirements 8.1, 8.2
     * 
     * For any model search query, all displayed models should have names or IDs
     * that match the query (case-insensitive).
     */
    it('Property 5: Model Search Filtering - all results match query', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryModelsDevModel(), { minLength: 1, maxLength: 50 }),
                fc.string(),
                (models, searchQuery) => {
                    const filtered = filterModels(models, searchQuery);

                    // If query is empty or whitespace, should return all models
                    if (!searchQuery || searchQuery.trim() === '') {
                        return filtered.length === models.length;
                    }

                    const normalizedQuery = searchQuery.toLowerCase().trim();

                    // All filtered models should match the query (name or ID)
                    return filtered.every(model =>
                        model.name.toLowerCase().includes(normalizedQuery) ||
                        model.id.toLowerCase().includes(normalizedQuery)
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Provider filtering is case-insensitive
     * 
     * Verifies that provider filtering works regardless of query case.
     */
    it('provider filtering is case-insensitive', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryProviderConfig(), { minLength: 1, maxLength: 20 }),
                fc.string({ minLength: 1, maxLength: 10 }),
                (providers, searchQuery) => {
                    const lowerCaseFiltered = filterProviders(providers, searchQuery.toLowerCase());
                    const upperCaseFiltered = filterProviders(providers, searchQuery.toUpperCase());
                    const mixedCaseFiltered = filterProviders(providers, searchQuery);

                    // All three should return the same results
                    return (
                        lowerCaseFiltered.length === upperCaseFiltered.length &&
                        upperCaseFiltered.length === mixedCaseFiltered.length
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Model filtering is case-insensitive
     * 
     * Verifies that model filtering works regardless of query case.
     */
    it('model filtering is case-insensitive', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryModelsDevModel(), { minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 1, maxLength: 10 }),
                (models, searchQuery) => {
                    const lowerCaseFiltered = filterModels(models, searchQuery.toLowerCase());
                    const upperCaseFiltered = filterModels(models, searchQuery.toUpperCase());
                    const mixedCaseFiltered = filterModels(models, searchQuery);

                    // All three should return the same results
                    return (
                        lowerCaseFiltered.length === upperCaseFiltered.length &&
                        upperCaseFiltered.length === mixedCaseFiltered.length
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Empty query returns all providers
     * 
     * Verifies that an empty or whitespace query returns all providers.
     */
    it('empty query returns all providers', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryProviderConfig(), { minLength: 1, maxLength: 20 }),
                (providers) => {
                    const emptyFiltered = filterProviders(providers, '');
                    const whitespaceFiltered = filterProviders(providers, '   ');

                    return (
                        emptyFiltered.length === providers.length &&
                        whitespaceFiltered.length === providers.length
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Empty query returns all models
     * 
     * Verifies that an empty or whitespace query returns all models.
     */
    it('empty query returns all models', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryModelsDevModel(), { minLength: 1, maxLength: 50 }),
                (models) => {
                    const emptyFiltered = filterModels(models, '');
                    const whitespaceFiltered = filterModels(models, '   ');

                    return (
                        emptyFiltered.length === models.length &&
                        whitespaceFiltered.length === models.length
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Filtered results are a subset of original
     * 
     * Verifies that filtered providers are always a subset of the original array.
     */
    it('filtered providers are a subset of original', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryProviderConfig(), { minLength: 1, maxLength: 20 }),
                fc.string(),
                (providers, searchQuery) => {
                    const filtered = filterProviders(providers, searchQuery);

                    // All filtered items should exist in the original array
                    return filtered.every(filteredProvider =>
                        providers.some(provider => provider.id === filteredProvider.id)
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Filtered models are a subset of original
     * 
     * Verifies that filtered models are always a subset of the original array.
     */
    it('filtered models are a subset of original', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryModelsDevModel(), { minLength: 1, maxLength: 50 }),
                fc.string(),
                (models, searchQuery) => {
                    const filtered = filterModels(models, searchQuery);

                    // All filtered items should exist in the original array
                    return filtered.every(filteredModel =>
                        models.some(model => model.id === filteredModel.id)
                    );
                }
            ),
            { numRuns: 100 }
        );
    });
});
