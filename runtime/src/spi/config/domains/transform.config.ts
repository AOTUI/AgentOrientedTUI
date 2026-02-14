/**
 * Transform Config Domain
 */

/**
 * Transformer 配置
 */
export interface TransformConfig {
    /**
     * DOM 变更观察节流时间（毫秒）
     * 
     * @default 16
     * @rationale 模拟 ~60fps 的刷新率，平衡响应性与性能。
     * @range [0, 1000]
     */
    readonly domThrottleMs: number;

    /**
     * View Tree 最大深度
     * 
     * @default 20
     * @rationale 防止无限递归和栈溢出。20 层对于 TUI 应用足够深。
     * @range [1, 100]
     */
    readonly maxTreeDepth: number;
}

/**
 * Transform 默认配置
 */
export const TRANSFORM_DEFAULTS: TransformConfig = {
    domThrottleMs: 16,
    maxTreeDepth: 20,
} as const;
