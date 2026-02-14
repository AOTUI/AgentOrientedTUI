/**
 * AOTUI Runtime Configuration SPI
 * 
 * Unified source of truth for all runtime configurations.
 * 
 * @module @aotui/runtime/spi/config
 */

// 类型导出
export type { RuntimeConfig, RuntimeConfigInput, DeepPartial } from './types.js';

// 领域配置导出
export { WORKER_DEFAULTS, type WorkerConfig, type WorkerPoolConfig } from './domains/worker.config.js';
export { BRIDGE_DEFAULTS, type BridgeConfig } from './domains/bridge.config.js';
export { LOCK_DEFAULTS, type LockConfig } from './domains/lock.config.js';
export { SNAPSHOT_DEFAULTS, type SnapshotConfig } from './domains/snapshot.config.js';
export { TRANSFORM_DEFAULTS, type TransformConfig } from './domains/transform.config.js';
export { LOGGER_DEFAULTS, type LoggerConfig } from './domains/logger.config.js';

// 核心函数导出
export { defineRuntimeConfig, RUNTIME_DEFAULTS } from './define-config.js';
export { validateRuntimeConfig } from './validate.js';
