/**
 * Runtime Configuration Builder
 * 
 * @module @aotui/runtime/spi/config
 */

import { WORKER_DEFAULTS } from './domains/worker.config.js';
import { BRIDGE_DEFAULTS } from './domains/bridge.config.js';
import { LOCK_DEFAULTS } from './domains/lock.config.js';
import { SNAPSHOT_DEFAULTS } from './domains/snapshot.config.js';
import { TRANSFORM_DEFAULTS } from './domains/transform.config.js';
import { LOGGER_DEFAULTS } from './domains/logger.config.js';
import { validateRuntimeConfig } from './validate.js';
import type { RuntimeConfig, RuntimeConfigInput, DeepPartial } from './types.js';

/**
 * 完整默认配置
 */
export const RUNTIME_DEFAULTS: RuntimeConfig = {
    worker: WORKER_DEFAULTS,
    bridge: BRIDGE_DEFAULTS,
    lock: LOCK_DEFAULTS,
    snapshot: SNAPSHOT_DEFAULTS,
    transform: TRANSFORM_DEFAULTS,
    logger: LOGGER_DEFAULTS,
} as const;

/**
 * 深度合并配置
 */
function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
    const result = { ...target } as T;

    for (const key in source) {
        const sourceValue = source[key];
        const targetValue = target[key];

        if (
            sourceValue !== undefined &&
            typeof sourceValue === 'object' &&
            sourceValue !== null &&
            !Array.isArray(sourceValue) &&
            targetValue !== undefined &&
            typeof targetValue === 'object' &&
            targetValue !== null
        ) {
            (result as any)[key] = deepMerge(targetValue as object, sourceValue as object);
        } else if (sourceValue !== undefined) {
            (result as any)[key] = sourceValue;
        }
    }

    return result;
}

/**
 * 定义运行时配置
 * 
 * 将用户配置与默认配置合并，并进行验证。
 * 
 * @param input 用户配置（可选部分）
 * @returns 完整的运行时配置（所有字段填充）
 * @throws {AOTUIError} CONFIG_INVALID 如果配置验证失败
 * 
 * @example
 * ```typescript
 * // 使用全部默认配置
 * const config = defineRuntimeConfig();
 * 
 * // 覆盖特定值
 * const config = defineRuntimeConfig({
 *   worker: { timeoutMs: 60_000 }
 * });
 * ```
 */
export function defineRuntimeConfig(input: RuntimeConfigInput = {}): RuntimeConfig {
    const config = deepMerge(RUNTIME_DEFAULTS, input);
    validateRuntimeConfig(config);
    return Object.freeze(config) as RuntimeConfig;
}
