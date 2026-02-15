/**
 * Host - Model Registry Service
 * 
 * 基于 models.dev 和 Vercel AI SDK 的模型注册表
 * 
 * 设计原则:
 * - 复用 AI SDK 的 createProviderRegistry 和 Provider 数据模型
 * - 从 models.dev 获取模型元数据（定价、能力等）
 * - 提供统一的 Provider 配置和模型查询接口
 * - 支持缓存持久化到文件系统
 * - 提供降级策略（缓存 + 默认配置）
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createProviderRegistry } from 'ai';
import { Logger } from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * models.dev API 数据结构
 */
export interface ModelsDevModel {
    id: string; // e.g., "anthropic/claude-3.5-sonnet"
    name: string;
    family?: string;
    attachment?: boolean;
    reasoning?: boolean;
    tool_call?: boolean;
    temperature?: boolean;
    release_date?: string;
    last_updated?: string;
    modalities?: {
        input?: string[];
        output?: string[];
    };
    open_weights?: boolean;
    cost?: {
        input?: number;
        output?: number;
        cache_read?: number;
        cache_write?: number;
    };
    limit?: {
        context?: number;
        output?: number;
    };
}

/**
 * models.dev Provider 配置
 */
export interface ModelsDevProvider {
    id: string;
    name: string;
    env?: string[];
    npm?: string;
    api?: string; // baseURL
    doc?: string;
    models: Record<string, ModelsDevModel>;
}

/**
 * models.dev API 响应结构
 */
export interface ModelsDevAPI {
    [providerId: string]: ModelsDevProvider;
}

/**
 * Provider 配置信息
 */
export interface ProviderConfig {
    id: string;
    name: string;
    baseURL: string;
    envKeys: string[];
    supportedModels: string[];
}

/**
 * 模型过滤器
 */
export interface ModelFilter {
    providerId?: string;
    capability?: 'tool_call' | 'reasoning' | 'vision';
    maxInputCost?: number;
}

/**
 * 缓存状态
 */
export interface CacheStatus {
    lastFetch: number;
    isStale: boolean;
    providerCount: number;
    modelCount: number;
}

/**
 * 缓存数据结构
 */
interface CacheEntry {
    data: ModelsDevAPI;
    timestamp: number;
}

/**
 * ModelRegistry - 模型注册表
 * 
 * 职责:
 * - 从 models.dev 获取模型列表
 * - 缓存模型数据到文件系统 (避免重复请求)
 * - 提供 Provider 配置查询
 * - 提供模型列表查询 (用于 UI 选择器)
 * - 提供降级策略（缓存 + 默认配置）
 * 
 * 设计特点:
 * - 复用 AI SDK 的 createProviderRegistry
 * - 懒加载: 首次调用时才获取数据
 * - 缓存机制: 24小时 TTL，持久化到文件系统
 * - 降级策略: API 失败时使用缓存或默认配置
 */
export class ModelRegistry {
    private logger: Logger;
    private modelsDevData: ModelsDevAPI | null = null;
    private lastFetch: number = 0;
    private cacheTTL: number = 24 * 60 * 60 * 1000; // 24小时
    private providerRegistry: ReturnType<typeof createProviderRegistry> | null = null;
    private cacheDir: string;
    private cacheFile: string;

    constructor() {
        this.logger = new Logger('ModelRegistry');
        this.cacheDir = path.join(os.homedir(), '.aotui', 'cache');
        this.cacheFile = path.join(this.cacheDir, 'models-dev.json');
    }

    /**
     * 获取 Vercel AI SDK Provider Registry
     * 
     * 复用 AI SDK 的 createProviderRegistry，动态注册所有 Provider
     */
    async getProviderRegistry(): Promise<ReturnType<typeof createProviderRegistry>> {
        await this.ensureFresh();

        if (this.providerRegistry) {
            return this.providerRegistry;
        }

        // 构建 Provider Registry
        const providers: Record<string, any> = {};

        // 注册官方 Provider (使用 AI SDK 原生实例)
        // 使用动态导入以支持可选依赖
        try {
            const anthropicModule = await import('@ai-sdk/anthropic') as any;
            providers['anthropic'] = anthropicModule.createAnthropic({
                apiKey: process.env.ANTHROPIC_API_KEY || '',
            });
        } catch (error) {
            this.logger.debug('Anthropic SDK not available', { error });
        }

        providers['openai'] = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY || '',
        });

        try {
            const googleModule = await import('@ai-sdk/google') as any;
            providers['google'] = googleModule.google;
        } catch (error) {
            this.logger.debug('Google SDK not available', { error });
        }

        try {
            const xaiModule = await import('@ai-sdk/xai') as any;
            providers['xai'] = xaiModule.xai;
        } catch (error) {
            this.logger.debug('xAI SDK not available', { error });
        }

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
    async getProviderConfig(providerId: string): Promise<ProviderConfig> {
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
    async getModels(filter?: ModelFilter): Promise<ModelsDevModel[]> {
        await this.ensureFresh();

        let models: ModelsDevModel[] = [];

        // 按 provider 过滤 - 直接从指定 provider 获取模型
        if (filter?.providerId) {
            const provider = this.modelsDevData?.[filter.providerId];
            if (provider) {
                models = Object.values(provider.models);
            }
        } else {
            // 没有 provider 过滤时，提取所有模型
            if (this.modelsDevData) {
                const providers = Object.values(this.modelsDevData);
                providers.forEach((provider) => {
                    models.push(...Object.values(provider.models));
                });
            }
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
                return (m.cost?.input ?? Infinity) <= filter.maxInputCost!;
            });
        }

        return models;
    }

    /**
     * 获取 Provider 列表
     */
    async getProviders(): Promise<
        Array<{ id: string; name: string; baseURL: string; modelCount: number }>
    > {
        await this.ensureFresh();

        const providers: Array<{
            id: string;
            name: string;
            baseURL: string;
            modelCount: number;
        }> = [];

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
     * 刷新缓存（强制重新获取数据）
     */
    async refresh(): Promise<void> {
        this.logger.info('Refreshing model registry data...');
        this.lastFetch = 0; // 强制重新获取
        this.providerRegistry = null; // 清除 provider registry
        await this.fetchModelsDevData();
    }

    /**
     * 获取缓存状态
     */
    getCacheStatus(): CacheStatus {
        const now = Date.now();
        const isStale = !this.modelsDevData || now - this.lastFetch > this.cacheTTL;
        
        let providerCount = 0;
        let modelCount = 0;
        
        if (this.modelsDevData) {
            providerCount = Object.keys(this.modelsDevData).length;
            modelCount = Object.values(this.modelsDevData).reduce(
                (sum, provider) => sum + Object.keys(provider.models).length,
                0
            );
        }

        return {
            lastFetch: this.lastFetch,
            isStale,
            providerCount,
            modelCount,
        };
    }

    /**
     * 确保数据新鲜（超过 TTL 则重新获取）
     */
    private async ensureFresh(): Promise<void> {
        const now = Date.now();

        if (!this.modelsDevData || now - this.lastFetch > this.cacheTTL) {
            await this.fetchModelsDevData();
        }
    }

    /**
     * 从 models.dev 获取模型数据
     * 
     * 降级策略:
     * 1. 尝试从 models.dev API 获取
     * 2. 如果失败，尝试从本地缓存加载
     * 3. 如果缓存也不存在，抛出错误（让调用者处理）
     * 
     * 设计决策: 不使用硬编码的 "默认配置"
     * - models.dev 是快速更新的数据源（新模型频繁发布）
     * - 硬编码会导致维护负担和数据过时
     * - 缓存机制已经提供了足够的容错性
     */
    private async fetchModelsDevData(): Promise<void> {
        try {
            this.logger.info('Fetching data from models.dev...');

            const response = await fetch('https://models.dev/api.json', {
                signal: AbortSignal.timeout(10000), // 10秒超时（从5秒增加）
            });
            
            if (!response.ok) {
                throw new Error(`models.dev API error: ${response.statusText}`);
            }

            const data = await response.json();
            this.modelsDevData = data as ModelsDevAPI;
            this.lastFetch = Date.now();

            const totalModels = Object.values(this.modelsDevData).reduce(
                (sum, provider) => sum + Object.keys(provider.models).length,
                0
            );

            this.logger.info('models.dev data fetched', {
                providerCount: Object.keys(this.modelsDevData).length,
                modelCount: totalModels,
            });

            // 保存到缓存
            await this.saveCache(this.modelsDevData);
        } catch (error) {
            this.logger.error('Failed to fetch models.dev data', { error });

            // 降级策略: 尝试加载本地缓存
            const cached = await this.loadCache();
            if (cached) {
                this.modelsDevData = cached.data;
                this.lastFetch = cached.timestamp;
                
                const age = Date.now() - cached.timestamp;
                const ageHours = Math.floor(age / (60 * 60 * 1000));
                
                this.logger.info('Using cached models.dev data', {
                    age,
                    ageHours,
                    providerCount: Object.keys(cached.data).length,
                });
                return;
            }

            // 无法获取数据（API 失败 + 无缓存）
            throw new Error(
                'Failed to fetch models.dev data and no cache available. ' +
                'Please check your internet connection or try again later.'
            );
        }
    }

    /**
     * 保存缓存到文件系统
     */
    private async saveCache(data: ModelsDevAPI): Promise<void> {
        try {
            // 确保缓存目录存在
            await fs.mkdir(this.cacheDir, { recursive: true });

            const cacheEntry: CacheEntry = {
                data,
                timestamp: Date.now(),
            };

            await fs.writeFile(
                this.cacheFile,
                JSON.stringify(cacheEntry, null, 2),
                'utf-8'
            );

            this.logger.info('Cache saved', { path: this.cacheFile });
        } catch (error) {
            this.logger.error('Failed to save cache', { error });
        }
    }

    /**
     * 从文件系统加载缓存
     */
    private async loadCache(): Promise<CacheEntry | null> {
        try {
            const content = await fs.readFile(this.cacheFile, 'utf-8');
            const cacheEntry: CacheEntry = JSON.parse(content);

            this.logger.info('Cache loaded', {
                path: this.cacheFile,
                age: Date.now() - cacheEntry.timestamp,
            });

            return cacheEntry;
        } catch (error) {
            // 缓存文件不存在或读取失败
            this.logger.debug('Cache not found or invalid', { error });
            return null;
        }
    }

    /**
     * ❌ 已移除 getDefaultProviders()
     * 
     * 原因:
     * 1. models.dev 快速更新，硬编码会过时
     * 2. 维护负担：新模型频繁发布，版本更新
     * 3. 缓存机制已提供足够容错性
     * 
     * 替代方案:
     * - models.dev API (主要数据源)
     * - 本地缓存文件 (~/.aotui/cache/models-dev.json)
     * - 如果都失败，抛出明确错误，让用户知道网络问题
     */

    /**
     * 获取 Provider 的 API Key (从环境变量)
     */
    private getProviderApiKey(provider: ModelsDevProvider): string | undefined {
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
