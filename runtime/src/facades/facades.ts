/**
 * SDK Layer - Runtime Facade
 * 
 * 提供简化的 Runtime 创建和使用接口。
 * 这是大多数开发者的入口点。
 * 
 * [DIP] Uses createKernel factory for proper dependency injection.
 */

import { SnapshotRegistry } from '../engine/system/index.js';
import { createSystemOperationRegistry } from '../engine/system/index.js';
import { DesktopManager } from '../engine/core/index.js';
import { createKernel } from '../factory/createKernel.js';
import type { IKernel } from '../spi/index.js';
import {
    RUNTIME_DEFAULTS,
    type RuntimeConfig,
    type RuntimeConfigInput,
    defineRuntimeConfig
} from '../spi/config/index.js';

export { RUNTIME_DEFAULTS, type RuntimeConfig, type RuntimeConfigInput, defineRuntimeConfig };

// ============================================================================
// Runtime 配置
// ============================================================================

export interface LegacyRuntimeConfig {
    /** Snapshot TTL（毫秒），默认 10 分钟 */
    snapshotTTL?: number;
}

// ============================================================================
// 快捷工厂函数
// ============================================================================

/**
 * 创建 AOTUI Runtime 实例
 * 
 * 这是最简单的入口点，封装了所有内部依赖的创建。
 * 
 * [DIP] Uses createKernel factory internally to maintain proper dependency injection.
 * 
 * @example
 * ```typescript
 * import { createRuntime, defineRuntimeConfig } from '@aotui/runtime';
 * 
 * // 零配置
 * const runtime = createRuntime();
 * 
 * // 自定义配置 (RFC-005)
 * const config = defineRuntimeConfig({
 *   worker: { timeoutMs: 60000 }
 * });
 * const runtime = createRuntime(config);
 * 
 * const desktopId = await runtime.createDesktop();
 * await runtime.installDynamicApp(desktopId, new MyChatApp());
 * ```
 */
export function createRuntime(input: LegacyRuntimeConfig | RuntimeConfigInput = {}): IKernel {
    // [RFC-005] Normalize Configuration
    let config: RuntimeConfig;

    // Check if input has new config structure properties (or is empty/custom object)
    // Simple heuristic: if it has 'worker', 'bridge', 'lock', etc. OR it is the result of defineRuntimeConfig (which is frozen)
    // But since Legacy only has snapshotTTL, checking that is easier.

    const legacy = input as LegacyRuntimeConfig;
    if (legacy.snapshotTTL !== undefined) {
        // Legacy Config
        config = defineRuntimeConfig({
            snapshot: { ttlMs: legacy.snapshotTTL }
        });
    } else {
        // New Config Input (or empty)
        config = defineRuntimeConfig(input as RuntimeConfigInput);
    }

    const desktopManager = new DesktopManager(config);
    const snapshotRegistry = new SnapshotRegistry({
        ttl: config.snapshot.ttlMs
    });
    const systemOps = createSystemOperationRegistry();

    return createKernel(
        desktopManager,
        snapshotRegistry,
        systemOps
    );
}

