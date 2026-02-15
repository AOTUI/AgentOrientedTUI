/**
 * models.dev API 客户端
 * 
 * 提供 LLM Provider 和 Model 元数据查询服务
 * 
 * API 文档: https://models.dev/api.json
 */

import { Logger } from '../utils/logger.js';

/**
 * Provider 信息
 */
export interface Provider {
    /** Provider ID (e.g., 'openai', 'anthropic') */
    id: string;
    /** Provider 名称 (e.g., 'OpenAI', 'Anthropic') */
    name: string;
    /** npm 包名 (e.g., '@ai-sdk/openai') */
    npm?: string;
    /** 环境变量名 (e.g., 'OPENAI_API_KEY') */
    env?: string;
    /** API Base URL */
    api?: string;
    /** 文档链接 */
    doc?: string;
}

/**
 * Model 信息
 */
export interface Model {
    /** Model ID (e.g., 'gpt-4', 'claude-3.5-sonnet') */
    id: string;
    /** Model 名称 */
    name?: string;
    /** Model 家族 */
    family?: string;
    /** 定价信息 */
    cost?: {
        /** 输入成本 (per 1M tokens) */
        input?: number;
        /** 输出成本 (per 1M tokens) */
        output?: number;
    };
    /** 限制信息 */
    limit?: {
        /** 上下文长度 */
        context?: number;
        /** 最大输出长度 */
        output?: number;
    };
    /** 支持的模态 */
    modalities?: string[];
}

/**
 * ModelsDevAPI - models.dev API 客户端
 * 
 * 功能:
 * - 获取所有 Provider 列表
 * - 获取指定 Provider 的 Model 列表
 * - 缓存 API 响应（避免重复请求）
 */
export class ModelsDevAPI {
    private static readonly API_URL = 'https://models.dev/api.json';
    private logger: Logger;
    private cache: any = null;
    private cacheTimestamp: number = 0;
    private readonly CACHE_TTL = 1000 * 60 * 60; // 1 小时

    constructor() {
        this.logger = new Logger('ModelsDevAPI');
    }

    /**
     * 获取 Provider 列表
     */
    async fetchProviders(): Promise<Provider[]> {
        await this.ensureCache();
        return this.parseProviders(this.cache);
    }

    /**
     * 获取指定 Provider 的 Model 列表
     */
    async fetchModels(providerId: string): Promise<Model[]> {
        await this.ensureCache();
        return this.parseModels(this.cache, providerId);
    }

    /**
     * 获取指定 Model 的详细信息
     */
    async fetchModelInfo(providerId: string, modelId: string): Promise<Model | null> {
        const models = await this.fetchModels(providerId);
        return models.find((m) => m.id === modelId) || null;
    }

    /**
     * 确保缓存是最新的
     */
    private async ensureCache(): Promise<void> {
        const now = Date.now();

        // 如果缓存存在且未过期，直接返回
        if (this.cache && now - this.cacheTimestamp < this.CACHE_TTL) {
            return;
        }

        // 获取最新数据
        try {
            this.logger.info('Fetching models.dev API...');
            const response = await fetch(ModelsDevAPI.API_URL);

            if (!response.ok) {
                throw new Error(`Failed to fetch models.dev API: ${response.statusText}`);
            }

            this.cache = await response.json();
            this.cacheTimestamp = now;

            this.logger.info('models.dev API data cached', {
                providerCount: Object.keys(this.cache).length,
            });
        } catch (error) {
            this.logger.error('Failed to fetch models.dev API', { error });

            // 如果有旧缓存，继续使用
            if (this.cache) {
                this.logger.warn('Using stale cache data');
                return;
            }

            throw error;
        }
    }

    /**
     * 解析 Provider 列表
     */
    private parseProviders(data: any): Provider[] {
        if (!data) return [];

        return Object.entries(data).map(([id, info]: [string, any]) => ({
            id,
            name: info.name || id,
            npm: info.npm,
            env: info.env,
            api: info.api,
            doc: info.doc,
        }));
    }

    /**
     * 解析指定 Provider 的 Model 列表
     */
    private parseModels(data: any, providerId: string): Model[] {
        if (!data) return [];

        const provider = data[providerId];
        if (!provider || !provider.models) {
            this.logger.warn(`Provider not found: ${providerId}`);
            return [];
        }

        return Object.entries(provider.models).map(([id, info]: [string, any]) => ({
            id,
            name: info.name || id,
            family: info.family,
            cost: info.cost
                ? {
                    input: info.cost.input,
                    output: info.cost.output,
                }
                : undefined,
            limit: info.limit
                ? {
                    context: info.limit.context,
                    output: info.limit.output,
                }
                : undefined,
            modalities: info.modalities,
        }));
    }

    /**
     * 清除缓存（用于测试）
     */
    clearCache(): void {
        this.cache = null;
        this.cacheTimestamp = 0;
        this.logger.info('Cache cleared');
    }
}
