/**
 * System Domain
 * 
 * 包含系统操作调度、快照注册表及操作定义。
 * 
 * @module @aotui/runtime/engine/system
 */

// ============================================================================
// Dispatcher - 操作路由与参数解析
// ============================================================================
export { Dispatcher } from './dispatcher.js';

// ============================================================================
// SnapshotRegistry - Snapshot 数据索引
// ============================================================================
export { SnapshotRegistry } from './registry.js';

// ============================================================================
// SystemOperationRegistry - 系统操作定义
// ============================================================================
export { SystemOperationRegistry, createSystemOperationRegistry } from './operations/index.js';
