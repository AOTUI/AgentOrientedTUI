/**
 * @aotui/host - HostDrivenSource V2
 * 
 * 完全对齐 AI SDK v6，零转换成本
 * 
 * 职责:
 * - ✅ 直接返回 AI SDK v6 的 ModelMessage
 * - ✅ 不做任何类型转换
 * - ✅ Host 只负责存储和检索
 */

import type { MessageWithTimestamp } from '@aotui/agent-driver-v2';
import EventEmitter from 'events';
import type { MessageServiceV2 } from '../core/message-service-v2.js';
import { dynamicTool, jsonSchema } from 'ai';

/**
 * Tool Result (临时定义，避免import问题)
 */
interface ToolResult {
    toolCallId: string;
    toolName: string;
    result?: unknown;
    error?: {
        code: string;
        message: string;
    };
}

interface CompactionPolicyInput {
    enabled?: boolean;
    maxContextTokens?: number;
    minMessages?: number;
    keepRecentMessages?: number;
    modelHint?: string;
}

/**
 * IDrivenSource (临时定义，避免跨项目import)
 */
interface IDrivenSource {
    readonly name: string;
    getMessages(): Promise<MessageWithTimestamp[]>;
    getTools(): Promise<Record<string, any>>;
    executeTool(toolName: string, args: unknown, toolCallId: string): Promise<ToolResult | undefined>;
    onUpdate(callback: () => void): () => void;
}

/**
 * HostDrivenSource V2 - 零转换版本
 */
export class HostDrivenSourceV2 implements IDrivenSource {
    readonly name = 'Host';
    private static readonly COMPACTION_TOOL_NAME = 'context_compact';
    private static readonly COMPACTION_TOOL_DESCRIPTION = [
        'Compact conversation context for long sessions while preserving continuity in GUI history.',
        '',
        'When to trigger compaction:',
        '- The active context has become long and noisy (many turns / many tool results).',
        '- Before starting a new subtask after completing a major milestone.',
        '- When you observe repeated context restatement or recall degradation.',
        '- Keep message protocol continuity intact (tool-call/tool-result sequence).',
        '',
        'How to compact (summary requirements):',
        '- You MUST provide the summary field when calling this tool.',
        '- Write a continuation-ready summary (not a generic recap), focused on next-step execution.',
        '- Include concrete file paths and unresolved decisions.',
        '',
        'Required summary template:',
        '---',
        '## Goal',
        '[What goal(s) is the user trying to accomplish?]',
        '',
        '## Instructions',
        '- [Important user instructions that remain relevant]',
        '- [Plan/spec constraints that must be preserved]',
        '',
        '## Discoveries',
        '[Notable findings useful for the next iteration]',
        '',
        '## Accomplished',
        '[Completed work, in-progress work, and remaining work]',
        '',
        '## Relevant files / directories',
        '[Structured list of relevant files/directories touched or required]',
        '---',
    ].join('\n');

    private eventEmitter = new EventEmitter();
    private topicId: string;

    constructor(
        private messageService: MessageServiceV2,
        topicId: string
    ) {
        this.topicId = topicId;
    }

    /**
     * 获取消息
     * 
     * ✅ 直接返回，零转换!
     */
    async getMessages(): Promise<MessageWithTimestamp[]> {
        const messages = await this.messageService.getMessagesForLLM(this.topicId);
        return messages.map((message) => ({
            ...message,
            region: message.region ?? 'session',
        }));
    }

    /**
     * 获取工具
     * 
     * Host 不提供工具
     */
    async getTools(): Promise<Record<string, any>> {
        const compactTool = dynamicTool({
            description: HostDrivenSourceV2.COMPACTION_TOOL_DESCRIPTION,
            inputSchema: jsonSchema({
                type: 'object',
                additionalProperties: false,
                properties: {
                    reason: {
                        type: 'string',
                        description: 'Optional reason for this compaction request (for traceability/observability).',
                    },
                    summary: {
                        type: 'string',
                        minLength: 1,
                        description: 'REQUIRED: LLM-generated continuation summary following the documented template.',
                    },
                    force: {
                        type: 'boolean',
                        description: 'Force compaction even when message window is small (useful for explicit/manual testing).',
                    },
                    minMessages: {
                        type: 'number',
                        minimum: 1,
                        description: 'Optional override for minimum messages required before compaction can run.',
                    },
                    keepRecentMessages: {
                        type: 'number',
                        minimum: 1,
                        description: 'Optional override for how many most-recent messages to preserve in detail.',
                    },
                },
                required: ['summary'],
            }),
            execute: async (_args: unknown) => {
                return 'Use AgentDriver executeTool routing for host context compaction.';
            },
        });

        return {
            [HostDrivenSourceV2.COMPACTION_TOOL_NAME]: compactTool,
        };
    }

    /**
     * 执行工具调用
     * 
     * Host 不执行工具
     */
    async executeTool(toolName: string, args: unknown, toolCallId: string): Promise<ToolResult | undefined> {
        if (toolName !== HostDrivenSourceV2.COMPACTION_TOOL_NAME) {
            return undefined;
        }

        const input = (args || {}) as {
            reason?: unknown;
            summary?: unknown;
            force?: unknown;
            minMessages?: unknown;
            keepRecentMessages?: unknown;
        };
        const reason = typeof input.reason === 'string' ? input.reason : undefined;
        const summary = typeof input.summary === 'string' ? input.summary.trim() : '';
        if (!summary) {
            return {
                toolCallId,
                toolName,
                result: {
                    success: false,
                    trigger: 'agent',
                    summary: '',
                    compactedMessageCount: 0,
                    cleanedToolResultCount: 0,
                    note: 'context_compact requires a non-empty summary. Provide a continuation summary using the required template.',
                },
            };
        }
        const force = input.force === true;
        const minMessages = Number.isInteger(input.minMessages) && (input.minMessages as number) > 0
            ? (input.minMessages as number)
            : undefined;
        const keepRecentMessages = Number.isInteger(input.keepRecentMessages) && (input.keepRecentMessages as number) > 0
            ? (input.keepRecentMessages as number)
            : undefined;
        const result = this.messageService.compactContext(this.topicId, {
            trigger: 'agent',
            reason,
            summary,
            minMessages: force ? 1 : minMessages,
            keepRecentMessages,
            createSyntheticMessages: false,
        });

        this.notifyNewMessage();

        return {
            toolCallId,
            toolName,
            result: {
                success: result.compacted,
                trigger: result.trigger,
                summary: result.summary,
                compactedMessageCount: result.compactedMessageCount,
                cleanedToolResultCount: result.cleanedToolResultCount,
                ...(result.compacted ? {} : {
                    note: 'Compaction skipped: active message window did not meet minMessages threshold. Set force=true to override for manual testing.',
                }),
            },
        };
    }

    public getCompactionToolName(): string {
        return HostDrivenSourceV2.COMPACTION_TOOL_NAME;
    }

    public runHardFallbackCompaction(reason?: string): {
        compacted: boolean;
        syntheticMessages: MessageWithTimestamp[];
        summary: string;
        compactedMessageCount: number;
        cleanedToolResultCount: number;
    };
    public runHardFallbackCompaction(reason: string | undefined, options: Pick<CompactionPolicyInput, 'minMessages' | 'keepRecentMessages'>): {
        compacted: boolean;
        syntheticMessages: MessageWithTimestamp[];
        summary: string;
        compactedMessageCount: number;
        cleanedToolResultCount: number;
    };
    public runHardFallbackCompaction(reason?: string, options?: Pick<CompactionPolicyInput, 'minMessages' | 'keepRecentMessages'>): {
        compacted: boolean;
        syntheticMessages: MessageWithTimestamp[];
        summary: string;
        compactedMessageCount: number;
        cleanedToolResultCount: number;
    } {
        const result = this.messageService.compactContext(this.topicId, {
            trigger: 'host_fallback',
            reason,
            createSyntheticMessages: true,
            minMessages: options?.minMessages,
            keepRecentMessages: options?.keepRecentMessages,
        });

        if (result.syntheticMessages.length > 0) {
            this.notifyNewMessage();
        }

        return {
            compacted: result.compacted,
            syntheticMessages: result.syntheticMessages,
            summary: result.summary,
            compactedMessageCount: result.compactedMessageCount,
            cleanedToolResultCount: result.cleanedToolResultCount,
        };
    }

    public maybeCompactByThreshold(policyInput?: CompactionPolicyInput): {
        compacted: boolean;
        syntheticMessages: MessageWithTimestamp[];
        summary: string;
        compactedMessageCount: number;
        cleanedToolResultCount: number;
        currentTokens: number;
        thresholdTokens: number;
    } {
        const options: Required<CompactionPolicyInput> = {
            enabled: true,
            maxContextTokens: 4_500,
            minMessages: 14,
            keepRecentMessages: 8,
            modelHint: '',
            ...(policyInput || {}),
        };

        if (!options.enabled) {
            return {
                compacted: false,
                syntheticMessages: [],
                summary: '',
                compactedMessageCount: 0,
                cleanedToolResultCount: 0,
                currentTokens: 0,
                thresholdTokens: options.maxContextTokens,
            };
        }

        const tokens = this.messageService.estimateContextTokens(this.topicId, options.modelHint || undefined);
        if (tokens < options.maxContextTokens) {
            return {
                compacted: false,
                syntheticMessages: [],
                summary: '',
                compactedMessageCount: 0,
                cleanedToolResultCount: 0,
                currentTokens: tokens,
                thresholdTokens: options.maxContextTokens,
            };
        }

        const compacted = this.runHardFallbackCompaction(
            `context tokens ${tokens} exceeded threshold ${options.maxContextTokens}`,
            {
                minMessages: options.minMessages,
                keepRecentMessages: options.keepRecentMessages,
            },
        );

        return {
            ...compacted,
            currentTokens: tokens,
            thresholdTokens: options.maxContextTokens,
        };
    }

    public markToolCompactionAnchor(messageId: string, summary?: string): void {
        this.messageService.markCompactionAnchor(this.topicId, messageId, summary);
    }

    /**
     * 订阅更新事件
     */
    onUpdate(callback: () => void): () => void {
        this.eventEmitter.on('message', callback);
        return () => this.eventEmitter.off('message', callback);
    }

    /**
     * 通知有新消息
     */
    notifyNewMessage(): void {
        this.eventEmitter.emit('message');
    }

    /**
     * 切换主题
     */
    switchTopic(topicId: string): void {
        this.topicId = topicId;
        this.notifyNewMessage();
    }
}
