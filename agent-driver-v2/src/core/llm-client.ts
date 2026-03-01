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

import { streamText, type Tool, type ModelMessage } from 'ai';
import type { LLMConfig, LLMResponse } from './interfaces.js';
import { Logger } from '../utils/logger.js';
import { createLanguageModel, type ModelTarget } from './provider-factory.js';

/**
 * LLMClient - LLM 客户端
 * 
 * 设计原则:
 * - 直接使用 LLMConfig 中的完整配置
 * - 不依赖 ModelRegistry
 * - 支持主流 Provider (OpenAI, Anthropic, Google, xAI)
 * - 支持自定义 baseURL (兼容 OpenRouter 等)
 */
export class LLMClient {
    private logger: Logger;
    private config: LLMConfig;
    private modelId: string;

    constructor(config: LLMConfig) {
        this.config = config;
        this.logger = new Logger('LLMClient');

        // 解析 model 字符串并标准化为 providerId:modelId
        this.modelId = this.resolveModelTarget(config.model).registryModelId;

        this.logger.info('LLMClient initialized', {
            model: this.modelId,
            hasCustomConfig: !!config.provider,
            providerId: config.provider?.id,
            baseURL: config.provider?.baseURL,
            hasApiKey: !!config.apiKey,
        });
    }

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
    private resolveModelTarget(model: string): ModelTarget {
        const configuredProviderId = this.config.provider?.id;
        const normalizedModel = model.trim();

        if (configuredProviderId) {
            const colonPrefix = `${configuredProviderId}:`;
            const slashPrefix = `${configuredProviderId}/`;
            const modelName = normalizedModel.startsWith(colonPrefix)
                ? normalizedModel.slice(colonPrefix.length)
                : normalizedModel.startsWith(slashPrefix)
                    ? normalizedModel.slice(slashPrefix.length)
                    : normalizedModel;

            return {
                providerId: configuredProviderId,
                modelName,
                registryModelId: `${configuredProviderId}:${modelName}`,
            };
        }

        // 1. 标准格式: providerId:modelId（只按第一个冒号分割，保留 model 中的其他冒号）
        const separatorIndex = normalizedModel.indexOf(':');
        if (separatorIndex > 0) {
            const providerId = normalizedModel.slice(0, separatorIndex);
            const modelName = normalizedModel.slice(separatorIndex + 1);
            return {
                providerId,
                modelName,
                registryModelId: `${providerId}:${modelName}`,
            };
        }

        // 2. 兼容格式: providerId/modelId
        if (normalizedModel.includes('/')) {
            const slashIndex = normalizedModel.indexOf('/');
            if (slashIndex > 0) {
                const providerId = normalizedModel.slice(0, slashIndex);
                const modelName = normalizedModel.slice(slashIndex + 1);
                return {
                    providerId,
                    modelName,
                    registryModelId: `${providerId}:${modelName}`,
                };
            }
        }

        // 3. 否则，推断 provider 并使用冒号格式
        const providerId = this.inferProviderFromModel(normalizedModel);
        return {
            providerId,
            modelName: normalizedModel,
            registryModelId: `${providerId}:${normalizedModel}`,
        };
    }

    /**
     * 从 Model 名称推断 Provider
     * 
     * 这是向后兼容的 fallback 逻辑
     */
    private inferProviderFromModel(model: string): string {
        if (model.startsWith('gpt-') || model.startsWith('o1-') || model.startsWith('o3-')) {
            return 'openai';
        }
        if (model.startsWith('claude-')) {
            return 'anthropic';
        }
        if (model.startsWith('gemini-')) {
            return 'google';
        }
        if (model.startsWith('grok-')) {
            return 'xai';
        }

        // 默认 openai
        this.logger.warn(`Cannot infer provider for model: ${model}, defaulting to openai`);
        return 'openai';
    }

    /**
     * 创建 Provider 实例
     * 
     * 根据 LLMConfig 创建对应的 Provider
     */
    private createProvider() {
        const target = this.resolveModelTarget(this.config.model);
        return createLanguageModel({
            config: this.config,
            target,
            warn: (message) => this.logger.warn(message),
        });
    }

    /**
     * 调用 LLM
     *
     * @param messages - 消息列表
     * @param tools - 工具定义
     * @param callbacks - 流式回调 (可选)
     * @param callbacks.onTextDelta - 当 LLM 逐 token 输出文本时触发
     * @param callbacks.onReasoningDelta - 当 LLM 逐 token 输出推理时触发
     */
    async call(
        messages: ModelMessage[],
        tools: Record<string, Tool>,
        callbacks?: {
            onTextDelta?: (delta: string) => void;
            onReasoningDelta?: (delta: string) => void;
        }
    ): Promise<LLMResponse> {
        try {
            messages = this.applyInputCapabilityGuard(messages);
            const shouldDisableTools =
                this.config.modelCapabilities?.toolCall === false &&
                Object.keys(tools).length > 0;
            const effectiveTools = shouldDisableTools ? {} : tools;

            if (shouldDisableTools) {
                this.logger.warn('Tool calls disabled by model capability metadata', {
                    model: this.modelId,
                    reason: 'models.dev.tool_call=false',
                });
            }

            this.logger.info('Calling LLM', {
                model: this.modelId,
                messageCount: messages.length,
                toolCount: Object.keys(effectiveTools).length,
            });

            console.log('\n=== LLM Messages ===');
            console.log(JSON.stringify(messages, null, 2));
            // 打印所有工具的名称
            console.log('Tools:', Object.keys(effectiveTools));
            console.log('====================\n');
            
            // 创建 Provider 实例
            const model = this.createProvider();

            const result = await this.streamWithOpenRouterFallback(model, messages, effectiveTools);

            let text: string;
            let reasoningParts: Array<{ type: 'reasoning'; text: string }> = [];

            const isStreaming = !!(callbacks?.onTextDelta || callbacks?.onReasoningDelta);

            if (isStreaming) {
                // ═══════════════════════════════════════════════
                //  流式模式: 通过 fullStream 实时消费所有部分
                //
                //  关键: 不能在消费 textStream 之前 await result.reasoning,
                //  因为 AI SDK 的 Promise 属性会先内部消费整个 stream 再 resolve,
                //  导致 textStream 被提前耗尽，streaming delta 永远不会触发。
                //  使用 fullStream 同时获取 reasoning + text delta，一次完成。
                // ═══════════════════════════════════════════════
                text = '';
                let reasoningAccum = '';
                for await (const part of result.fullStream) {
                    switch (part.type) {
                        case 'text-delta':
                            text += (part as any).text ?? '';
                            if ((part as any).text) callbacks.onTextDelta?.((part as any).text);
                            break;
                        case 'reasoning-delta':
                            reasoningAccum += (part as any).text ?? '';
                            if ((part as any).text) callbacks.onReasoningDelta?.((part as any).text);
                            break;
                        // tool-call, finish 等由 await result.toolCalls 后续处理
                    }
                }
                if (reasoningAccum) {
                    reasoningParts = [{ type: 'reasoning', text: reasoningAccum }];
                }
            } else {
                // ═══════════════════════════════════════════════
                //  非流式模式: 先提取 reasoning，再等待完整文本
                // ═══════════════════════════════════════════════
                let reasoningText: string | undefined;
                try {
                    const reasoningValue = (result as any).reasoning;
                    if (reasoningValue) {
                        const resolvedReasoning = typeof reasoningValue === 'string'
                            ? reasoningValue
                            : await reasoningValue;
                        if (Array.isArray(resolvedReasoning)) {
                            reasoningParts = resolvedReasoning
                                .filter((part: any) => part && typeof part === 'object' && part.type === 'reasoning')
                                .map((part: any) => ({ type: 'reasoning' as const, text: String(part.text ?? '') }));
                        } else {
                            reasoningText = String(resolvedReasoning);
                        }
                    }
                } catch (error) {
                    this.logger.debug('Failed to read reasoning from LLM result', { error });
                }
                if (reasoningParts.length === 0 && reasoningText && reasoningText.trim().length > 0) {
                    reasoningParts = [{ type: 'reasoning', text: reasoningText }];
                }
                text = await result.text;
            }

            const reasoningString = reasoningParts.length > 0
                ? reasoningParts.map((part) => part.text).join('\n')
                : '';

            if (reasoningString.trim().length > 0) {
                console.log('\n=== LLM REASONING ===');
                console.log(reasoningString.slice(0, 400) + (reasoningString.length > 400 ? '...' : ''));
                console.log('=====================\n');
            }

            // stream 已被完整消费，以下 Promise 均已 resolve
            const toolCalls = (await result.toolCalls).map((tc) => ({
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: (tc as any).args ?? (tc as any).input,
            }));
            const finishReason = await result.finishReason;
            const usage = await result.usage;

            const hasText = typeof text === 'string' && text.trim().length > 0;
            const hasToolCalls = toolCalls.length > 0;
            let assistantMessage: ModelMessage | undefined;

            if (hasToolCalls || hasText) {
                const reasoningPart = reasoningParts;

                if (hasToolCalls) {
                    const contentParts = [
                        ...reasoningPart,
                        ...(hasText ? [{ type: 'text', text }] : []),
                        ...toolCalls.map((tc) => ({
                            type: 'tool-call' as const,
                            toolCallId: tc.toolCallId,
                            toolName: tc.toolName,
                            input: tc.args,
                        })),
                    ];

                    assistantMessage = {
                        role: 'assistant',
                        content: contentParts,
                    } as ModelMessage;
                } else if (reasoningPart.length > 0) {
                    assistantMessage = {
                        role: 'assistant',
                        content: [
                            ...reasoningPart,
                            ...(hasText ? [{ type: 'text', text }] : []),
                        ],
                    } as ModelMessage;
                } else {
                    assistantMessage = {
                        role: 'assistant',
                        content: text,
                    } as ModelMessage;
                }
            }

            const response: LLMResponse = {
                text,
                toolCalls,
                finishReason: finishReason || 'unknown',
                usage: usage
                    ? {
                        // AI SDK v6 usage 字段
                        promptTokens: (usage as any).promptTokens ?? 0,
                        completionTokens: (usage as any).completionTokens ?? 0,
                        totalTokens: (usage as any).totalTokens ?? 0,
                    }
                    : undefined,
                assistantMessage,
            };

            this.logger.info('LLM call completed', {
                textLength: text.length,
                toolCallCount: toolCalls.length,
                finishReason: response.finishReason,
                usage: response.usage,
            });
            
            // 🔍 打印 LLM 响应
            console.log('\n=== LLM RESPONSE ===');
            console.log('Text:', text.slice(0, 200) + (text.length > 200 ? '...' : ''));
            console.log('Tool Calls:', toolCalls.map(tc => ({ name: tc.toolName, args: tc.args })));
            console.log('Finish Reason:', response.finishReason);
            console.log('====================\n');

            return response;
        } catch (error) {
            this.logger.error('LLM call failed', { error });
            
            // 🔍 打印 API 请求中的 tools (从错误对象获取)
            if ((error as any).requestBodyValues?.tools) {
                console.log('\n=== Request Tools (from API error) ===');
                const requestTools = (error as any).requestBodyValues.tools;
                console.log('Total tools in request:', requestTools.length);
                
                // 打印前3个工具的完整结构
                for (let i = 0; i < Math.min(3, requestTools.length); i++) {
                    console.log(`\n[Tool ${i + 1}] ${requestTools[i].type || 'function'}:`, requestTools[i].function?.name);
                    console.log('  Parameters schema:');
                    console.log(JSON.stringify(requestTools[i].function?.parameters, null, 2));
                }
                console.log('=====================================\n');
            }
            
            throw error;
        }
    }

    private applyInputCapabilityGuard(messages: ModelMessage[]): ModelMessage[] {
        const supportsImage = this.config.modelCapabilities?.input?.image !== false;
        const supportsPdf = this.config.modelCapabilities?.input?.pdf !== false;

        const resolvePartModality = (part: any): 'image' | 'pdf' | null => {
            if (!part || typeof part !== 'object') {
                return null;
            }

            if (part.type === 'image') {
                return 'image';
            }

            if (part.type === 'file' && typeof part.mediaType === 'string') {
                if (part.mediaType.startsWith('image/')) {
                    return 'image';
                }
                if (part.mediaType === 'application/pdf') {
                    return 'pdf';
                }
            }

            return null;
        };

        const hasEmptyDataUrlPayload = (part: any): boolean => {
            if (!part || typeof part !== 'object') {
                return false;
            }

            const candidate = part.type === 'image'
                ? part.image
                : part.type === 'file'
                    ? part.data
                    : undefined;

            if (typeof candidate !== 'string' || !candidate.startsWith('data:')) {
                return false;
            }

            const match = candidate.match(/^data:[^;]+;base64,(.*)$/);
            return !!match && (!match[1] || match[1].length === 0);
        };

        return messages.map((message) => {
            if (message.role !== 'user' || !Array.isArray(message.content)) {
                return message;
            }

            const nextContent = (message.content as any[]).map((part: any) => {
                if (!part || typeof part !== 'object') {
                    return part;
                }

                const modality = resolvePartModality(part);
                if (!modality) {
                    return part;
                }

                if (hasEmptyDataUrlPayload(part)) {
                    return {
                        type: 'text' as const,
                        text: 'ERROR: Attachment is empty or corrupted. Please provide a valid file.',
                    };
                }

                const supported = modality === 'image' ? supportsImage : supportsPdf;
                if (supported) {
                    return part;
                }

                const filename = typeof part.filename === 'string' && part.filename.trim().length > 0
                    ? `"${part.filename}"`
                    : (modality === 'pdf' ? 'this PDF' : 'this image');
                return {
                    type: 'text' as const,
                    text: `ERROR: Cannot read ${filename} (current model does not support ${modality} input). Inform the user.`,
                };
            });

            return {
                ...message,
                content: nextContent,
            };
        });
    }

    private async streamWithOpenRouterFallback(
        model: any,
        messages: ModelMessage[],
        tools: Record<string, Tool>
    ) {
        try {
            return await streamText({
                model,
                messages,
                tools,
                temperature: this.config.temperature ?? 0.7,
            });
        } catch (error) {
            const shouldRetryWithoutTools =
                this.modelId.startsWith('openrouter:') &&
                Object.keys(tools).length > 0 &&
                this.isLikelyToolCompatibilityError(error);

            if (!shouldRetryWithoutTools) {
                throw error;
            }

            this.logger.warn('OpenRouter tool-call compatibility issue detected, retrying without tools', {
                model: this.modelId,
                error: error instanceof Error ? error.message : String(error),
            });

            return await streamText({
                model,
                messages,
                tools: {},
                temperature: this.config.temperature ?? 0.7,
            });
        }
    }

    private isLikelyToolCompatibilityError(error: unknown): boolean {
        const errorText = [
            (error as any)?.message,
            (error as any)?.responseBody,
            (error as any)?.data?.error?.message,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return (
            errorText.includes('tool') ||
            errorText.includes('function') ||
            errorText.includes('no output generated') ||
            errorText.includes('invalid')
        );
    }
}
