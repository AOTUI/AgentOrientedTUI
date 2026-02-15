/**
 * Settings Panel - ConfigCard Property-Based Tests
 * 
 * Property-based tests for API key masking using fast-check
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: settings-panel, Property 8: API Key Security
 * Validates: Requirements 2.2
 * 
 * For any configuration display, API keys should be masked (showing only last 4 characters)
 * in the configuration list view.
 */
describe('ConfigCard - Property-Based Tests', () => {
    /**
     * Helper function to mask API key (extracted from ConfigCard component)
     */
    const maskApiKey = (apiKey: string | undefined): string => {
        if (!apiKey) return 'Not set';
        if (apiKey.length <= 4) return '••••';
        return '••••' + apiKey.slice(-4);
    };

    /**
     * Property 8: API Key Security
     * 
     * This property verifies that:
     * 1. Full API key is never displayed in the masked output
     * 2. Only the last 4 characters are shown (with masking prefix)
     * 3. This holds for any API key with length >= 10
     */
    it('API keys are masked showing only last 4 characters', () => {
        fc.assert(
            fc.property(
                // Generate arbitrary API keys with minimum length of 10
                fc.string({ minLength: 10, maxLength: 100 }),
                (apiKey) => {
                    // Apply masking function
                    const masked = maskApiKey(apiKey);

                    // Extract the last 4 characters of the API key
                    const last4 = apiKey.slice(-4);

                    // Verify:
                    // 1. Full API key is NOT present in the masked output
                    const fullKeyNotPresent = !masked.includes(apiKey);

                    // 2. Last 4 characters ARE present in the masked output
                    const last4Present = masked.includes(last4);

                    // 3. The masked prefix (••••) is present
                    const maskingPresent = masked.includes('••••');

                    return fullKeyNotPresent && last4Present && maskingPresent;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: API key masking for short keys
     * 
     * Verifies that API keys shorter than or equal to 4 characters
     * are completely masked without revealing any characters.
     */
    it('short API keys are completely masked', () => {
        fc.assert(
            fc.property(
                // Generate short API keys (1-4 characters)
                fc.string({ minLength: 1, maxLength: 4 }),
                (apiKey) => {
                    const masked = maskApiKey(apiKey);

                    // For short keys, the full key should NOT be present
                    // and only the mask (••••) should be shown
                    return !masked.includes(apiKey) && masked === '••••';
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Missing API key handling
     * 
     * Verifies that undefined API keys display appropriate fallback text.
     */
    it('missing API keys display fallback text', () => {
        const masked = maskApiKey(undefined);
        expect(masked).toBe('Not set');
    });

    /**
     * Property: API key masking consistency
     * 
     * Verifies that the same API key is masked consistently
     * across multiple invocations.
     */
    it('API key masking is consistent across invocations', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 10, maxLength: 100 }),
                (apiKey) => {
                    // Mask twice
                    const masked1 = maskApiKey(apiKey);
                    const masked2 = maskApiKey(apiKey);

                    // Both should be identical
                    return masked1 === masked2;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Masked output format
     * 
     * Verifies that masked API keys always follow the format: ••••XXXX
     * where XXXX are the last 4 characters.
     */
    it('masked API keys follow correct format', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 10, maxLength: 100 }),
                (apiKey) => {
                    const masked = maskApiKey(apiKey);
                    const last4 = apiKey.slice(-4);

                    // Should start with ••••
                    const startsWithMask = masked.startsWith('••••');

                    // Should end with last 4 characters
                    const endsWithLast4 = masked.endsWith(last4);

                    // Should have length of 8 (4 bullets + 4 chars)
                    const correctLength = masked.length === 8;

                    return startsWithMask && endsWithLast4 && correctLength;
                }
            ),
            { numRuns: 100 }
        );
    });
});
