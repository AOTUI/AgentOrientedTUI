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
import { createProviderRegistry } from 'ai';
/**
 * models.dev API 数据结构
 */
export interface ModelsDevModel {
    id: string;
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
    api?: string;
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
export declare class ModelRegistry {
    private logger;
    private modelsDevData;
    private lastFetch;
    private cacheTTL;
    private providerRegistry;
    constructor();
    /**
     * 获取 Vercel AI SDK Provider Registry
     *
     * 复用 AI SDK 的 createProviderRegistry，动态注册所有 Provider
     */
    getProviderRegistry(): Promise<ReturnType<typeof createProviderRegistry>>;
    /**
     * 获取 Provider 配置
     *
     * @param providerId - Provider ID (如 'anthropic')
     * @returns Provider 配置 (baseURL, envKeys, supportedModels)
     */
    getProviderConfig(providerId: string): Promise<ProviderConfig>;
    /**
     * 获取模型列表
     *
     * @param filter - 过滤条件 (可选)
     * @returns 模型列表
     */
    getModels(filter?: ModelFilter): Promise<ModelsDevModel[]>;
    /**
     * 获取 Provider 列表
     */
    getProviders(): Promise<Array<{
        id: string;
        name: string;
        baseURL: string;
        modelCount: number;
    }>>;
    /**
     * 确保数据新鲜（超过 TTL 则重新获取）
     */
    private ensureFresh;
    /**
     * 从 models.dev 获取模型数据
     */
    private fetchModelsDevData;
    /**
     * 获取 Provider 的 API Key (从环境变量)
     */
    private getProviderApiKey;
}
