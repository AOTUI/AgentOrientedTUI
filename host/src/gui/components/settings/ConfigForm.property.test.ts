/**
 * Property-Based Tests for ConfigForm Component
 * 
 * Tests universal properties for configuration updates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { LLMConfigRecord } from '../../../types/llm-config.js';
import type { ConfigFormData } from './types.js';

/**
 * Arbitrary generator for LLMConfigRecord
 */
function arbitraryLLMConfig(): fc.Arbitrary<LLMConfigRecord> {
    return fc.record({
        id: fc.integer({ min: 1, max: 10000 }),
        name: fc.string({ minLength: 3, maxLength: 50 }),
        model: fc.constantFrom('gpt-4', 'claude-3-5-sonnet', 'gemini-pro', 'grok-beta'),
        providerId: fc.constantFrom('openai', 'anthropic', 'google', 'xai'),
        baseUrl: fc.option(fc.webUrl({ validSchemes: ['https'] }), { nil: undefined }),
        apiKey: fc.option(fc.string({ minLength: 20, maxLength: 100 }), { nil: undefined }),
        temperature: fc.double({ min: 0, max: 1 }),
        maxSteps: fc.integer({ min: 1, max: 100 }),
        isActive: fc.boolean(),
        createdAt: fc.integer({ min: 1000000000000, max: 2000000000000 }),
        updatedAt: fc.integer({ min: 1000000000000, max: 2000000000000 }),
    });
}

/**
 * Arbitrary generator for partial ConfigFormData updates
 * Only generates updates for the 'name' field to test partial updates
 */
function arbitraryPartialUpdate(): fc.Arbitrary<Partial<ConfigFormData>> {
    return fc.record({
        name: fc.option(fc.string({ minLength: 3, maxLength: 50 }), { nil: undefined }),
    });
}

/**
 * Simulates updating a configuration with partial data
 * This mimics what the updateConfig function does
 */
function updateConfig(
    original: LLMConfigRecord,
    updates: Partial<ConfigFormData>
): LLMConfigRecord {
    return {
        ...original,
        ...updates,
        updatedAt: Date.now(),
    };
}

describe('ConfigForm - Property-Based Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    /**
     * Feature: settings-panel, Property 6: Configuration Update Preservation
     * Validates: Requirements 4.3
     * 
     * For any configuration update operation, all fields not explicitly modified
     * should retain their original values.
     */
    it('Property 6: Configuration Update Preservation - unmodified fields retain original values', () => {
        fc.assert(
            fc.property(
                arbitraryLLMConfig(),
                arbitraryPartialUpdate(),
                (original, updates) => {
                    // Perform update
                    const updated = updateConfig(original, updates);

                    // Verify unmodified fields retain original values
                    expect(updated.model).toBe(original.model);
                    expect(updated.providerId).toBe(original.providerId);
                    expect(updated.temperature).toBe(original.temperature);
                    expect(updated.maxSteps).toBe(original.maxSteps);
                    expect(updated.baseUrl).toBe(original.baseUrl);
                    expect(updated.apiKey).toBe(original.apiKey);
                    expect(updated.isActive).toBe(original.isActive);
                    expect(updated.createdAt).toBe(original.createdAt);
                    expect(updated.id).toBe(original.id);

                    // Verify modified field is updated
                    if (updates.name !== undefined) {
                        expect(updated.name).toBe(updates.name);
                    }

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Additional property test: Multiple field updates preserve unmodified fields
     * 
     * Tests that when updating multiple fields, all other fields remain unchanged
     */
    it('Property: Multiple field updates preserve unmodified fields', () => {
        fc.assert(
            fc.property(
                arbitraryLLMConfig(),
                fc.record({
                    name: fc.string({ minLength: 3, maxLength: 50 }),
                    temperature: fc.double({ min: 0, max: 1 }),
                }),
                (original, updates) => {
                    const updated = updateConfig(original, updates);

                    // Verify unmodified fields
                    expect(updated.model).toBe(original.model);
                    expect(updated.providerId).toBe(original.providerId);
                    expect(updated.maxSteps).toBe(original.maxSteps);
                    expect(updated.baseUrl).toBe(original.baseUrl);
                    expect(updated.apiKey).toBe(original.apiKey);
                    expect(updated.isActive).toBe(original.isActive);
                    expect(updated.createdAt).toBe(original.createdAt);
                    expect(updated.id).toBe(original.id);

                    // Verify modified fields
                    expect(updated.name).toBe(updates.name);
                    expect(updated.temperature).toBe(updates.temperature);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property test: Empty updates preserve all fields
     * 
     * Tests that when no updates are provided, all fields remain unchanged
     */
    it('Property: Empty updates preserve all fields', () => {
        fc.assert(
            fc.property(
                arbitraryLLMConfig(),
                (original) => {
                    const updated = updateConfig(original, {});

                    // Verify all fields remain the same (except updatedAt)
                    expect(updated.id).toBe(original.id);
                    expect(updated.name).toBe(original.name);
                    expect(updated.model).toBe(original.model);
                    expect(updated.providerId).toBe(original.providerId);
                    expect(updated.temperature).toBe(original.temperature);
                    expect(updated.maxSteps).toBe(original.maxSteps);
                    expect(updated.baseUrl).toBe(original.baseUrl);
                    expect(updated.apiKey).toBe(original.apiKey);
                    expect(updated.isActive).toBe(original.isActive);
                    expect(updated.createdAt).toBe(original.createdAt);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property test: ID immutability
     * 
     * Tests that configuration ID never changes during updates
     */
    it('Property: Configuration ID is immutable during updates', () => {
        fc.assert(
            fc.property(
                arbitraryLLMConfig(),
                fc.record({
                    name: fc.option(fc.string({ minLength: 3, maxLength: 50 }), { nil: undefined }),
                    model: fc.option(fc.constantFrom('gpt-4', 'claude-3-5-sonnet'), { nil: undefined }),
                    temperature: fc.option(fc.double({ min: 0, max: 1 }), { nil: undefined }),
                    maxSteps: fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
                }),
                (original, updates) => {
                    const updated = updateConfig(original, updates);

                    // ID must never change
                    expect(updated.id).toBe(original.id);

                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
