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
import type { LanguageModel } from 'ai';
import type { LLMConfig } from './interfaces.js';
/**
 * LLMProviderFactory - LLM Provider 工厂
 *
 * 根据 LLMConfig 创建对应的 Provider 实例
 */
export declare class LLMProviderFactory {
    /**
     * 创建 LLM Provider
     *
     * @param config - LLM 配置
     * @returns LanguageModel 实例
     * @throws Error 如果 provider 不支持
     */
    static create(config: LLMConfig): LanguageModel;
}
