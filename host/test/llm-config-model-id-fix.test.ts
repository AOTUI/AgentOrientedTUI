/**
 * Test for Model ID Format Fix
 * 
 * Verifies that toLLMConfig correctly handles models.dev format (providerId/modelId)
 * and converts them to AI SDK format (providerId:modelId)
 */

import { describe, it, expect } from 'vitest';
import { toLLMConfig } from '../src/types/llm-config.js';
import type { LLMConfigRecord } from '../src/types/llm-config.js';

describe('toLLMConfig - Model ID Format Fix', () => {
    it('should handle models.dev format (providerId/modelId)', () => {
        const record: LLMConfigRecord = {
            id: 1,
            name: 'Deepseek Reasoner',
            model: 'deepseek/deepseek-reasoner', // models.dev format
            providerId: 'deepseek',
            temperature: 0.7,
            maxSteps: 10,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const config = toLLMConfig(record);

        // Should convert to AI SDK format: "deepseek:deepseek-reasoner"
        expect(config.model).toBe('deepseek:deepseek-reasoner');
        expect(config.provider?.id).toBe('deepseek');
    });

    it('should handle simple model name without slash', () => {
        const record: LLMConfigRecord = {
            id: 1,
            name: 'GPT-4',
            model: 'gpt-4', // Simple model name
            providerId: 'openai',
            temperature: 0.7,
            maxSteps: 10,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const config = toLLMConfig(record);

        // Should add providerId prefix
        expect(config.model).toBe('openai:gpt-4');
        expect(config.provider?.id).toBe('openai');
    });

    it('should handle model ID that already has colon format', () => {
        const record: LLMConfigRecord = {
            id: 1,
            name: 'Custom Model',
            model: 'custom:my-model', // Already in correct format
            providerId: 'custom',
            temperature: 0.7,
            maxSteps: 10,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const config = toLLMConfig(record);

        // Should not modify
        expect(config.model).toBe('custom:my-model');
        expect(config.provider?.id).toBe('custom');
    });

    it('should handle anthropic models with slash format', () => {
        const record: LLMConfigRecord = {
            id: 1,
            name: 'Claude Sonnet',
            model: 'anthropic/claude-3-5-sonnet-20241022', // models.dev format
            providerId: 'anthropic',
            temperature: 0.7,
            maxSteps: 10,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const config = toLLMConfig(record);

        // Should convert to AI SDK format
        expect(config.model).toBe('anthropic:claude-3-5-sonnet-20241022');
        expect(config.provider?.id).toBe('anthropic');
    });

    it('should handle model without providerId', () => {
        const record: LLMConfigRecord = {
            id: 1,
            name: 'Custom Model',
            model: 'my-custom-model',
            temperature: 0.7,
            maxSteps: 10,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const config = toLLMConfig(record);

        // Should keep model as-is
        expect(config.model).toBe('my-custom-model');
        expect(config.provider).toBeUndefined();
    });

    it('should handle nested slash in model ID', () => {
        const record: LLMConfigRecord = {
            id: 1,
            name: 'Nested Model',
            model: 'provider/category/model-name', // Multiple slashes
            providerId: 'provider',
            temperature: 0.7,
            maxSteps: 10,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const config = toLLMConfig(record);

        // Should remove only provider prefix and keep remaining path
        expect(config.model).toBe('provider:category/model-name');
        expect(config.provider?.id).toBe('provider');
    });

    it('should preserve vendor path and suffix for openrouter models', () => {
        const record: LLMConfigRecord = {
            id: 1,
            name: 'OpenRouter GLM Free',
            model: 'z-ai/glm-4.5-air:free',
            providerId: 'openrouter',
            temperature: 0.7,
            maxSteps: 10,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const config = toLLMConfig(record);

        expect(config.model).toBe('openrouter:z-ai/glm-4.5-air:free');
        expect(config.provider?.id).toBe('openrouter');
    });

    it('should preserve apiKey and baseUrl', () => {
        const record: LLMConfigRecord = {
            id: 1,
            name: 'Test Config',
            model: 'deepseek/deepseek-chat',
            providerId: 'deepseek',
            apiKey: 'test-api-key',
            baseUrl: 'https://api.deepseek.com',
            temperature: 0.7,
            maxSteps: 10,
            isActive: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        const config = toLLMConfig(record);

        expect(config.model).toBe('deepseek:deepseek-chat');
        expect(config.apiKey).toBe('test-api-key');
        expect(config.provider?.baseURL).toBe('https://api.deepseek.com');
    });
});
