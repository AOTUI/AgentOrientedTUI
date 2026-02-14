/**
 * Core Domain
 * 
 * 包含 Desktop 编排、信号总线及日志服务。
 * 
 * @module @aotui/runtime/engine/core
 */

// ============================================================================
// Desktop - 核心编排
// ============================================================================
export { Desktop, type InstalledApp, type LogEntry } from './desktop.js';

// ============================================================================
// DesktopManager - Desktop 工厂
// ============================================================================
export { DesktopManager } from './manager.js';

// ============================================================================
// DesktopLogger - 日志服务
// ============================================================================
export { DesktopLogger, type DesktopLoggerOptions, type LogLevel } from './desktop-logger.js';

// ============================================================================
// SignalBus - 信号总线
// ============================================================================
export {
    SignalBus,
    createSignalOutputStream,
    type SignalListener,
    type SignalBusOptions,
    type SignalOutputStream
} from './signal-bus.js';

// ============================================================================
// SignalService - ISignalService 实现 (Option B)
// ============================================================================
export { SignalServiceImpl } from './signal-service.js';

