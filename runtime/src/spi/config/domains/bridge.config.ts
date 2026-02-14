/**
 * Bridge Config Domain
 */

/**
 * Bridge 配置
 */
export interface BridgeConfig {
    /**
     * UpdateSignal 防抖时间（毫秒）
     * 
     * @default 300
     * @rationale 防止快速 DOM 变更产生的可观测信号噪音。
     *            300ms 是人类视觉感知的合理阈值。
     * @range [0, 5000]
     */
    readonly debounceMs: number;
}

/**
 * Bridge 默认配置
 */
export const BRIDGE_DEFAULTS: BridgeConfig = {
    debounceMs: 300,
} as const;
