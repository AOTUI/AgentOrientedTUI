/**
 * Operations Module
 * 
 * 提供系统操作注册表和预注册的系统操作。
 * 
 * @module @aotui/runtime/engine/operations
 */

export { SystemOperationRegistry } from './registry.js';

// System Operations
export {
    OpenAppOperation,
    CloseAppOperation,
    DismountViewOperation
} from './system/index.js';

// Re-export types from SPI for convenience
export type {
    ISystemOperation,
    ISystemOperationRegistry,
    SystemOperationContext,
    IDesktopForOperation
} from '../../../spi/index.js';

// ============================================================================
// Factory Function
// ============================================================================

import { SystemOperationRegistry } from './registry.js';
import {
    OpenAppOperation,
    CloseAppOperation,
    DismountViewOperation
} from './system/index.js';

/**
 * 创建预注册所有系统操作的注册表
 * 
 * 这是创建 SystemOperationRegistry 的推荐方式。
 * 所有内置系统操作在编译时固定注册。
 * 
 * @returns 已注册所有系统操作的 Registry
 * 
 * @example
 * ```typescript
 * const registry = createSystemOperationRegistry();
 * const result = await registry.execute('open', ctx, desktop);
 * ```
 */
export function createSystemOperationRegistry(): SystemOperationRegistry {
    const registry = new SystemOperationRegistry();

    // 注册所有内置系统操作
    registry.register(new OpenAppOperation());
    registry.register(new CloseAppOperation());
    registry.register(new DismountViewOperation());

    return registry;
}
