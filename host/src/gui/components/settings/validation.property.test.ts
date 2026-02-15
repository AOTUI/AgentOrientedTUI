/**
 * Settings Panel - Validation Utilities Property-Based Tests
 * 
 * Property-based tests for provider configuration validation using fast-check
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { validateProviderConfig, validateProviderNameUniqueness } from './validation.js';
import type { ProviderConfig, NewProviderConfig } from './types.js';

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
 * Arbitrary generator for NewProviderConfig
 */
const arbitraryNewProviderConfig = (): fc.Arbitrary<NewProviderConfig> => {
    return fc.record({
        providerId: fc.constantFrom('openai', 'anthropic', 'google', 'cohere', 'mistral'),
        customName: fc.string({ minLength: 3, maxLength: 30 }).filter(s => s.trim().length >= 3),
        apiKey: fc.string({ minLength: 10, maxLength: 50 }).filter(s => s.trim().length >= 10),
    });
};

/**
 * Feature: settings-panel-v2, Property 2: Provider Name Uniqueness
 * Validates: Requirements 5.6
 * 
 * For any new provider configuration, if the custom name already exists,
 * the validation should fail and prevent saving.
 */
describe('Validation Utilities - Property-Based Tests', () => {
    it('Property 2: Provider Name Uniqueness - duplicate names are rejected', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryProviderConfig(), { minLength: 1, maxLength: 10 }),
                fc.string({ minLength: 3, maxLength: 30 }),
                (existingProviders, newName) => {
                    // Check if the name already exists (case-insensitive)
                    const normalizedNewName = newName.trim().toLowerCase();
                    const isDuplicate = existingProviders.some(
                        provider => provider.customName.toLowerCase() === normalizedNewName
                    );

                    // Validate the name
                    const validationResult = validateProviderNameUniqueness(
                        newName,
                        existingProviders
                    );

                    // If duplicate, validation should fail
                    if (isDuplicate) {
                        return validationResult.isValid === false &&
                               validationResult.errors.customName !== undefined;
                    }

                    // If not duplicate and name is valid (>= 3 chars), validation should pass
                    if (newName.trim().length >= 3) {
                        return validationResult.isValid === true;
                    }

                    // If name is too short, validation should fail
                    return validationResult.isValid === false;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Valid provider configs pass validation
     * 
     * Verifies that valid provider configurations pass validation.
     */
    it('valid provider configs pass validation', () => {
        fc.assert(
            fc.property(
                arbitraryNewProviderConfig(),
                (config) => {
                    const result = validateProviderConfig(config, []);
                    return result.isValid === true && Object.keys(result.errors).length === 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Empty provider ID fails validation
     * 
     * Verifies that empty or whitespace provider IDs are rejected.
     */
    it('empty provider ID fails validation', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 3, maxLength: 30 }),
                fc.string({ minLength: 10, maxLength: 50 }),
                (customName, apiKey) => {
                    const config: NewProviderConfig = {
                        providerId: '',
                        customName,
                        apiKey,
                    };

                    const result = validateProviderConfig(config, []);
                    return result.isValid === false && result.errors.providerId !== undefined;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Empty custom name fails validation
     * 
     * Verifies that empty or whitespace custom names are rejected.
     */
    it('empty custom name fails validation', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('openai', 'anthropic', 'google'),
                fc.string({ minLength: 10, maxLength: 50 }),
                (providerId, apiKey) => {
                    const config: NewProviderConfig = {
                        providerId,
                        customName: '',
                        apiKey,
                    };

                    const result = validateProviderConfig(config, []);
                    return result.isValid === false && result.errors.customName !== undefined;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Short custom name fails validation
     * 
     * Verifies that custom names shorter than 3 characters are rejected.
     */
    it('short custom name fails validation', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('openai', 'anthropic', 'google'),
                fc.string({ minLength: 1, maxLength: 2 }),
                fc.string({ minLength: 10, maxLength: 50 }),
                (providerId, customName, apiKey) => {
                    const config: NewProviderConfig = {
                        providerId,
                        customName,
                        apiKey,
                    };

                    const result = validateProviderConfig(config, []);
                    return result.isValid === false && result.errors.customName !== undefined;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Empty API key fails validation
     * 
     * Verifies that empty or whitespace API keys are rejected.
     */
    it('empty API key fails validation', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('openai', 'anthropic', 'google'),
                fc.string({ minLength: 3, maxLength: 30 }),
                (providerId, customName) => {
                    const config: NewProviderConfig = {
                        providerId,
                        customName,
                        apiKey: '',
                    };

                    const result = validateProviderConfig(config, []);
                    return result.isValid === false && result.errors.apiKey !== undefined;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Short API key fails validation
     * 
     * Verifies that API keys shorter than 10 characters are rejected.
     */
    it('short API key fails validation', () => {
        fc.assert(
            fc.property(
                fc.constantFrom('openai', 'anthropic', 'google'),
                fc.string({ minLength: 3, maxLength: 30 }),
                fc.string({ minLength: 1, maxLength: 9 }),
                (providerId, customName, apiKey) => {
                    const config: NewProviderConfig = {
                        providerId,
                        customName,
                        apiKey,
                    };

                    const result = validateProviderConfig(config, []);
                    return result.isValid === false && result.errors.apiKey !== undefined;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Duplicate name detection is case-insensitive
     * 
     * Verifies that duplicate name detection works regardless of case.
     */
    it('duplicate name detection is case-insensitive', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 3, maxLength: 30 }),
                (customName) => {
                    const existingProvider: ProviderConfig = {
                        id: 1,
                        providerId: 'openai',
                        customName: customName.toLowerCase(),
                        apiKey: 'test-api-key-123',
                        isActive: false,
                        model: 'gpt-4',
                        temperature: 0.7,
                        maxSteps: 10,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    };

                    // Try to add a provider with the same name in different case
                    const upperCaseResult = validateProviderNameUniqueness(
                        customName.toUpperCase(),
                        [existingProvider]
                    );

                    const mixedCaseResult = validateProviderNameUniqueness(
                        customName,
                        [existingProvider]
                    );

                    // Both should fail validation
                    return (
                        upperCaseResult.isValid === false &&
                        mixedCaseResult.isValid === false
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Validation with existing providers detects duplicates
     * 
     * Verifies that validation correctly detects duplicate names when
     * existing providers are provided.
     */
    it('validation with existing providers detects duplicates', () => {
        fc.assert(
            fc.property(
                fc.array(arbitraryProviderConfig(), { minLength: 1, maxLength: 10 }),
                (existingProviders) => {
                    // Pick a random existing provider's name
                    const existingName = existingProviders[0].customName;

                    // Try to create a new provider with the same name
                    const config: NewProviderConfig = {
                        providerId: 'openai',
                        customName: existingName,
                        apiKey: 'test-api-key-123',
                    };

                    const result = validateProviderConfig(config, existingProviders);

                    // Should fail validation due to duplicate name
                    return result.isValid === false && result.errors.customName !== undefined;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Exclude ID allows editing without duplicate error
     * 
     * Verifies that when editing a provider, its own name doesn't trigger
     * a duplicate error.
     */
    it('exclude ID allows editing without duplicate error', () => {
        fc.assert(
            fc.property(
                arbitraryProviderConfig(),
                (provider) => {
                    // Validate the same name with the provider's own ID excluded
                    const result = validateProviderNameUniqueness(
                        provider.customName,
                        [provider],
                        provider.id
                    );

                    // Should pass validation (not considered a duplicate)
                    return result.isValid === true;
                }
            ),
            { numRuns: 100 }
        );
    });
});
