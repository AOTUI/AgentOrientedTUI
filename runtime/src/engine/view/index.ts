/**
 * View Domain
 * 
 * 包含视图状态管理、Transformer 及 Snapshot 构建。
 * 
 * @module @aotui/runtime/engine/view
 */

// Re-export types from SPI for backward compatibility
export type { IViewTree, ViewContextFactory } from '../../spi/index.js';

// Export local ViewContext type for backward compatibility
export type { ViewContext } from './types.js';

// Re-export IView from local types for backward compatibility
export type { IView, IViewContext } from './types.js';

// ============================================================================
// ViewManager - 视图状态管理
// ============================================================================
export { ViewManager } from './manager.js';

// ============================================================================
// Transformer - DOM → TUI Markdown
// ============================================================================
export { Transformer, type TransformResult } from './transformer/index.js';

// ============================================================================
// SnapshotBuilder - 快照构建
// ============================================================================
export { SnapshotBuilder, type SnapshotResult } from './snapshot/index.js';
