/**
 * Runtime Configuration Validation
 * 
 * @module @aotui/runtime/spi/config
 */

import { AOTUIError } from '../core/errors.js';
import type { RuntimeConfig } from './types.js';

interface ValidationRule {
    path: string;
    validate: (config: RuntimeConfig) => boolean;
    message: string;
}

const VALIDATION_RULES: ValidationRule[] = [
    // Worker 规则
    {
        path: 'worker.timeoutMs',
        validate: (c) => c.worker.timeoutMs >= 1000 && c.worker.timeoutMs <= 300_000,
        message: 'worker.timeoutMs must be between 1000ms and 300000ms',
    },
    {
        path: 'worker.pool.maxSize',
        validate: (c) => c.worker.pool.maxSize >= c.worker.pool.initialSize,
        message: 'worker.pool.maxSize must be >= worker.pool.initialSize',
    },
    {
        path: 'worker.pool.initialSize',
        validate: (c) => c.worker.pool.initialSize >= 0 && c.worker.pool.initialSize <= 100,
        message: 'worker.pool.initialSize must be between 0 and 100',
    },
    {
        path: 'worker.pool.idleTimeoutMs',
        validate: (c) => c.worker.pool.idleTimeoutMs >= 5000 && c.worker.pool.idleTimeoutMs <= 600_000,
        message: 'worker.pool.idleTimeoutMs must be between 5000ms and 600000ms',
    },

    // Bridge 规则
    {
        path: 'bridge.debounceMs',
        validate: (c) => c.bridge.debounceMs >= 0 && c.bridge.debounceMs <= 5000,
        message: 'bridge.debounceMs must be between 0ms and 5000ms',
    },

    // Lock 规则
    {
        path: 'lock.ttlMs',
        validate: (c) => c.lock.ttlMs >= 60_000,
        message: 'lock.ttlMs must be at least 60000ms (1 minute)',
    },

    // Snapshot 规则
    {
        path: 'snapshot.ttlMs',
        validate: (c) => c.snapshot.ttlMs >= 60_000,
        message: 'snapshot.ttlMs must be at least 60000ms (1 minute)',
    },

    // Transform 规则
    {
        path: 'transform.domThrottleMs',
        validate: (c) => c.transform.domThrottleMs >= 0 && c.transform.domThrottleMs <= 1000,
        message: 'transform.domThrottleMs must be between 0ms and 1000ms',
    },
    {
        path: 'transform.maxTreeDepth',
        validate: (c) => c.transform.maxTreeDepth >= 1 && c.transform.maxTreeDepth <= 100,
        message: 'transform.maxTreeDepth must be between 1 and 100',
    },

    // Logger 规则
    {
        path: 'logger.maxSystemLogs',
        validate: (c) => c.logger.maxSystemLogs >= 10 && c.logger.maxSystemLogs <= 10000,
        message: 'logger.maxSystemLogs must be between 10 and 10000',
    },
    {
        path: 'logger.maxAppLogs',
        validate: (c) => c.logger.maxAppLogs >= 10 && c.logger.maxAppLogs <= 10000,
        message: 'logger.maxAppLogs must be between 10 and 10000',
    },
];

/**
 * 验证运行时配置
 * 
 * @throws {AOTUIError} CONFIG_INVALID 如果任何规则失败
 */
export function validateRuntimeConfig(config: RuntimeConfig): void {
    const errors: string[] = [];

    for (const rule of VALIDATION_RULES) {
        if (!rule.validate(config)) {
            errors.push(`[${rule.path}] ${rule.message}`);
        }
    }

    if (errors.length > 0) {
        // 使用简化的上下文对象以避免循环引用或巨大对象
        throw new AOTUIError('CONFIG_INVALID', {
            errors: errors.join('; '),
            // 不要在错误消息中包含完整 config，可能会很大
        });
    }
}
