/**
 * Logger Config Domain
 */

/**
 * Logger 配置
 */
export interface LoggerConfig {
    /**
     * 每个 Desktop 最大系统日志条数
     * 
     * @default 100
     * @rationale 内存与调试信息的平衡。
     * @range [10, 10000]
     */
    readonly maxSystemLogs: number;

    /**
     * 每个 App 最大操作日志条数
     * 
     * @default 50
     * @rationale App 数量可能多，单 App 限制更严。
     * @range [10, 10000]
     */
    readonly maxAppLogs: number;
}

/**
 * Logger 默认配置
 */
export const LOGGER_DEFAULTS: LoggerConfig = {
    maxSystemLogs: 100,
    maxAppLogs: 50,
} as const;
