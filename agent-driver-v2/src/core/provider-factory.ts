import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createProviderRegistry, customProvider } from 'ai';
import type { LLMConfig } from './interfaces.js';

export interface ModelTarget {
    providerId: string;
    modelName: string;
    registryModelId: string;
}

export interface ProviderFactoryDeps {
    config: LLMConfig;
    target: ModelTarget;
    warn: (message: string) => void;
}

const ENV_KEY_MAP: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_API_KEY',
    xai: 'XAI_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
};

export function createLanguageModel(deps: ProviderFactoryDeps) {
    const { config, target, warn } = deps;
    const { providerId, modelName, registryModelId } = target;

    const apiKey = config.apiKey || getApiKeyFromEnv(providerId);
    if (!apiKey) {
        throw new Error(
            `API key not found for provider: ${providerId}. ` +
            `Please set ${getEnvKeyName(providerId)} or provide apiKey in config.`
        );
    }

    const customBaseURL = config.provider?.id === providerId
        ? config.provider.baseURL
        : undefined;
    const headers = config.provider?.id === providerId
        ? config.provider.headers
        : undefined;

    const provider = buildProvider(providerId, apiKey, customBaseURL, headers, warn);
    const registryProvider = customProvider({
        languageModels: {},
        fallbackProvider: provider as any,
    });
    const registry = createProviderRegistry({
        [providerId]: registryProvider,
    });

    const modelId = (registryModelId || `${providerId}:${modelName}`) as `${string}:${string}`;
    return registry.languageModel(modelId);
}

function buildProvider(
    providerId: string,
    apiKey: string,
    customBaseURL: string | undefined,
    headers: Record<string, string> | undefined,
    warn: (message: string) => void
) {
    switch (providerId) {
        case 'anthropic':
            return createAnthropic({ apiKey, baseURL: customBaseURL, headers });
        case 'google':
            return createGoogleGenerativeAI({ apiKey, baseURL: customBaseURL, headers });
        case 'deepseek':
            return createDeepSeek({ apiKey, baseURL: customBaseURL, headers });
        case 'xai':
            return createOpenAI({ apiKey, baseURL: customBaseURL || 'https://api.x.ai/v1', headers });
        case 'openai':
            return createOpenAI({ apiKey, baseURL: customBaseURL, headers });
        case 'openrouter':
            return createOpenRouter({
                apiKey,
                baseURL: customBaseURL,
                headers,
                compatibility: 'strict',
            });
        default: {
            const baseURL = customBaseURL;

            if (!baseURL) {
                throw new Error(
                    `Provider "${providerId}" requires a baseURL. ` +
                    `Please configure the baseURL in your LLM config (typically from ModelRegistry).`
                );
            }

            return createOpenAI({ apiKey, baseURL, headers });
        }
    }
}

function getApiKeyFromEnv(providerId: string): string | undefined {
    const envKey = getEnvKeyName(providerId);
    return process.env[envKey];
}

function getEnvKeyName(providerId: string): string {
    return ENV_KEY_MAP[providerId] || `${providerId.toUpperCase()}_API_KEY`;
}
