/**
 * @aotui/agent-driver-v2 - LLM Provider Factory
 *
 * 基于 Vercel AI SDK 的 Provider Factory Pattern
 *
 * 支持的 Providers:
 * - OpenAI (GPT-4, GPT-4-turbo, etc.)
 * - Anthropic Claude (claude-3.5-sonnet, claude-opus-4-5, etc.)
 * - Google Gemini (gemini-2.0-flash-exp, gemini-1.5-pro, etc.)
 * - xAI Grok (grok-3-beta, etc.)
 * - OpenAI-compatible (DeepSeek, Qwen, GLM, etc.)
 *
 * 设计原则:
 * - **开放封闭**: 易于添加新 Provider，无需修改 LLMClient
 * - **类型安全**: 基于 TypeScript 类型系统
 * - **统一接口**: 所有 Provider 返回相同的 LanguageModelV1 接口
 */
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import { Logger } from '../utils/logger.js';
const logger = new Logger('LLMProviderFactory');
/**
 * LLMProviderFactory - LLM Provider 工厂
 *
 * 根据 LLMConfig 创建对应的 Provider 实例
 */
export class LLMProviderFactory {
    /**
     * 创建 LLM Provider
     *
     * @param config - LLM 配置
     * @returns LanguageModel 实例
     * @throws Error 如果 provider 不支持
     */
    static create(config) {
        logger.info('Creating LLM provider:', {
            provider: config.provider,
            model: config.model,
            baseURL: config.baseURL,
        });
        switch (config.provider) {
            case 'openai':
                return createOpenAI({
                    apiKey: config.apiKey || process.env.OPENAI_API_KEY,
                    baseURL: config.baseURL,
                })(config.model);
            case 'anthropic':
                return createAnthropic({
                    apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
                    baseURL: config.baseURL,
                })(config.model);
            case 'google':
                return createGoogleGenerativeAI({
                    apiKey: config.apiKey || process.env.GOOGLE_API_KEY,
                    baseURL: config.baseURL,
                })(config.model);
            case 'xai':
                return createXai({
                    apiKey: config.apiKey || process.env.XAI_API_KEY,
                    baseURL: config.baseURL,
                })(config.model);
            case 'openai-compatible':
                // 兼容中国开源模型 (DeepSeek, Qwen, GLM 等)
                if (!config.baseURL) {
                    throw new Error('baseURL is required for openai-compatible provider');
                }
                return createOpenAI({
                    apiKey: config.apiKey || '',
                    baseURL: config.baseURL,
                })(config.model);
            default:
                throw new Error(`Unsupported LLM provider: ${config.provider}`);
        }
    }
}
