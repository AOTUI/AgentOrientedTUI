/**
 * Worker Config Domain
 */

/**
 * Worker 进程池配置
 */
export interface WorkerPoolConfig {
    /**
     * 初始/最小 Worker 数量
     * 
     * @default 2
     * @rationale 2 个预热 Worker 平衡了启动时间与资源占用。
     * @range [0, 100]
     */
    readonly initialSize: number;

    /**
     * 最大 Worker 数量
     * 
     * @default 10
     * @rationale 10 是典型服务器 CPU 核心数的上限。
     * @range [1, 100]
     */
    readonly maxSize: number;

    /**
     * 空闲 Worker 超时时间（毫秒）
     * 
     * @default 60000
     * @rationale 1 分钟空闲后回收，平衡了复用率与资源释放。
     * @range [5000, 600000]
     */
    readonly idleTimeoutMs: number;
}

/**
 * Worker 配置
 */
export interface WorkerConfig {
    /**
     * Worker 请求超时时间（毫秒）
     * 
     * @default 30000
     * @rationale 允许足够时间进行复杂 App 初始化，同时捕获真正的挂起。
     *            30s 是 AWS Lambda 冷启动的典型上限。
     * @range [1000, 300000]
     */
    readonly timeoutMs: number;

    /**
     * Worker 进程池配置
     */
    readonly pool: WorkerPoolConfig;
}

/**
 * Worker 默认配置
 */
export const WORKER_DEFAULTS: WorkerConfig = {
    timeoutMs: 30_000,
    pool: {
        initialSize: 2,
        maxSize: 10,
        idleTimeoutMs: 60_000,
    },
} as const;
