/**
 * @aotui/host - LLM Config Service
 * 
 * LLM 配置管理服务
 * 
 * 职责:
 * - 管理 LLM Provider 配置
 * - 提供配置 CRUD 接口
 * - 管理激活配置
 * - (未来) API Key 加密存储
 */

import type { LLMConfig } from '@aotui/agent-driver-v2';
import type { LLMConfigRecord, LLMConfigInput, ProviderInfo } from '../types/llm-config.js';
import { toLLMConfig, DEFAULT_CONFIGS } from '../types/llm-config.js';
import * as llmConfigDb from '../db/llm-config-db.js';
import { getDb } from '../db/index.js';
import { Logger } from '../utils/logger.js';
import type { ModelRegistry } from '../services/model-registry.js';

/**
 * LLM Config Service
 */
export class LLMConfigService {
    private logger: Logger;
    private modelRegistry: ModelRegistry;

    constructor(modelRegistry: ModelRegistry) {
        this.logger = new Logger('LLMConfigService');
        this.modelRegistry = modelRegistry;
    }

    /**
     * 获取当前激活的 LLM 配置
     * 
     * 如果没有激活配置,返回 null
     */
    async getActiveLLMConfig(): Promise<LLMConfig | null> {
        const db = getDb();
        const record = llmConfigDb.getActiveLLMConfig(db);

        if (!record) {
            this.logger.warn('No active LLM config found');
            return null;
        }

        // 如果配置有 providerId 但没有 baseUrl，尝试自动填充
        if (record.providerId && !record.baseUrl) {
            const filledBaseUrl = await this.resolveBaseUrl(record.providerId, record.baseUrl);
            if (filledBaseUrl) {
                record.baseUrl = filledBaseUrl;

                // 更新数据库中的配置（避免下次再查询）
                llmConfigDb.updateLLMConfig(db, record.id, {
                    baseUrl: record.baseUrl,
                });
            }
        }

        this.logger.debug('Active LLM config loaded', { 
            model: record.model,
            providerId: record.providerId,
            baseUrl: record.baseUrl,
        });
        const llmConfig = toLLMConfig(record);
        const toolCallCapability = await this.resolveToolCallCapability(record.providerId, record.model);
        if (toolCallCapability !== undefined) {
            llmConfig.modelCapabilities = {
                ...llmConfig.modelCapabilities,
                toolCall: toolCallCapability,
            };
        }

        return llmConfig;
    }

    /**
     * 获取当前激活的配置记录
     */
    getActiveLLMConfigRecord(): LLMConfigRecord | null {
        const db = getDb();
        return llmConfigDb.getActiveLLMConfig(db);
    }

    /**
     * 获取所有 LLM 配置
     */
    getAllConfigs(): LLMConfigRecord[] {
        const db = getDb();
        return llmConfigDb.getAllLLMConfigs(db);
    }

    /**
     * 获取单个配置
     */
    getConfig(id: number): LLMConfigRecord | null {
        const db = getDb();
        return llmConfigDb.getLLMConfig(db, id);
    }

    /**
     * 创建新的 LLM 配置
     */
    async createConfig(input: LLMConfigInput): Promise<LLMConfigRecord> {
        // 如果提供了 providerId 但没有 baseUrl，自动从 ModelRegistry 获取
        if (input.providerId && !input.baseUrl) {
            input.baseUrl = await this.resolveBaseUrl(input.providerId, input.baseUrl);
        }

        // 验证模型（如果提供了 providerId）
        if (input.providerId) {
            const isValid = await this.validateModel(
                input.providerId,
                input.model,
                input.skipValidation || false
            );
            
            if (!isValid && !input.skipValidation) {
                throw new Error(
                    `Model "${input.model}" not found in provider "${input.providerId}". ` +
                    `Please select a valid model or enable "Custom Model" option.`
                );
            }
        }
        
        const db = getDb();
        const record = llmConfigDb.createLLMConfig(db, input);

        this.logger.info('LLM config created', { 
            id: record.id, 
            name: record.name,
            providerId: record.providerId,
            baseUrl: record.baseUrl,
        });
        return record;
    }

    /**
     * 验证模型是否存在于 ModelRegistry
     * 
     * @param providerId - Provider ID (如 'anthropic')
     * @param modelId - 模型 ID (如 'claude-3-5-sonnet-20241022')
     * @param skipValidation - 是否跳过验证（用于自定义模型）
     * @returns 验证结果
     */
    async validateModel(
        providerId: string,
        modelId: string,
        skipValidation: boolean = false
    ): Promise<boolean> {
        if (skipValidation) {
            this.logger.debug('Model validation skipped', { providerId, modelId });
            return true;
        }

        try {
            const models = await this.modelRegistry.getModels({ providerId });

            const exists = models.some((model) => this.matchesModelId(model.id, providerId, modelId));
            
            if (exists) {
                this.logger.debug('Model validated successfully', { providerId, modelId });
            } else {
                this.logger.warn('Model not found in registry', { providerId, modelId });
            }
            
            return exists;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isRegistryUnavailable =
                errorMessage.includes('models.dev') ||
                errorMessage.includes('Network error') ||
                errorMessage.includes('no cache available') ||
                errorMessage.includes('internet connection');

            if (isRegistryUnavailable) {
                this.logger.warn('Model registry unavailable, skipping model validation', {
                    providerId,
                    modelId,
                    error: errorMessage,
                });
                return true;
            }

            this.logger.error('Model validation failed', { error, providerId, modelId });
            // 验证失败时返回 false，但不抛出异常
            return false;
        }
    }

    /**
     * 获取模型的推荐配置
     * 
     * 根据模型能力（reasoning, tool_call）推荐合适的 temperature 和 maxSteps
     * 
     * @param providerId - Provider ID
     * @param modelId - 模型 ID
     * @returns 推荐的配置
     */
    async getModelRecommendedConfig(
        providerId: string,
        modelId: string
    ): Promise<{ temperature: number; maxSteps: number }> {
        try {
            const models = await this.modelRegistry.getModels({ providerId });

            // 查找模型（兼容 provider/model 与 vendor/model）
            const model = models.find((item) => this.matchesModelId(item.id, providerId, modelId));
            
            if (!model) {
                this.logger.debug('Model not found, using default config', { providerId, modelId });
                return { temperature: 0.7, maxSteps: 10 };
            }
            
            // 根据模型能力推荐配置
            let temperature = 0.7;
            let maxSteps = 10;
            
            // Reasoning 模型通常需要更低的 temperature 和更多的 steps
            if (model.reasoning) {
                temperature = 0.5;
                maxSteps = 20;
                this.logger.debug('Reasoning model detected, using lower temperature', {
                    modelId,
                    temperature,
                    maxSteps,
                });
            }
            
            // Tool-calling 模型可以使用标准配置
            if (model.tool_call && !model.reasoning) {
                temperature = 0.7;
                maxSteps = 10;
            }
            
            return { temperature, maxSteps };
        } catch (error) {
            this.logger.error('Failed to get model recommended config', { error, providerId, modelId });
            // 返回默认配置
            return { temperature: 0.7, maxSteps: 10 };
        }
    }

    private matchesModelId(registryModelId: string, providerId: string, inputModelId: string): boolean {
        const normalizedInput = inputModelId.trim();
        const candidates = new Set<string>([
            normalizedInput,
            `${providerId}/${normalizedInput}`,
        ]);

        const slashIndex = registryModelId.indexOf('/');
        if (slashIndex !== -1) {
            candidates.add(registryModelId.slice(slashIndex + 1));
        }

        return candidates.has(registryModelId) || candidates.has(normalizedInput) && registryModelId.endsWith(`/${normalizedInput}`);
    }

    /**
     * 设置激活配置
     */
    setActiveConfig(id: number): void {
        const db = getDb();
        llmConfigDb.setActiveLLMConfig(db, id);

        const record = llmConfigDb.getLLMConfig(db, id);
        this.logger.info('Active LLM config changed', { id, name: record?.name });
    }

    /**
     * 更新配置
     */
    async updateConfig(id: number, updates: Partial<LLMConfigInput>): Promise<void> {
        const db = getDb();
        const existing = llmConfigDb.getLLMConfig(db, id);
        if (!existing) {
            throw new Error(`LLM config not found: ${id}`);
        }

        const nextProviderId = updates.providerId ?? existing.providerId;
        const nextModel = updates.model ?? existing.model;
        const nextBaseUrl = updates.baseUrl ?? existing.baseUrl;

        const mergedUpdates: Partial<LLMConfigInput> = { ...updates };

        if (nextProviderId && !nextBaseUrl) {
            mergedUpdates.baseUrl = await this.resolveBaseUrl(nextProviderId, nextBaseUrl);
        }

        // 当 provider 或 model 发生变化时，重新校验模型
        if (nextProviderId && (updates.providerId !== undefined || updates.model !== undefined)) {
            const isValid = await this.validateModel(nextProviderId, nextModel, false);
            if (!isValid) {
                throw new Error(
                    `Model "${nextModel}" not found in provider "${nextProviderId}". ` +
                    `Please select a valid model or use a supported custom model value.`
                );
            }
        }

        llmConfigDb.updateLLMConfig(db, id, mergedUpdates);

        this.logger.info('LLM config updated', { id });
    }

    private async resolveBaseUrl(providerId: string, currentBaseUrl?: string): Promise<string | undefined> {
        if (currentBaseUrl) {
            return currentBaseUrl;
        }

        try {
            const providerConfig = await this.modelRegistry.getProviderConfig(providerId);
            if (providerConfig.baseURL) {
                this.logger.info('Auto-filled baseUrl from ModelRegistry', {
                    providerId,
                    baseUrl: providerConfig.baseURL,
                });
                return providerConfig.baseURL;
            }
        } catch (error) {
            this.logger.warn('Failed to get baseUrl from ModelRegistry', {
                providerId,
                error,
            });
        }

        return currentBaseUrl;
    }

    private async resolveToolCallCapability(
        providerId: string | undefined,
        modelId: string
    ): Promise<boolean | undefined> {
        if (!providerId) {
            return undefined;
        }

        try {
            const models = await this.modelRegistry.getModels({ providerId });
            const model = models.find((item) => this.matchesModelId(item.id, providerId, modelId));
            if (!model) {
                return undefined;
            }

            return model.tool_call === true;
        } catch (error) {
            this.logger.debug('Failed to resolve model tool-call capability', {
                providerId,
                modelId,
                error,
            });
            return undefined;
        }
    }

    /**
     * 删除配置
     */
    deleteConfig(id: number): void {
        const db = getDb();

        // 检查是否是激活配置
        const record = llmConfigDb.getLLMConfig(db, id);
        if (record?.isActive) {
            // 允许删除 active 配置，但先清除 active 状态
            // 这样用户就不需要先切换到另一个配置再删除
            this.logger.info('Deleting active config, clearing active state first', { id });
            
            // 清除所有配置的 active 状态
            const allConfigs = llmConfigDb.getAllLLMConfigs(db);
            allConfigs.forEach(config => {
                if (config.isActive) {
                    llmConfigDb.updateLLMConfig(db, config.id, { isActive: false });
                }
            });
        }

        llmConfigDb.deleteLLMConfig(db, id);
        this.logger.info('LLM config deleted', { id });
    }

    /**
     * 初始化默认配置
     * 
     * 注意: 已禁用自动创建默认配置，用户需要手动添加 Provider
     */
    initializeDefaultConfigs(): void {
        const db = getDb();
        const existing = llmConfigDb.getAllLLMConfigs(db);

        if (existing.length > 0) {
            this.logger.debug('LLM configs already exist, skipping initialization');
            return;
        }

        this.logger.info('No default configs to initialize (user must add providers manually)');
    }

    /**
     * 获取可用的 Providers
     * 
     * 从 models.dev 获取完整的 Provider 列表
     */
    async getAvailableProviders(): Promise<ProviderInfo[]> {
        try {
            // 动态导入 ModelRegistry (避免循环依赖)
            const { ModelRegistry } = await import('../services/model-registry.js');
            const registry = new ModelRegistry();

            // 获取 Provider Registry
            const providerRegistry = await registry.getProviderRegistry();

            // 从 registry 获取所有 providers
            // providerRegistry 是 createProviderRegistry 返回的对象
            // 它包含所有 provider 的配置
            const providers: ProviderInfo[] = [];

            // 常用的 providers (手动策划列表，确保用户体验)
            const popularProviders = [
                { id: 'openai', name: 'OpenAI', requiresApiKey: true },
                { id: 'anthropic', name: 'Anthropic', requiresApiKey: true },
                { id: 'google', name: 'Google AI', requiresApiKey: true },
                { id: 'xai', name: 'xAI (Grok)', requiresApiKey: true },
                { id: 'groq', name: 'Groq', requiresApiKey: true },
                { id: 'mistral', name: 'Mistral AI', requiresApiKey: true },
                { id: 'deepseek', name: 'DeepSeek', requiresApiKey: true },
                { id: 'cohere', name: 'Cohere', requiresApiKey: true },
            ];

            for (const provider of popularProviders) {
                providers.push({
                    id: provider.id,
                    name: provider.name,
                    requiresApiKey: provider.requiresApiKey,
                });
            }

            this.logger.info(`Loaded ${providers.length} providers from models.dev`);
            return providers;
        } catch (error) {
            this.logger.error('Failed to load providers from models.dev, using fallback', { error });

            // Fallback: 返回硬编码列表
            return [
                {
                    id: 'openai',
                    name: 'OpenAI',
                    requiresApiKey: true,
                    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
                },
                {
                    id: 'anthropic',
                    name: 'Anthropic',
                    requiresApiKey: true,
                    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
                },
                {
                    id: 'google',
                    name: 'Google',
                    requiresApiKey: true,
                    models: ['gemini-pro', 'gemini-1.5-pro'],
                },
                {
                    id: 'xai',
                    name: 'xAI',
                    requiresApiKey: true,
                    models: ['grok-beta'],
                },
            ];
        }
    }
}

// Singleton instance - initialized during application startup
// For tests, this will be mocked
export let llmConfigService: LLMConfigService = null as any;

/**
 * Initialize the singleton instance
 * Called from host-v2.ts during application startup
 */
export function initializeLLMConfigService(modelRegistry: ModelRegistry): LLMConfigService {
    llmConfigService = new LLMConfigService(modelRegistry);
    return llmConfigService;
}

/**
 * Get the singleton instance
 * Throws if not initialized
 */
export function getLLMConfigService(): LLMConfigService {
    if (!llmConfigService) {
        throw new Error('LLMConfigService not initialized. Call initializeLLMConfigService first.');
    }
    return llmConfigService;
}
