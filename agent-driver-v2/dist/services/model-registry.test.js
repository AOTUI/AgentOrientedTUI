import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelRegistry } from './model-registry.js';
import * as openai from '@ai-sdk/openai';
import * as anthropic from '@ai-sdk/anthropic';
// Mock dependencies
vi.mock('@ai-sdk/openai', () => ({
    createOpenAI: vi.fn().mockReturnValue((config) => ({
        languageModel: vi.fn(),
    })),
}));
vi.mock('@ai-sdk/anthropic', () => ({
    createAnthropic: vi.fn().mockReturnValue((config) => ({
        languageModel: vi.fn(),
    })),
}));
vi.mock('@ai-sdk/google', () => ({
    createGoogleGenerativeAI: vi.fn().mockReturnValue((config) => ({
        languageModel: vi.fn(),
    })),
}));
vi.mock('@ai-sdk/xai', () => ({
    createXai: vi.fn().mockReturnValue((config) => ({
        languageModel: vi.fn(),
    })),
}));
// Mock global fetch
global.fetch = vi.fn();
describe('ModelRegistry', () => {
    let registry;
    beforeEach(() => {
        vi.clearAllMocks();
        registry = new ModelRegistry();
    });
    const mockModelsDevData = {
        'openai': {
            id: 'openai',
            name: 'OpenAI',
            npm: '@ai-sdk/openai',
            models: {
                'gpt-4': { id: 'gpt-4', name: 'GPT-4' },
            },
        },
        'anthropic': {
            id: 'anthropic',
            name: 'Anthropic',
            npm: '@ai-sdk/anthropic',
            models: {
                'claude-3-5-sonnet': { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
            },
        },
        'custom-provider': {
            id: 'custom-provider',
            name: 'Custom Provider',
            npm: '@ai-sdk/openai-compatible',
            api: 'https://api.custom.com/v1',
            models: {
                'custom-model': { id: 'custom-model', name: 'Custom Model' },
            },
        }
    };
    it('should fetch data from models.dev and create provider registry', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockModelsDevData,
        });
        const providers = await registry.getProviderRegistry();
        expect(global.fetch).toHaveBeenCalledWith('https://models.dev/api.json');
        expect(providers).toBeDefined();
        // Verify factories were called
        // Since getProviderRegistry returns a single registry object created by createProviderRegistry (which we assume works or is mocked by 'ai' package),
        // we can check if the underlying createOpenAI etc were called.
        // But createProviderRegistry is from 'ai'. We didn't mock 'ai'.
        // However, we mocked createOpenAI.
        // ModelRegistry iterates mockModelsDevData.
        // It calls createOpenAI for 'openai' and 'custom-provider' (@ai-sdk/openai-compatible maps to createOpenAI in our FACTORY_MAP).
        // It calls createAnthropic for 'anthropic'.
        expect(openai.createOpenAI).toHaveBeenCalledTimes(2); // openai + custom-provider
        expect(anthropic.createAnthropic).toHaveBeenCalledTimes(1);
    });
    it('should find provider by model id', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockModelsDevData,
        });
        const providerId = await registry.findProvider('gpt-4');
        expect(providerId).toBe('openai');
        const providerId2 = await registry.findProvider('custom-model');
        expect(providerId2).toBe('custom-provider');
        const providerId3 = await registry.findProvider('unknown-model');
        expect(providerId3).toBeUndefined();
    });
    it('should create custom model with overrides', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockModelsDevData,
        });
        // Test createCustomModel using findProvider logic
        await registry.createCustomModel('gpt-4', { apiKey: 'test-key' });
        // Should use createOpenAI since gpt-4 -> openai -> @ai-sdk/openai
        expect(openai.createOpenAI).toHaveBeenCalledWith(expect.objectContaining({
            apiKey: 'test-key',
        }));
    });
    it('should create custom model with explicit providerId', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockModelsDevData,
        });
        await registry.createCustomModel('some-model', {
            providerId: 'anthropic',
            apiKey: 'sk-ant'
        });
        expect(anthropic.createAnthropic).toHaveBeenCalledWith(expect.objectContaining({
            apiKey: 'sk-ant',
        }));
    });
    it('should create custom model with baseURL and headers', async () => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => mockModelsDevData,
        });
        await registry.createCustomModel('custom-model', {
            baseURL: 'https://override.com',
            headers: { 'X-Custom': '123' }
        });
        // custom-model -> custom-provider -> @ai-sdk/openai-compatible -> createOpenAI
        expect(openai.createOpenAI).toHaveBeenCalledWith(expect.objectContaining({
            baseURL: 'https://override.com',
            headers: { 'X-Custom': '123' }
        }));
    });
});
