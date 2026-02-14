/**
 * Lock Config Domain
 */

/**
 * Lock 配置
 */
export interface LockConfig {
    /**
     * 锁过期时间（毫秒）
     * 
     * @default 300000 (5 minutes)
     * @rationale 必须足够长，覆盖最长 Agent 操作链。
     * @range [60000, Infinity]
     */
    readonly ttlMs: number;
}

/**
 * Lock 默认配置
 */
export const LOCK_DEFAULTS: LockConfig = {
    ttlMs: 5 * 60 * 1000,
} as const;
