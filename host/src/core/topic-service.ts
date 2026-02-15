/**
 * Topic Service
 * 
 * Business logic for Topic management, including:
 * - Context summary (summary, stage)
 * - Unread tracking
 */
import * as db from '../db/index.js';
import type { Topic, Message } from '../types.js';

// ============ Topic Context ============

/**
 * Update topic context (summary and/or stage)
 */
export function updateTopicContext(
    topicId: string,
    summary?: string,
    stage?: string
): void {
    const updates: Partial<Topic> = {
        updatedAt: Date.now()
    };

    if (summary !== undefined) {
        updates.summary = summary;
    }
    if (stage !== undefined) {
        updates.stage = stage;
    }

    db.updateTopic(topicId, updates);
}

/**
 * Get topic context
 */
export function getTopicContext(topicId: string): {
    summary?: string;
    stage?: string;
} {
    const topic = db.getTopic(topicId);
    return {
        summary: topic?.summary,
        stage: topic?.stage
    };
}

// ============ Unread Tracking ============

/**
 * Update last snapshot time for a topic
 */
export function updateLastSnapshotTime(topicId: string): void {
    db.updateTopic(topicId, {
        lastSnapshotTime: Date.now()
    });
}

/**
 * Get unread message count for a topic
 * 
 * Counts user messages received after the last snapshot time
 */
export function getUnreadCount(topicId: string): number {
    const topic = db.getTopic(topicId);
    if (!topic?.lastSnapshotTime) {
        // No snapshot yet, all user messages are "unread"
        const messages = db.getMessages(topicId);
        return messages.filter(m => m.role === 'user').length;
    }

    const messages = db.getMessages(topicId);
    return messages.filter(
        m => m.role === 'user' && m.timestamp > topic.lastSnapshotTime!
    ).length;
}

/**
 * Mark messages as unread based on last snapshot time
 */
export function markUnreadMessages(
    messages: Message[],
    lastSnapshotTime?: number
): (Message & { isUnread: boolean })[] {
    if (!lastSnapshotTime) {
        // If no snapshot time, mark all user messages as unread
        return messages.map(msg => ({
            ...msg,
            isUnread: msg.role === 'user'
        }));
    }

    return messages.map(msg => ({
        ...msg,
        isUnread: msg.role === 'user' && msg.timestamp > lastSnapshotTime
    }));
}
