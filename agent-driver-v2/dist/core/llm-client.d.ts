/**
 * @aotui/agent-driver-v2 - LLM Client
 *
 * 基于 Vercel AI SDK 的 LLM 客户端
 *
 * 设计原则:
 * - 使用 @ai-sdk/openai，支持自定义 baseURL (兼容 models.dev, OpenRouter 等)
 * - 支持用户自定义 LLM Provider 和 Model
 * - 类型安全的 ToolCall 处理
 */
import { type Tool, type ModelMessage } from 'ai';
import type { LLMConfig, LLMResponse } from './interfaces.js';
/**
 * LLMClient - LLM 客户端
 *
 * 设计原则:
 * - 直接使用 LLMConfig 中的完整配置
 * - 不依赖 ModelRegistry
 * - 支持主流 Provider (OpenAI, Anthropic, Google, xAI)
 * - 支持自定义 baseURL (兼容 OpenRouter 等)
 */
export declare class LLMClient {
    private logger;
    private config;
    private modelId;
    constructor(config: LLMConfig);
    /**
     * 解析 Model ID
     *
     * 支持 Vercel AI SDK ProviderRegistry 格式: 'providerId:modelId' (冒号)
     * - 'openai:gpt-4'
     * - 'anthropic:claude-3.5-sonnet'
     *
     * 如果只提供 model 名称 (如 'gpt-4')，将自动补全为 'openai:gpt-4'
     *
     * 注意: 也支持旧格式 'provider/model'，会自动转换为冒号格式
     */
    private resolveModelTarget;
    /**
     * 从 Model 名称推断 Provider
     *
     * 这是向后兼容的 fallback 逻辑
     */
    private inferProviderFromModel;
    /**
     * 创建 Provider 实例
     *
     * 根据 LLMConfig 创建对应的 Provider
     */
    private createProvider;
    /**
     * 调用 LLM
     */
    call(messages: ModelMessage[], tools: Record<string, Tool>): Promise<LLMResponse>;
    private streamWithOpenRouterFallback;
    private isLikelyToolCompatibilityError;
}
