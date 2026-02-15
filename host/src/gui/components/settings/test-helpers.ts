/**
 * Test Helpers for Settings Panel V2
 * 
 * Shared utilities and mock data factories for testing
 */

import type { ProviderConfig } from './types.js';

/**
 * Create a mock ProviderConfig with default values
 */
export function createMockProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return {
        id: 1,
        providerId: 'openai',
        customName: 'My OpenAI',
        apiKey: 'sk-test-key-1234567890',
        isActive: false,
        model: 'gpt-4',
        temperature: 0.7,
        maxSteps: 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...overrides,
    };
}

/**
 * Create multiple mock providers
 */
export function createMockProviders(count: number, baseOverrides: Partial<ProviderConfig> = {}): ProviderConfig[] {
    return Array.from({ length: count }, (_, i) => 
        createMockProvider({
            id: i + 1,
            providerId: ['openai', 'anthropic', 'google', 'mistral', 'cohere'][i % 5],
            customName: `Provider ${i + 1}`,
            isActive: i === 0,
            ...baseOverrides,
        })
    );
}
