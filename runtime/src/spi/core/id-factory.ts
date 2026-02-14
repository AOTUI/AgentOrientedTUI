/**
 * SPI Layer - ID Factory Functions
 * 
 * 提供类型安全的 ID 创建函数。
 * 
 * 使用工厂函数代替直接 `as TYPE` 断言，确保 ID 格式一致性。
 * 
 * @example
 * ```typescript
 * import { createDesktopId, createAppId } from '@aotui/runtime';
 * 
 * const desktopId = createDesktopId();           // 'dt_abc12345'
 * const customId = createDesktopId('dt_my-id');  // 'dt_my-id'
 * const appId = createAppId(0);                   // 'app_0'
 * ```
 * 
 * @module @aotui/runtime/spi/core
 */

import { randomUUID } from 'crypto';
import type { DesktopID, AppID, ViewID, SnapshotID, OperationID } from './types.js';

// ============================================================================
// ID Prefixes (Internal Convention)
// ============================================================================

/**
 * ID 前缀约定（内部使用）
 * 
 * @internal
 */
export const ID_PREFIXES = {
    Desktop: 'dt_',
    App: 'app_',
    View: 'view_',
    Snapshot: 'snap_',
    Operation: 'op_'
} as const;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * 创建 DesktopID
 * 
 * @param id - 可选的自定义 ID（应包含 'dt_' 前缀）
 * @returns Branded DesktopID
 */
export function createDesktopId(id?: string): DesktopID {
    return (id ?? `${ID_PREFIXES.Desktop}${randomUUID().slice(0, 8)}`) as DesktopID;
}

/**
 * 创建 AppID
 * 
 * @param indexOrId - App 索引号或现有 ID 字符串
 * @returns Branded AppID
 */
export function createAppId(indexOrId: number | string): AppID {
    if (typeof indexOrId === 'number') {
        return `${ID_PREFIXES.App}${indexOrId}` as AppID;
    }
    return indexOrId as AppID;
}

/**
 * 创建 ViewID
 * 
 * @param indexOrId - View 索引号或现有 ID 字符串
 * @returns Branded ViewID
 */
export function createViewId(indexOrId: number | string): ViewID {
    if (typeof indexOrId === 'number') {
        return `${ID_PREFIXES.View}${indexOrId}` as ViewID;
    }
    return indexOrId as ViewID;
}

/**
 * 创建 SnapshotID
 * 
 * @param id - 可选的现有 ID 字符串
 * @returns Branded SnapshotID
 */
export function createSnapshotId(id?: string): SnapshotID {
    return (id ?? `${ID_PREFIXES.Snapshot}${randomUUID().slice(0, 8)}`) as SnapshotID;
}

/**
 * 创建 OperationID
 * 
 * @param name - 操作名称
 * @returns Branded OperationID
 */
export function createOperationId(name: string): OperationID {
    return name as OperationID;
}

// ============================================================================
// Type Guards (for runtime validation in future)
// ============================================================================

/**
 * 检查字符串是否为有效的 DesktopID 格式
 * 
 * @param value - 要检查的字符串
 * @returns 类型谓词
 */
export function isDesktopId(value: string): value is DesktopID {
    return typeof value === 'string' && value.startsWith(ID_PREFIXES.Desktop);
}

/**
 * 检查字符串是否为有效的 AppID 格式
 */
export function isAppId(value: string): value is AppID {
    return typeof value === 'string' && value.startsWith(ID_PREFIXES.App);
}

/**
 * 检查字符串是否为有效的 ViewID 格式
 */
export function isViewId(value: string): value is ViewID {
    return typeof value === 'string' && value.startsWith(ID_PREFIXES.View);
}

/**
 * 检查字符串是否为有效的 SnapshotID 格式
 */
export function isSnapshotId(value: string): value is SnapshotID {
    return typeof value === 'string' && value.startsWith(ID_PREFIXES.Snapshot);
}
