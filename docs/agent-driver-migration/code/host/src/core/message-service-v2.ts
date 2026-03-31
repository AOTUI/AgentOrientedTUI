/**
 * @aotui/host - Message Service V2
 * 
 * 基于 AI SDK v6 ModelMessage 的消息服务
 */

import type { ModelMessage } from 'ai';
import type { Message } from '../types-v2.js';
import { createMessageId } from '../types-v2.js';
import * as dbV2 from '../db-v2.js';
import { getDb, persistDatabase } from '../db/index.js';

const COMPACTION_TOOL_NAME = 'context_compact';
const TOOL_RESULT_COMPACTED_PLACEHOLDER = '[Old tool result content cleared by context compaction]';

type CompactionTrigger = 'agent' | 'host_fallback';

interface CompactionOptions {
    trigger: CompactionTrigger;
    reason?: string;
    summary?: string;
    minMessages?: number;
    keepRecentMessages?: number;
    createSyntheticMessages?: boolean;
}

interface CompactionResult {
    compacted: boolean;
    trigger: CompactionTrigger;
    summary: string;
    compactedMessageCount: number;
    cleanedToolResultCount: number;
    syntheticMessages: Message[];
}

function toCompactionSummary(messages: Message[]): string {
    const recent = messages.slice(-12);
    const userNotes: string[] = [];
    const assistantNotes: string[] = [];

    for (const message of recent) {
        const text = extractDisplayText(message).trim();
        if (!text) continue;
        const clipped = text.length > 220 ? `${text.slice(0, 220)}...` : text;
        if (message.role === 'user') {
            userNotes.push(clipped);
        } else if (message.role === 'assistant') {
            assistantNotes.push(clipped);
        }
    }

    return [
        'Goal: Continue the current task with compacted context.',
        userNotes.length > 0
            ? `Recent user intents: ${userNotes.slice(-4).join(' | ')}`
            : 'Recent user intents: none captured.',
        assistantNotes.length > 0
            ? `Recent assistant progress: ${assistantNotes.slice(-4).join(' | ')}`
            : 'Recent assistant progress: none captured.',
        'Instruction: Continue from latest state, and ask for clarification if required details are missing.',
    ].join('\n');
}

function extractDisplayText(message: Message): string {
    if (typeof message.content === 'string') {
        return message.content;
    }

    if (!Array.isArray(message.content)) {
        return '';
    }

    const parts: string[] = [];
    for (const part of message.content as any[]) {
        if (!part || typeof part !== 'object') continue;
        if (part.type === 'text' || part.type === 'reasoning') {
            parts.push(String(part.text || ''));
            continue;
        }
        if (part.type === 'tool-call') {
            parts.push(`Tool call: ${part.toolName || 'unknown'}`);
            continue;
        }
        if (part.type === 'tool-result') {
            const output = part.output ?? part.result;
            if (typeof output === 'string') {
                parts.push(output);
            } else {
                parts.push(JSON.stringify(output));
            }
        }
    }

    return parts.join('\n').trim();
}

function estimateTokensFromText(text: string, modelHint?: string): number {
    if (!text) return 0;

    const cjkMatches = text.match(/[\u3400-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/g);
    const cjkRatio = cjkMatches ? cjkMatches.length / text.length : 0;

    let charsPerToken = 4;
    const model = (modelHint || '').toLowerCase();
    if (model.includes('gpt-4o') || model.includes('gpt-4.1') || model.includes('claude-3')) {
        charsPerToken = 3.6;
    } else if (model.includes('gemini') || model.includes('qwen') || model.includes('deepseek')) {
        charsPerToken = 3.4;
    }

    if (cjkRatio > 0.3) {
        charsPerToken = Math.min(charsPerToken, 1.9);
    }

    return Math.ceil(text.length / charsPerToken);
}

function isCompactionAnchor(message: Message): boolean {
    if ((message as any)._aotuiCompactionAnchor === true) {
        return true;
    }

    if (!Array.isArray(message.content)) {
        return false;
    }

    return (message.content as any[]).some((part) => {
        if (!part || typeof part !== 'object' || part.type !== 'tool-result') {
            return false;
        }
        return part.toolName === COMPACTION_TOOL_NAME;
    });
}

function isCompactionToolMessage(message: Message): boolean {
    if (!Array.isArray(message.content)) {
        return false;
    }

    return (message.content as any[]).some((part) => {
        if (!part || typeof part !== 'object') return false;
        if (part.type === 'tool-call' || part.type === 'tool-result') {
            return part.toolName === COMPACTION_TOOL_NAME;
        }
        return false;
    });
}

function compactToolResultContent(message: Message): { changed: boolean; nextMessage: Message; cleanedParts: number } {
    if (message.role !== 'tool' || !Array.isArray(message.content)) {
        return { changed: false, nextMessage: message, cleanedParts: 0 };
    }

    let cleanedParts = 0;
    const updatedParts = (message.content as any[]).map((part) => {
        if (!part || typeof part !== 'object' || part.type !== 'tool-result') {
            return part;
        }

        if (part.toolName === COMPACTION_TOOL_NAME) {
            return part;
        }

        const output = part.output ?? part.result;
        if (typeof output === 'string' && output === TOOL_RESULT_COMPACTED_PLACEHOLDER) {
            return part;
        }

        cleanedParts += 1;

        const nextPart: any = {
            ...part,
            output: TOOL_RESULT_COMPACTED_PLACEHOLDER,
            result: TOOL_RESULT_COMPACTED_PLACEHOLDER,
            metadata: {
                ...(part.metadata || {}),
                aotuiCompacted: true,
            },
        };

        return nextPart;
    });

    if (cleanedParts === 0) {
        return { changed: false, nextMessage: message, cleanedParts: 0 };
    }

    return {
        changed: true,
        cleanedParts,
        nextMessage: {
            ...message,
            content: updatedParts,
            timestamp: Date.now(),
        },
    };
}

/**
 * Message Service V2
 * 
 * 完全对齐 AI SDK v6，零转换成本
 */
export class MessageServiceV2 {
    /**
     * 获取话题的所有消息
     */
    getMessages(topicId: string): Message[] {
        try {
            const db = getDb();
            const messages = dbV2.getMessagesV2(db, topicId);
            console.log(`[MessageServiceV2] getMessages for topic ${topicId}: ${messages.length} messages`);
            return messages;
        } catch (error) {
            console.error('[MessageServiceV2] Failed to get messages:', error);
            return [];
        }
    }

    /**
     * 添加消息
     * 
     * @param topicId - 话题 ID
     * @param message - AI SDK v6 的 ModelMessage
     */
    addMessage(topicId: string, message: ModelMessage): Message {
        try {
            const db = getDb();

            const messageWithMeta: Message = {
                ...message,
                id: (message as any).id || createMessageId(),
                timestamp: (message as any).timestamp || Date.now(),
            } as Message;

            console.log(`[MessageServiceV2] addMessage to topic ${topicId}:`, {
                id: messageWithMeta.id,
                role: messageWithMeta.role,
                contentLength: typeof message.content === 'string' ? message.content.length : 'non-string'
            });

            dbV2.createMessageV2(db, topicId, messageWithMeta);
            
            // ✅ 持久化到磁盘
            persistDatabase();
            
            console.log(`[MessageServiceV2] Message saved and persisted to disk`);

            return messageWithMeta;
        } catch (error) {
            console.error('[MessageServiceV2] Failed to add message:', error);
            throw error;
        }
    }

    updateMessage(topicId: string, message: Message): Message {
        try {
            const db = getDb();
            dbV2.updateMessageV2(db, topicId, message);
            persistDatabase();
            return message;
        } catch (error) {
            console.error('[MessageServiceV2] Failed to update message:', error);
            throw error;
        }
    }

    getMessagesForLLM(topicId: string): Message[] {
        const messages = this.getMessages(topicId);
        if (messages.length === 0) {
            return messages;
        }

        let anchorIndex = -1;
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            if (isCompactionAnchor(messages[i])) {
                anchorIndex = i;
                break;
            }
        }

        if (anchorIndex < 0) {
            return messages;
        }

        let start = anchorIndex;
        if (messages[anchorIndex]?.role === 'tool' && anchorIndex > 0) {
            start = anchorIndex - 1;
        }

        return messages.slice(start);
    }

    estimateContextChars(topicId: string): number {
        const messages = this.getMessagesForLLM(topicId);
        return messages.reduce((total, message) => total + extractDisplayText(message).length, 0);
    }

    estimateContextTokens(topicId: string, modelHint?: string): number {
        const messages = this.getMessagesForLLM(topicId);
        return messages.reduce((total, message) => {
            const display = extractDisplayText(message);
            const roleOverhead = 6;
            const partOverhead = Array.isArray(message.content) ? message.content.length * 2 : 2;
            return total + estimateTokensFromText(display, modelHint) + roleOverhead + partOverhead;
        }, 0);
    }

    markCompactionAnchor(topicId: string, messageId: string, summary?: string): Message | null {
        const messages = this.getMessages(topicId);
        const target = messages.find((message) => message.id === messageId);
        if (!target) {
            return null;
        }

        const updatedRaw: any = {
            ...target,
            timestamp: Date.now(),
            ...(summary ? { _aotuiCompactionSummary: summary } : {}),
            _aotuiCompactionAnchor: true,
        };
        const updated = updatedRaw as Message;

        this.updateMessage(topicId, updated);
        return updated;
    }

    compactContext(topicId: string, options: CompactionOptions): CompactionResult {
        const minMessages = options.minMessages ?? 14;
        const keepRecentMessages = options.keepRecentMessages ?? 8;
        const createSyntheticMessages = options.createSyntheticMessages ?? false;

        const allMessages = this.getMessages(topicId);
        if (allMessages.length < minMessages) {
            return {
                compacted: false,
                trigger: options.trigger,
                summary: '',
                compactedMessageCount: 0,
                cleanedToolResultCount: 0,
                syntheticMessages: [],
            };
        }

        let lastAnchorIndex = -1;
        for (let i = allMessages.length - 1; i >= 0; i -= 1) {
            if (isCompactionAnchor(allMessages[i])) {
                lastAnchorIndex = i;
                break;
            }
        }

        const windowStart = lastAnchorIndex + 1;
        const activeWindow = allMessages.slice(windowStart);
        if (activeWindow.length < minMessages) {
            return {
                compacted: false,
                trigger: options.trigger,
                summary: '',
                compactedMessageCount: 0,
                cleanedToolResultCount: 0,
                syntheticMessages: [],
            };
        }

        const summary = options.summary?.trim() || toCompactionSummary(activeWindow);
        const cleanupBoundary = Math.max(windowStart, allMessages.length - keepRecentMessages);

        let cleanedToolResultCount = 0;
        for (let i = windowStart; i < cleanupBoundary; i += 1) {
            const message = allMessages[i];
            if (isCompactionToolMessage(message)) {
                continue;
            }

            const { changed, nextMessage, cleanedParts } = compactToolResultContent(message);
            if (!changed) {
                continue;
            }

            cleanedToolResultCount += cleanedParts;
            this.updateMessage(topicId, nextMessage);
        }

        const syntheticMessages: Message[] = [];
        if (createSyntheticMessages) {
            const compactCallId = `compact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const assistantCall = this.addMessage(topicId, {
                role: 'assistant',
                content: [
                    {
                        type: 'tool-call',
                        toolCallId: compactCallId,
                        toolName: COMPACTION_TOOL_NAME,
                        input: {
                            trigger: options.trigger,
                            reason: options.reason || 'host hard fallback before next user message',
                        },
                    },
                ],
            } as any);

            const toolResult = this.addMessage(topicId, {
                role: 'tool',
                content: [
                    {
                        type: 'tool-result',
                        toolCallId: compactCallId,
                        toolName: COMPACTION_TOOL_NAME,
                        result: {
                            success: true,
                            trigger: options.trigger,
                            summary,
                            compactedMessageCount: activeWindow.length,
                            cleanedToolResultCount,
                        },
                    },
                ],
            } as any);

            this.markCompactionAnchor(topicId, toolResult.id, summary);
            syntheticMessages.push(assistantCall, toolResult);
        }

        return {
            compacted: true,
            trigger: options.trigger,
            summary,
            compactedMessageCount: activeWindow.length,
            cleanedToolResultCount,
            syntheticMessages,
        };
    }

    /**
     * 删除消息
     */
    deleteMessage(id: string): void {
        try {
            const db = getDb();
            dbV2.deleteMessageV2(db, id);
            persistDatabase();
            console.log(`[MessageServiceV2] Message ${id} deleted and persisted`);
        } catch (error) {
            console.error('[MessageServiceV2] Failed to delete message:', error);
            throw error;
        }
    }

    /**
     * 批量获取所有话题的消息
     */
    getAllMessagesGroupedByTopic(): Map<string, Message[]> {
        try {
            const db = getDb();
            return dbV2.getAllMessagesGroupedByTopicV2(db);
        } catch (error) {
            console.error('[MessageServiceV2] Failed to get all messages:', error);
            return new Map();
        }
    }
}

// Singleton instance
export const messageServiceV2 = new MessageServiceV2();
