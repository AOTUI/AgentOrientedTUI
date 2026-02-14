/**
 * @aotui/agent-driver-v2 - Model Registry
 *
 * 基于 models.dev 和 Vercel AI SDK 的模型注册表
 *
 * 设计原则:
 * - 复用 AI SDK 的 createProviderRegistry 和 Provider 数据模型
 * - 从 models.dev 获取模型元数据（定价、能力等）
 * - 提供统一的 Provider 配置和模型查询接口
 */
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { xai } from '@ai-sdk/xai';
import { createProviderRegistry } from 'ai';
import { Logger } from '../utils/logger.js';
/**
 * ModelRegistry - 模型注册表
 *
 * 职责:
 * - 从 models.dev 获取模型列表
 * - 缓存模型数据 (避免重复请求)
 * - 提供 Provider 配置查询
 * - 提供模型列表查询 (用于 UI 选择器)
 *
 * 设计特点:
 * - 复用 AI SDK 的 createProviderRegistry
 * - 懒加载: 首次调用时才获取数据
 * - 缓存机制: 24小时 TTL
 */
export class ModelRegistry {
    logger;
    modelsDevData = null;
    lastFetch = 0;
    cacheTTL = 24 * 60 * 60 * 1000; // 24小时
    providerRegistry = null;
    constructor() {
        this.logger = new Logger('ModelRegistry');
    }
    /**
     * 获取 Vercel AI SDK Provider Registry
     *
     * 复用 AI SDK 的 createProviderRegistry，动态注册所有 Provider
     */
    async getProviderRegistry() {
        await this.ensureFresh();
        if (this.providerRegistry) {
            return this.providerRegistry;
        }
        // 构建 Provider Registry
        const providers = {};
        // 注册官方 Provider (使用 AI SDK 原生实例)
        providers['anthropic'] = createAnthropic({
            apiKey: process.env.ANTHROPIC_API_KEY || '',
        });
        providers['openai'] = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY || '',
        });
        providers['google'] = google;
        providers['xai'] = xai;
        // 注册 models.dev 中的其他 Provider (OpenAI 兼容)
        if (this.modelsDevData) {
            Object.values(this.modelsDevData).forEach((provider) => {
                // 跳过已注册的官方 Provider
                if (providers[provider.id]) {
                    return;
                }
                // 获取 API Key (从环境变量)
                const apiKey = this.getProviderApiKey(provider);
                // 使用 OpenAI 兼容接口
                providers[provider.id] = createOpenAI({
                    apiKey: apiKey || '',
                    baseURL: provider.api,
                });
            });
        }
        this.providerRegistry = createProviderRegistry(providers);
        this.logger.info('Provider registry created', {
            providerCount: Object.keys(providers).length,
        });
        return this.providerRegistry;
    }
    /**
     * 获取 Provider 配置
     *
     * @param providerId - Provider ID (如 'anthropic')
     * @returns Provider 配置 (baseURL, envKeys, supportedModels)
     */
    async getProviderConfig(providerId) {
        await this.ensureFresh();
        const provider = this.modelsDevData?.[providerId];
        if (!provider) {
            throw new Error(`Provider not found in models.dev: ${providerId}`);
        }
        return {
            id: provider.id,
            name: provider.name,
            baseURL: provider.api || '',
            envKeys: provider.env || [],
            supportedModels: Object.keys(provider.models),
        };
    }
    /**
     * 获取模型列表
     *
     * @param filter - 过滤条件 (可选)
     * @returns 模型列表
     */
    async getModels(filter) {
        await this.ensureFresh();
        let models = [];
        // 提取所有模型
        if (this.modelsDevData) {
            const providers = Object.values(this.modelsDevData);
            providers.forEach((provider) => {
                models.push(...Object.values(provider.models));
            });
        }
        // 按 provider 过滤
        if (filter?.providerId) {
            models = models.filter((m) => m.id.startsWith(`${filter.providerId}/`));
        }
        // 按 capability 过滤
        if (filter?.capability) {
            models = models.filter((m) => {
                switch (filter.capability) {
                    case 'tool_call':
                        return m.tool_call === true;
                    case 'reasoning':
                        return m.reasoning === true;
                    case 'vision':
                        return m.modalities?.input?.includes('image');
                    default:
                        return true;
                }
            });
        }
        // 按成本过滤
        if (filter?.maxInputCost !== undefined) {
            models = models.filter((m) => {
                return (m.cost?.input ?? Infinity) <= filter.maxInputCost;
            });
        }
        return models;
    }
    /**
     * 获取 Provider 列表
     */
    async getProviders() {
        await this.ensureFresh();
        const providers = [];
        if (this.modelsDevData) {
            const providersData = Object.values(this.modelsDevData);
            providersData.forEach((provider) => {
                providers.push({
                    id: provider.id,
                    name: provider.name,
                    baseURL: provider.api || '',
                    modelCount: Object.keys(provider.models).length,
                });
            });
        }
        return providers;
    }
    /**
     * 确保数据新鲜（超过 TTL 则重新获取）
     */
    async ensureFresh() {
        const now = Date.now();
        if (!this.modelsDevData || now - this.lastFetch > this.cacheTTL) {
            await this.fetchModelsDevData();
        }
    }
    /**
     * 从 models.dev 获取模型数据
     */
    async fetchModelsDevData() {
        try {
            this.logger.info('Fetching data from models.dev...');
            const response = await fetch('https://models.dev/api.json');
            if (!response.ok) {
                throw new Error(`models.dev API error: ${response.statusText}`);
            }
            const data = await response.json();
            this.modelsDevData = data;
            this.lastFetch = Date.now();
            const totalModels = Object.values(this.modelsDevData).reduce((sum, provider) => sum + Object.keys(provider.models).length, 0);
            this.logger.info('models.dev data fetched', {
                providerCount: Object.keys(this.modelsDevData).length,
                modelCount: totalModels,
            });
        }
        catch (error) {
            this.logger.error('Failed to fetch models.dev data', { error });
            // Fallback: 如果获取失败，使用空数据（允许手动配置）
            if (!this.modelsDevData) {
                this.modelsDevData = {};
            }
        }
    }
    /**
     * 获取 Provider 的 API Key (从环境变量)
     */
    getProviderApiKey(provider) {
        if (!provider.env || provider.env.length === 0) {
            return undefined;
        }
        // 尝试所有可能的环境变量名
        for (const envKey of provider.env) {
            const apiKey = process.env[envKey];
            if (apiKey) {
                return apiKey;
            }
        }
        return undefined;
    }
}
