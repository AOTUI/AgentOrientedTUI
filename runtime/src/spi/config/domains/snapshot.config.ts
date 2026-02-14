/**
 * Snapshot Config Domain
 */

/**
 * Snapshot 配置
 */
export interface SnapshotConfig {
    /**
     * Snapshot 生存时间（毫秒）
     * 
     * @default 600000 (10 minutes)
     * @rationale 必须覆盖复杂对话场景的上下文窗口时间。
     * @range [60000, Infinity]
     */
    readonly ttlMs: number;
}

/**
 * Snapshot 默认配置
 */
export const SNAPSHOT_DEFAULTS: SnapshotConfig = {
    ttlMs: 10 * 60 * 1000,
} as const;
