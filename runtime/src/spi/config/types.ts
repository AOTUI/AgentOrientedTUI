/**
 * Runtime Configuration Types
 * 
 * @module @aotui/runtime/spi/config
 */

import type { WorkerConfig } from './domains/worker.config.js';
import type { BridgeConfig } from './domains/bridge.config.js';
import type { LockConfig } from './domains/lock.config.js';
import type { SnapshotConfig } from './domains/snapshot.config.js';
import type { TransformConfig } from './domains/transform.config.js';
import type { LoggerConfig } from './domains/logger.config.js';

/**
 * 完整运行时配置（所有字段必填）
 * 
 * 这是合并后的最终配置类型。
 */
export interface RuntimeConfig {
    readonly worker: WorkerConfig;
    readonly bridge: BridgeConfig;
    readonly lock: LockConfig;
    readonly snapshot: SnapshotConfig;
    readonly transform: TransformConfig;
    readonly logger: LoggerConfig;
}

/**
 * 用户输入配置（所有字段可选）
 * 
 * 使用 DeepPartial 允许嵌套部分覆盖。
 */
export type RuntimeConfigInput = DeepPartial<RuntimeConfig>;

/**
 * DeepPartial 工具类型
 * 
 * 递归地将对象及其子属性设为可选。
 */
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
