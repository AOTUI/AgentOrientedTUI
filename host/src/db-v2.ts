/**
 * @aotui/host - Database V2
 * 
 * 直接存储 AI SDK v6 的 ModelMessage
 * 
 * 设计原则:
 * - ✅ 完全对齐 AI SDK v6
 * - ✅ 零转换成本
 * - ✅ 极简 schema
 */

import type { Database } from 'sql.js';
import type { Message, MessageRow, Topic, Project } from './types-v2.js';
import { messageToRow, rowToMessage } from './types-v2.js';

// ============================================================================
// Messages CRUD
// ============================================================================

/**
 * 创建消息 (V2 格式)
 * 
 * 直接存储 AI SDK v6 的 ModelMessage
 */
export function createMessageV2(db: Database, topicId: string, message: Message): void {
    const row = messageToRow(topicId, message);

    db.run(`
        INSERT INTO messages_v2 (id, topic_id, role, content, timestamp, provider_options)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        row.id,
        row.topic_id,
        row.role,
        row.content,
        row.timestamp,
        row.provider_options || null
    ]);
}

/**
 * 获取话题的所有消息 (V2 格式)
 */
export function getMessagesV2(db: Database, topicId: string): Message[] {
    const stmt = db.prepare('SELECT * FROM messages_v2 WHERE topic_id = ? ORDER BY timestamp ASC');
    stmt.bind([topicId]);

    const messages: Message[] = [];
    while (stmt.step()) {
        const row = stmt.getAsObject() as unknown as MessageRow;
        messages.push(rowToMessage(row));
    }
    stmt.free();

    return messages;
}

/**
 * 获取单条消息 (V2 格式)
 */
export function getMessageV2(db: Database, id: string): Message | null {
    const stmt = db.prepare('SELECT * FROM messages_v2 WHERE id = ?');
    stmt.bind([id]);

    if (stmt.step()) {
        const row = stmt.getAsObject() as unknown as MessageRow;
        stmt.free();
        return rowToMessage(row);
    }

    stmt.free();
    return null;
}

/**
 * 删除消息 (V2 格式)
 */
export function deleteMessageV2(db: Database, id: string): void {
    db.run('DELETE FROM messages_v2 WHERE id = ?', [id]);
}

/**
 * 更新消息 (V2 格式)
 */
export function updateMessageV2(db: Database, topicId: string, message: Message): void {
    const row = messageToRow(topicId, message);

    db.run(`
        UPDATE messages_v2
        SET role = ?, content = ?, timestamp = ?, provider_options = ?
        WHERE id = ? AND topic_id = ?
    `, [
        row.role,
        row.content,
        row.timestamp,
        row.provider_options || null,
        row.id,
        row.topic_id,
    ]);
}

/**
 * 批量获取所有话题的消息 (V2 格式)
 */
export function getAllMessagesGroupedByTopicV2(db: Database): Map<string, Message[]> {
    const stmt = db.prepare('SELECT * FROM messages_v2 ORDER BY timestamp ASC');

    const result = new Map<string, Message[]>();
    while (stmt.step()) {
        const row = stmt.getAsObject() as unknown as MessageRow;
        const message = rowToMessage(row);
        const topicId = row.topic_id;

        if (!result.has(topicId)) {
            result.set(topicId, []);
        }
        result.get(topicId)!.push(message);
    }
    stmt.free();

    return result;
}

// ============================================================================
// Schema Migration
// ============================================================================

/**
 * 创建 messages_v2 表
 */
export function createMessagesV2Table(db: Database): void {
    db.run(`
        CREATE TABLE IF NOT EXISTS messages_v2 (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            provider_options TEXT,
            FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
        );
        
        CREATE INDEX IF NOT EXISTS idx_messages_v2_topic_id ON messages_v2(topic_id);
        CREATE INDEX IF NOT EXISTS idx_messages_v2_timestamp ON messages_v2(timestamp);
    `);
}
