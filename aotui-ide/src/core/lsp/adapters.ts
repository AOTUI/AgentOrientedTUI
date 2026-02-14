/**
 * LSP Adapters for AOTUI IDE
 * 
 * 提供LSP所需的基础设施适配层，包括：
 * - 事件总线 (Bus/BusEvent)
 * - 配置管理 (Config)
 * - 实例管理 (Instance)
 * - 日志系统 (Log)
 * - 功能开关 (Flag)
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

// ==================== Log ====================

export const Log = {
    create: (opts: { service: string }) => {
        const prefix = `[${opts.service.toUpperCase()}]`;
        return {
            info: (...args: any[]) => console.log(prefix, ...args),
            error: (...args: any[]) => console.error(prefix, ...args),
            warn: (...args: any[]) => console.warn(prefix, ...args),
            debug: (...args: any[]) => console.debug(prefix, ...args),
            clone: function () { return this; },
            tag: function (key: string, value: any) { return this; }
        };
    }
};

// ==================== Bus / BusEvent ====================

const busEmitter = new EventEmitter();
busEmitter.setMaxListeners(100); // 增加监听器限制

export const Bus = {
    publish: (event: any, payload?: any) => {
        if (event && event.name) {
            busEmitter.emit(event.name, payload);
        }
    },
    subscribe: (event: any, handler: Function) => {
        if (event && event.name) {
            busEmitter.on(event.name, handler as any);
            return () => busEmitter.off(event.name, handler as any);
        }
        return () => { };
    }
};

export const BusEvent = {
    define: (name: string, schema: any) => ({
        name,
        schema
    })
};

// ==================== Config ====================

const defaultConfig = {
    lsp: {
        typescript: {
            disabled: false,
            command: ['typescript-language-server', '--stdio'],
            extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'],
            initialization: {
                preferences: {
                    includeInlayParameterNameHints: 'all',
                    includeInlayFunctionParameterTypeHints: true,
                    includeInlayVariableTypeHints: true,
                    includeInlayPropertyDeclarationTypeHints: true,
                    includeInlayEnumMemberValueHints: true
                }
            }
        }
    }
};

let cachedConfig: any = null;

/**
 * 合并配置对象（深度合并）
 */
function mergeConfig(defaultCfg: any, userCfg: any): any {
    if (!userCfg) return defaultCfg;

    const result: any = { ...defaultCfg };

    for (const key in userCfg) {
        if (typeof userCfg[key] === 'object' && !Array.isArray(userCfg[key]) && userCfg[key] !== null) {
            result[key] = mergeConfig(defaultCfg[key] || {}, userCfg[key]);
        } else {
            result[key] = userCfg[key];
        }
    }

    return result;
}

export const Config = {
    /**
     * 获取配置
     * 优先级：用户配置文件 > 默认配置
     */
    async get() {
        if (cachedConfig) return cachedConfig;

        const configPath = path.join(Instance.directory, '.aotui-ide', 'lsp-config.json');

        try {
            const content = await fs.readFile(configPath, 'utf-8');
            const userConfig = JSON.parse(content);
            cachedConfig = mergeConfig(defaultConfig, userConfig);
            console.log('[Config] Loaded user config from:', configPath);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                // 文件不存在，使用默认配置
                cachedConfig = defaultConfig;
                console.log('[Config] Using default config (no user config found)');
            } else {
                // 其他错误（如JSON解析错误）
                console.error('[Config] Failed to load user config:', error);
                cachedConfig = defaultConfig;
            }
        }

        return cachedConfig;
    },

    /**
     * 重置缓存（用于测试或配置更新）
     */
    reset() {
        cachedConfig = null;
    }
};

// ==================== Instance ====================

let workspaceDirectory = process.cwd();
const stateCache = new Map<string, any>();

export const Instance = {
    get directory() {
        return workspaceDirectory;
    },

    setDirectory(dirPath: string) {
        if (workspaceDirectory !== dirPath) {
            console.log('[Instance] Workspace directory changed:', dirPath);
            workspaceDirectory = dirPath;
            // 清空状态缓存和配置缓存
            stateCache.clear();
            Config.reset();
        }
    },

    /**
     * 状态管理工厂
     * 提供懒加载和缓存机制
     */
    state: <T>(init: () => Promise<T>, cleanup?: (state: T) => Promise<void>) => {
        // 使用函数字符串作为简单的key（实际项目中可能需要更复杂的key生成策略）
        const key = init.toString().substring(0, 100);

        return async () => {
            if (stateCache.has(key)) {
                return stateCache.get(key) as T;
            }

            const state = await init();
            stateCache.set(key, state);

            return state;
        };
    },

    /**
     * 清理所有状态（用于关闭或重置）
     */
    async cleanupAll() {
        console.log('[Instance] Cleaning up all states');
        stateCache.clear();
    }
};

// ==================== Flag ====================

export const Flag = {
    /**
     * 实验性功能：Ty LSP（Python类型检查器）
     * 默认关闭，使用Pyright
     */
    OPENCODE_EXPERIMENTAL_LSP_TY: false
};

// ==================== Filesystem ====================

export const Filesystem = {
    normalizePath: (filePath: string) => {
        return path.normalize(filePath);
    },

    readFile: async (filePath: string) => {
        return fs.readFile(filePath, 'utf-8');
    }
};

// ==================== NamedError ====================

export class LSPInitializeError extends Error {
    public cause?: any;

    constructor(public data: { serverID: string }, options?: { cause?: any }) {
        super(`LSP Initialize Error: ${data.serverID}`);
        this.name = 'LSPInitializeError';
        this.cause = options?.cause;
    }
}

export const NamedError = {
    create: (name: string, schema: any) => {
        return LSPInitializeError;
    }
};

// ==================== Timeout ====================

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
        )
    ]);
}
