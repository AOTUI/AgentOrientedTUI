/**
 * @aotui/host - LLM Config Types
 * 
 * LLM 配置管理相关的类型定义
 */

import type { LLMConfig } from '@aotui/agent-driver-v2';

/**
 * LLM 配置存储格式 (数据库)
 */
export interface LLMConfigRecord {
    /** 配置 ID */
    id: number;
    /** 配置名称 */
    name: string;
    /** 模型标识符 (e.g., "gpt-4", "claude-3-5-sonnet-20241022") */
    model: string;
    /** Provider ID (可选, e.g., "openai", "anthropic") */
    providerId?: string;
    /** 自定义 Base URL (可选) */
    baseUrl?: string;
    /** API Key (加密存储) */
    apiKey?: string;
    /** Temperature (0-1) */
    temperature: number;
    /** Max Steps */
    maxSteps: number;
    /** 是否为激活配置 */
    isActive: boolean;
    /** 创建时间 */
    createdAt: number;
    /** 更新时间 */
    updatedAt: number;
}

/**
 * 可用的 Provider 信息
 */
export interface ProviderInfo {
    /** Provider ID */
    id: string;
    /** Provider 名称 */
    name: string;
    /** 默认 Base URL */
    defaultBaseUrl?: string;
    /** 是否需要 API Key */
    requiresApiKey: boolean;
    /** 支持的模型列表 */
    models?: string[];
}

/**
 * LLM 配置输入 (用户创建配置时)
 */
export interface LLMConfigInput {
    name: string;
    model: string;
    providerId?: string;
    baseUrl?: string;
    apiKey?: string;
    temperature?: number;
    maxSteps?: number;
    skipValidation?: boolean;
}

/**
 * 转换 LLMConfigRecord 为 AgentDriverV2 的 LLMConfig
 */
export function toLLMConfig(record: LLMConfigRecord): LLMConfig {
    // 构建完整的 model ID (格式: "providerId:modelId")
    let modelId = record.model;

    if (record.providerId) {
        const providerSlashPrefix = `${record.providerId}/`;
        const providerColonPrefix = `${record.providerId}:`;

        // models.dev 常见格式: "provider/model" -> "provider:model"
        if (modelId.startsWith(providerSlashPrefix)) {
            modelId = modelId.slice(providerSlashPrefix.length);
        }

        // 统一以 providerId 前缀输出，保留模型名中的层级与冒号后缀
        // 例如 openrouter + z-ai/glm-4.5-air:free -> openrouter:z-ai/glm-4.5-air:free
        if (!modelId.startsWith(providerColonPrefix)) {
            modelId = `${record.providerId}:${modelId}`;
        }
    }

    const config: LLMConfig = {
        model: modelId,
        temperature: record.temperature,
        maxSteps: record.maxSteps,
    };

    if (record.apiKey) {
        config.apiKey = record.apiKey;
    }

    if (record.providerId) {
        config.provider = {
            id: record.providerId,
        };

        if (record.baseUrl) {
            config.provider.baseURL = record.baseUrl;
        }
    }

    return config;
}

/**
 * 默认配置列表
 * 
 * 注意: 已移除默认配置，用户需要手动添加 Provider
 */
export const DEFAULT_CONFIGS: Omit<LLMConfigRecord, 'id' | 'createdAt' | 'updatedAt' | 'isActive'>[] = [];
