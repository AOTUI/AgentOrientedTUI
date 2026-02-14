/**
 * SPI Layer - Snapshot Types
 * 
 * 定义快照相关的类型。
 */

import type { SnapshotID, IndexMap } from './types.js';

/**
 * [RFC-014] App 状态片段
 * 
 * 单个 App 的渲染内容，用于语义分离的多消息结构
 */
export interface AppStateFragment {
    appId: string;
    appName: string;
    markup: string;
    timestamp?: number;
    /** [RFC-014] 消息角色 (user/assistant) */
    role?: 'user' | 'assistant';
}

/**
 * [RFC-014] 结构化快照 - 语义分离的内容片段
 * 
 * 将 TUI 状态按语义分离为：
 * - Who/Why/How (systemInstruction) - 100% 稳定的元指令
 * - Where (desktopState) - Desktop 状态
 * - When (appStates) - 各 App 的当前状态
 */
export interface StructuredSnapshot {
    /** Who/Why/How - 100% 稳定的元指令 */
    systemInstruction: string;

    /** Where - Desktop 状态 (Apps 列表, System Logs) */
    desktopState: string;

    /** When - 各 App 的当前状态 */
    appStates: AppStateFragment[];
}

/**
 * 缓存的快照
 */
export interface CachedSnapshot {
    id: SnapshotID;

    /** [向后兼容] 完整的 markup (Desktop + Apps) */
    markup: string;

    /** [RFC-014] 结构化内容，用于语义分离的多消息 Prompt */
    structured?: StructuredSnapshot;

    indexMap: IndexMap;
    createdAt: number;
    refCount: number;
    /** Time-to-live in milliseconds. Snapshot should be invalidated after expiry. */
    ttl?: number;
    /** Absolute expiration timestamp. Computed as createdAt + ttl. */
    expiresAt?: number;
}

/**
 * 检查快照是否已过期
 * 
 * @param snapshot - 要检查的快照
 * @returns 如果已过期返回 true，如果没有 TTL 则返回 false（永不过期）
 */
export function isSnapshotExpired(snapshot: CachedSnapshot): boolean {
    if (snapshot.expiresAt === undefined) {
        return false; // No TTL means never expires
    }
    return Date.now() > snapshot.expiresAt;
}
