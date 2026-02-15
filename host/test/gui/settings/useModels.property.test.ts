/**
 * useModels Hook - Property-Based Tests
 * 
 * Property-based tests for useModels hook using fast-check
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { sortModels } from '../../../src/gui/hooks/useModels.js';
import type { ModelsDevModel } from '@aotui/agent-driver-v2';

/**
 * Arbitrary generator for ModelsDevModel
 */
function arbitraryModelsDevModel(overrides?: Partial<ModelsDevModel>): fc.Arbitrary<ModelsDevModel> {
    return fc.record({
        id: fc.string({ minLength: 5, maxLength: 100 }),
        name: fc.string({ minLength: 3, maxLength: 50 }),
        family: fc.option(fc.string({ minLength: 3, maxLength: 30 }), { nil: undefined }),
        attachment: fc.option(fc.boolean(), { nil: undefined }),
        reasoning: fc.option(fc.boolean(), { nil: undefined }),
        tool_call: fc.option(fc.boolean(), { nil: undefined }),
        temperature: fc.option(fc.boolean(), { nil: undefined }),
        release_date: fc.option(fc.string(), { nil: undefined }),
        last_updated: fc.option(fc.string(), { nil: undefined }),
        modalities: fc.option(
            fc.record({
                input: fc.option(fc.array(fc.string()), { nil: undefined }),
                output: fc.option(fc.array(fc.string()), { nil: undefined }),
            }),
            { nil: undefined }
        ),
        open_weights: fc.option(fc.boolean(), { nil: undefined }),
        cost: fc.option(
            fc.record({
                input: fc.option(fc.double({ min: 0, max: 1 }), { nil: undefined }),
                output: fc.option(fc.double({ min: 0, max: 1 }), { nil: undefined }),
                cache_read: fc.option(fc.double({ min: 0, max: 1 }), { nil: undefined }),
                cache_write: fc.option(fc.double({ min: 0, max: 1 }), { nil: undefined }),
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
    }).map(model => ({ ...model, ...overrides }));
}

describe('useModels - Property-Based Tests', () => {
    /**
     * Feature: settings-panel-v2, Property 6: Active Model First Position
     * Validates: Requirements 7.2, 9.3
     * 
     * For any list of models, if one model is marked as active,
     * it should appear at index 0 in the displayed list.
     */
    it('active model appears first in sorted list', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryModelsDevModel(), { minLength: 2, maxLength: 50 }),
                fc.integer({ min: 0, max: 49 }),
                (models, activeIndex) => {
                    // Ensure we have at least one model
                    if (models.length === 0) return true;

                    // Select one model as active
                    const actualIndex = activeIndex % models.length;
                    const activeModelId = models[actualIndex].id;

                    // Sort models
                    const sorted = sortModels(models, activeModelId);

                    // Verify active model is first
                    return sorted[0].id === activeModelId;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any list of models with no active model,
     * the order should remain unchanged
     */
    it('models without active remain in original order', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryModelsDevModel(), { minLength: 1, maxLength: 50 }),
                (models) => {
                    // Sort models with null activeModelId
                    const sorted = sortModels(models, null);

                    // Verify order is preserved
                    const idsMatch = sorted.every((m, i) => m.id === models[i].id);

                    return idsMatch;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any list of models, if active model ID doesn't exist,
     * the order should remain unchanged
     */
    it('models with non-existent active ID remain in original order', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryModelsDevModel(), { minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 10 }),
                (models, nonExistentId) => {
                    // Ensure the ID doesn't exist in the list
                    const idExists = models.some(m => m.id === nonExistentId);
                    if (idExists) return true; // Skip this case

                    // Sort models with non-existent activeModelId
                    const sorted = sortModels(models, nonExistentId);

                    // Verify order is preserved
                    const idsMatch = sorted.every((m, i) => m.id === models[i].id);

                    return idsMatch;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any list of models, sorting should not modify the original array
     */
    it('sorting does not mutate original array', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryModelsDevModel(), { minLength: 1, maxLength: 50 }),
                fc.option(fc.string(), { nil: null }),
                (models, activeModelId) => {
                    // Create a copy of the original array
                    const originalIds = models.map(m => m.id);

                    // Sort models
                    sortModels(models, activeModelId);

                    // Verify original array is unchanged
                    const currentIds = models.map(m => m.id);
                    return originalIds.every((id, i) => id === currentIds[i]);
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any list of models, sorted list should contain all original models
     */
    it('sorted list contains all original models', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryModelsDevModel(), { minLength: 1, maxLength: 50 }),
                fc.option(fc.string(), { nil: null }),
                (models, activeModelId) => {
                    // Sort models
                    const sorted = sortModels(models, activeModelId);

                    // Verify all models are present
                    const originalIds = new Set(models.map(m => m.id));
                    const sortedIds = new Set(sorted.map(m => m.id));

                    return (
                        sorted.length === models.length &&
                        originalIds.size === sortedIds.size &&
                        [...originalIds].every(id => sortedIds.has(id))
                    );
                }
            ),
            { numRuns: 100 }
        );
    });
});
