/**
 * Settings Panel - Filter Utilities Unit Tests
 * 
 * Unit tests for provider and model filtering functions
 */

import { describe, it, expect } from 'vitest';
import { filterProviders, filterModels } from './filters.js';
import type { ProviderConfig } from './types.js';
import type { ModelsDevModel } from '../../../services/index.js';
import { createMockProvider } from './test-helpers.js';

describe('filterProviders', () => {
    const mockProviders: ProviderConfig[] = [
        createMockProvider({
            id: 1,
            providerId: 'openai',
            customName: 'OpenAI Production',
            isActive: true,
        }),
        createMockProvider({
            id: 2,
            providerId: 'anthropic',
            customName: 'Anthropic Dev',
            isActive: false,
        }),
        createMockProvider({
            id: 3,
            providerId: 'google',
            customName: 'Google Testing',
            isActive: false,
        }),
    ];

    it('should return all providers when query is empty', () => {
        const result = filterProviders(mockProviders, '');
        expect(result).toHaveLength(3);
        expect(result).toEqual(mockProviders);
    });

    it('should return all providers when query is whitespace', () => {
        const result = filterProviders(mockProviders, '   ');
        expect(result).toHaveLength(3);
        expect(result).toEqual(mockProviders);
    });

    it('should filter providers by custom name (case-insensitive)', () => {
        const result = filterProviders(mockProviders, 'openai');
        expect(result).toHaveLength(1);
        expect(result[0].customName).toBe('OpenAI Production');
    });

    it('should filter providers with uppercase query', () => {
        const result = filterProviders(mockProviders, 'ANTHROPIC');
        expect(result).toHaveLength(1);
        expect(result[0].customName).toBe('Anthropic Dev');
    });

    it('should filter providers with mixed case query', () => {
        const result = filterProviders(mockProviders, 'GoOgLe');
        expect(result).toHaveLength(1);
        expect(result[0].customName).toBe('Google Testing');
    });

    it('should filter providers with partial match', () => {
        const result = filterProviders(mockProviders, 'prod');
        expect(result).toHaveLength(1);
        expect(result[0].customName).toBe('OpenAI Production');
    });

    it('should return empty array when no matches', () => {
        const result = filterProviders(mockProviders, 'nonexistent');
        expect(result).toHaveLength(0);
        expect(result).toEqual([]);
    });

    it('should handle query with leading/trailing whitespace', () => {
        const result = filterProviders(mockProviders, '  dev  ');
        expect(result).toHaveLength(1);
        expect(result[0].customName).toBe('Anthropic Dev');
    });

    it('should filter multiple matching providers', () => {
        const providersWithCommonWord: ProviderConfig[] = [
            ...mockProviders,
            createMockProvider({
                id: 4,
                providerId: 'cohere',
                customName: 'Testing Cohere',
                isActive: false,
            }),
        ];
        const result = filterProviders(providersWithCommonWord, 'testing');
        expect(result).toHaveLength(2);
        expect(result.map(p => p.customName)).toContain('Google Testing');
        expect(result.map(p => p.customName)).toContain('Testing Cohere');
    });
});

describe('filterModels', () => {
    const mockModels: ModelsDevModel[] = [
        {
            id: 'openai/gpt-4',
            name: 'GPT-4',
            family: 'GPT',
            tool_call: true,
            reasoning: true,
        },
        {
            id: 'openai/gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            family: 'GPT',
            tool_call: true,
        },
        {
            id: 'anthropic/claude-3-opus',
            name: 'Claude 3 Opus',
            family: 'Claude',
            reasoning: true,
        },
        {
            id: 'google/gemini-pro',
            name: 'Gemini Pro',
            family: 'Gemini',
        },
    ];

    it('should return all models when query is empty', () => {
        const result = filterModels(mockModels, '');
        expect(result).toHaveLength(4);
        expect(result).toEqual(mockModels);
    });

    it('should return all models when query is whitespace', () => {
        const result = filterModels(mockModels, '   ');
        expect(result).toHaveLength(4);
        expect(result).toEqual(mockModels);
    });

    it('should filter models by name (case-insensitive)', () => {
        const result = filterModels(mockModels, 'gpt-4');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('GPT-4');
    });

    it('should filter models by ID (case-insensitive)', () => {
        const result = filterModels(mockModels, 'anthropic');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('anthropic/claude-3-opus');
    });

    it('should filter models with uppercase query', () => {
        const result = filterModels(mockModels, 'CLAUDE');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Claude 3 Opus');
    });

    it('should filter models with mixed case query', () => {
        const result = filterModels(mockModels, 'GeMiNi');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Gemini Pro');
    });

    it('should filter models with partial match on name', () => {
        const result = filterModels(mockModels, 'turbo');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('GPT-3.5 Turbo');
    });

    it('should filter models with partial match on ID', () => {
        const result = filterModels(mockModels, 'openai');
        expect(result).toHaveLength(2);
        expect(result.map(m => m.id)).toContain('openai/gpt-4');
        expect(result.map(m => m.id)).toContain('openai/gpt-3.5-turbo');
    });

    it('should return empty array when no matches', () => {
        const result = filterModels(mockModels, 'nonexistent');
        expect(result).toHaveLength(0);
        expect(result).toEqual([]);
    });

    it('should handle query with leading/trailing whitespace', () => {
        const result = filterModels(mockModels, '  opus  ');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Claude 3 Opus');
    });

    it('should match models by name or ID', () => {
        // Query matches both name and ID of different models
        const result = filterModels(mockModels, 'gpt');
        expect(result).toHaveLength(2);
        expect(result.map(m => m.name)).toContain('GPT-4');
        expect(result.map(m => m.name)).toContain('GPT-3.5 Turbo');
    });

    it('should filter models with special characters in query', () => {
        const result = filterModels(mockModels, '3.5');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('GPT-3.5 Turbo');
    });
});
