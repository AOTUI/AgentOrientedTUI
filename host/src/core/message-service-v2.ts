/**
 * @aotui/host - Message Service V2
 * 
 * 基于 AI SDK v6 ModelMessage 的消息服务
 */

import type { ModelMessage } from 'ai';
import type { Message, Topic } from '../types-v2.js';
import { createMessageId } from '../types-v2.js';
import * as dbV2 from '../db-v2.js';
import { getDb, persistDatabase } from '../db/index.js';

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
