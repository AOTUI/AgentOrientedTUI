/**
 * TUI App Configuration Types
 * 
 * 定义 ~/.tui/config.json 的结构
 * 
 * [Option D] Version 2 adds runtime.workerScript for config-driven Worker installation.
 * 
 * @module @aotui/runtime/engine/app-registry
 */

/**
 * 单个 App 的配置
 */
export interface AppConfigEntry {
    /** 
     * 来源
     * - npm:@scope/name -- npm 包
     * - local:/path/to/app -- 本地目录
     * - git:github:user/repo -- Git 仓库
     */
    source: string;

    /** 版本约束 (仅 npm 来源有效) */
    version?: string;

    /** 是否启用 */
    enabled: boolean;

    /** 安装时间 */
    installedAt?: string;

    /** 别名 (用于解决命名冲突) */
    alias?: string;

    /** 
     * [Option D] 自定义 Worker 脚本路径 (可选)
     * 为空时使用 runtime.workerScript 默认值
     */
    workerScript?: string;

    /**
     * App 简介 (兼容旧字段)
     * - 建议使用 whatItIs + whenToUse
     */
    description?: string;

    /** App 是什么 (用于 Desktop State 展示) */
    whatItIs?: string;

    /** 什么时候用 (用于 Desktop State 展示) */
    whenToUse?: string;

    /**
     * [RFC-014] Desktop 创建时是否自动启动此 App
     * - true: Desktop 创建时自动安装并启动 (默认行为)
     * - false: App 已安装但不自动启动，需按需启动
     * @default true
     */
    autoStart?: boolean;

    /** [Fix] App 角色 */
    promptRole?: 'user' | 'assistant';
}

/**
 * [Option D] Runtime 配置
 */
export interface RuntimeConfig {
    /** 
     * Worker 脚本的默认路径
     * 所有 App 默认使用此脚本运行在 Worker 中
     */
    workerScript: string;
}

/**
 * ~/.tui/config.json 结构
 * 
 * Version 1: 基础 App 配置
 * Version 2: 增加 runtime.workerScript 配置
 */
export interface TUIConfig {
    /** 配置版本 */
    version: number;

    /** [Option D] Runtime 配置 */
    runtime?: RuntimeConfig;

    /** 已安装的 App */
    apps: Record<string, AppConfigEntry>;
}

/**
 * 创建默认配置 (Version 2)
 */
export function createDefaultConfig(): TUIConfig {
    return {
        version: 2,
        runtime: {
            workerScript: '' // 留空，由 Product Layer 设置
        },
        apps: {}
    };
}

export function validateConfig(config: unknown): config is TUIConfig {
    if (typeof config !== 'object' || config === null) return false;

    const c = config as Record<string, unknown>;
    if (typeof c.version !== 'number') return false;
    if (typeof c.apps !== 'object' || c.apps === null) return false;

    return true;
}
