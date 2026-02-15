/**
 * Settings Panel - Form Validation Property-Based Tests
 * 
 * Property-based tests for form validation using fast-check
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { validateConfigForm } from '../../../src/gui/components/settings/validation.js';
import type { ConfigFormData } from '../../../src/gui/components/settings/types.js';
import type { ProviderInfo } from '../../../src/types/llm-config.js';

/**
 * Arbitrary generator for invalid ConfigFormData
 * Generates form data that violates at least one validation rule
 */
function arbitraryInvalidConfigFormData(): fc.Arbitrary<ConfigFormData> {
    return fc.oneof(
        // Invalid name: empty
        fc.record({
            name: fc.constant(''),
            providerId: fc.string({ minLength: 1 }),
            model: fc.string({ minLength: 1 }),
            apiKey: fc.string(),
            baseUrl: fc.string(),
            temperature: fc.double({ min: 0, max: 1 }),
            maxSteps: fc.integer({ min: 1 }),
        }),
        // Invalid name: too short (< 3 chars)
        fc.record({
            name: fc.string({ minLength: 1, maxLength: 2 }),
            providerId: fc.string({ minLength: 1 }),
            model: fc.string({ minLength: 1 }),
            apiKey: fc.string(),
            baseUrl: fc.string(),
            temperature: fc.double({ min: 0, max: 1 }),
            maxSteps: fc.integer({ min: 1 }),
        }),
        // Invalid name: too long (> 50 chars)
        fc.record({
            name: fc.string({ minLength: 51, maxLength: 100 }),
            providerId: fc.string({ minLength: 1 }),
            model: fc.string({ minLength: 1 }),
            apiKey: fc.string(),
            baseUrl: fc.string(),
            temperature: fc.double({ min: 0, max: 1 }),
            maxSteps: fc.integer({ min: 1 }),
        }),
        // Invalid providerId: empty
        fc.record({
            name: fc.string({ minLength: 3, maxLength: 50 }),
            providerId: fc.constant(''),
            model: fc.string({ minLength: 1 }),
            apiKey: fc.string(),
            baseUrl: fc.string(),
            temperature: fc.double({ min: 0, max: 1 }),
            maxSteps: fc.integer({ min: 1 }),
        }),
        // Invalid model: empty
        fc.record({
            name: fc.string({ minLength: 3, maxLength: 50 }),
            providerId: fc.string({ minLength: 1 }),
            model: fc.constant(''),
            apiKey: fc.string(),
            baseUrl: fc.string(),
            temperature: fc.double({ min: 0, max: 1 }),
            maxSteps: fc.integer({ min: 1 }),
        }),
        // Invalid temperature: < 0
        fc.record({
            name: fc.string({ minLength: 3, maxLength: 50 }),
            providerId: fc.string({ minLength: 1 }),
            model: fc.string({ minLength: 1 }),
            apiKey: fc.string(),
            baseUrl: fc.string(),
            temperature: fc.double({ min: -10, max: -0.01 }),
            maxSteps: fc.integer({ min: 1 }),
        }),
        // Invalid temperature: > 1
        fc.record({
            name: fc.string({ minLength: 3, maxLength: 50 }),
            providerId: fc.string({ minLength: 1 }),
            model: fc.string({ minLength: 1 }),
            apiKey: fc.string(),
            baseUrl: fc.string(),
            temperature: fc.double({ min: 1.01, max: 10 }),
            maxSteps: fc.integer({ min: 1 }),
        }),
        // Invalid maxSteps: <= 0
        fc.record({
            name: fc.string({ minLength: 3, maxLength: 50 }),
            providerId: fc.string({ minLength: 1 }),
            model: fc.string({ minLength: 1 }),
            apiKey: fc.string(),
            baseUrl: fc.string(),
            temperature: fc.double({ min: 0, max: 1 }),
            maxSteps: fc.integer({ min: -100, max: 0 }),
        }),
        // Invalid maxSteps: not an integer
        fc.record({
            name: fc.string({ minLength: 3, maxLength: 50 }),
            providerId: fc.string({ minLength: 1 }),
            model: fc.string({ minLength: 1 }),
            apiKey: fc.string(),
            baseUrl: fc.string(),
            temperature: fc.double({ min: 0, max: 1 }),
            maxSteps: fc.double({ min: 1.1, max: 10.9 }),
        }),
        // Invalid baseUrl: not a valid URL
        fc.record({
            name: fc.string({ minLength: 3, maxLength: 50 }),
            providerId: fc.string({ minLength: 1 }),
            model: fc.string({ minLength: 1 }),
            apiKey: fc.string(),
            baseUrl: fc.string({ minLength: 1 }).filter(s => {
                try {
                    new URL(s);
                    return false;
                } catch {
                    return true;
                }
            }),
            temperature: fc.double({ min: 0, max: 1 }),
            maxSteps: fc.integer({ min: 1 }),
        }),
        // Invalid baseUrl: HTTP instead of HTTPS
        fc.record({
            name: fc.string({ minLength: 3, maxLength: 50 }),
            providerId: fc.string({ minLength: 1 }),
            model: fc.string({ minLength: 1 }),
            apiKey: fc.string(),
            baseUrl: fc.constant('http://api.example.com'),
            temperature: fc.double({ min: 0, max: 1 }),
            maxSteps: fc.integer({ min: 1 }),
        })
    );
}

/**
 * Arbitrary generator for valid ConfigFormData
 */
function arbitraryValidConfigFormData(): fc.Arbitrary<ConfigFormData> {
    return fc.record({
        name: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
        providerId: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        model: fc.string({ minLength: 1 }).filter(s => s.trim().length > 0),
        apiKey: fc.string(),
        baseUrl: fc.oneof(
            fc.constant(''),
            fc.constant('https://api.example.com'),
            fc.constant('https://api.openai.com/v1')
        ),
        temperature: fc.double({ min: 0, max: 1, noNaN: true }),
        maxSteps: fc.integer({ min: 1, max: 100 }),
    });
}

/**
 * Arbitrary generator for ProviderInfo
 */
function arbitraryProviderInfo(): fc.Arbitrary<ProviderInfo> {
    return fc.record({
        id: fc.string({ minLength: 1 }),
        name: fc.string({ minLength: 1 }),
        defaultBaseUrl: fc.option(fc.webUrl(), { nil: undefined }),
        requiresApiKey: fc.boolean(),
        models: fc.option(fc.array(fc.string()), { nil: undefined }),
    });
}

describe('Form Validation - Property-Based Tests', () => {
    /**
     * Feature: settings-panel, Property 3: Form Validation Completeness
     * Validates: Requirements 9.1, 9.4
     * 
     * For any invalid form data, the validation should fail and return errors
     */
    it('invalid form data prevents submission', () => {
        fc.assert(
            fc.property(
                arbitraryInvalidConfigFormData(),
                (formData) => {
                    const result = validateConfigForm(formData);
                    return !result.isValid && Object.keys(result.errors).length > 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any valid form data, the validation should pass with no errors
     */
    it('valid form data passes validation', () => {
        fc.assert(
            fc.property(
                arbitraryValidConfigFormData(),
                (formData) => {
                    const result = validateConfigForm(formData);
                    return result.isValid && Object.keys(result.errors).length === 0;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any provider that requires API key, validation should fail if API key is empty
     */
    it('API key required when provider requires it', () => {
        fc.assert(
            fc.property(
                arbitraryValidConfigFormData(),
                (formData) => {
                    const providerRequiringKey: ProviderInfo = {
                        id: formData.providerId,
                        name: 'Test Provider',
                        requiresApiKey: true,
                    };

                    const formDataWithoutKey = { ...formData, apiKey: '' };
                    const result = validateConfigForm(formDataWithoutKey, providerRequiringKey);

                    return !result.isValid && result.errors.apiKey !== undefined;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any provider that doesn't require API key, validation should pass even if API key is empty
     */
    it('API key not required when provider does not require it', () => {
        fc.assert(
            fc.property(
                arbitraryValidConfigFormData(),
                (formData) => {
                    const providerNotRequiringKey: ProviderInfo = {
                        id: formData.providerId,
                        name: 'Test Provider',
                        requiresApiKey: false,
                    };

                    const formDataWithoutKey = { ...formData, apiKey: '' };
                    const result = validateConfigForm(formDataWithoutKey, providerNotRequiringKey);

                    // Should not have API key error (may have other errors)
                    return result.errors.apiKey === undefined;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any temperature outside [0, 1], validation should fail
     */
    it('temperature must be between 0 and 1', () => {
        fc.assert(
            fc.property(
                arbitraryValidConfigFormData(),
                fc.oneof(
                    fc.double({ min: -100, max: -0.01 }),
                    fc.double({ min: 1.01, max: 100 })
                ),
                (formData, invalidTemp) => {
                    const formDataWithInvalidTemp = { ...formData, temperature: invalidTemp };
                    const result = validateConfigForm(formDataWithInvalidTemp);

                    return !result.isValid && result.errors.temperature !== undefined;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any non-positive maxSteps, validation should fail
     */
    it('maxSteps must be positive', () => {
        fc.assert(
            fc.property(
                arbitraryValidConfigFormData(),
                fc.integer({ min: -100, max: 0 }),
                (formData, invalidMaxSteps) => {
                    const formDataWithInvalidMaxSteps = { ...formData, maxSteps: invalidMaxSteps };
                    const result = validateConfigForm(formDataWithInvalidMaxSteps);

                    return !result.isValid && result.errors.maxSteps !== undefined;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any non-integer maxSteps, validation should fail
     */
    it('maxSteps must be an integer', () => {
        fc.assert(
            fc.property(
                arbitraryValidConfigFormData(),
                fc.double({ min: 1.1, max: 100.9 }),
                (formData, nonIntegerMaxSteps) => {
                    const formDataWithNonInteger = { ...formData, maxSteps: nonIntegerMaxSteps };
                    const result = validateConfigForm(formDataWithNonInteger);

                    return !result.isValid && result.errors.maxSteps !== undefined;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any HTTP URL (not HTTPS), validation should fail
     */
    it('baseUrl must use HTTPS', () => {
        fc.assert(
            fc.property(
                arbitraryValidConfigFormData(),
                (formData) => {
                    const formDataWithHttp = { ...formData, baseUrl: 'http://api.example.com' };
                    const result = validateConfigForm(formDataWithHttp);

                    return !result.isValid && result.errors.baseUrl !== undefined;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any name with only whitespace, validation should fail
     */
    it('name with only whitespace is invalid', () => {
        fc.assert(
            fc.property(
                arbitraryValidConfigFormData(),
                fc.stringMatching(/^\s+$/),
                (formData, whitespaceString) => {
                    const formDataWithWhitespace = { ...formData, name: whitespaceString };
                    const result = validateConfigForm(formDataWithWhitespace);

                    return !result.isValid && result.errors.name !== undefined;
                }
            ),
            { numRuns: 100 }
        );
    });
});
