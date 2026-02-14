/**
 * SPI Layer - Public API
 * 
 * AOTUI 框架的契约层。
 * 
 * ## 分层结构
 * 
 * - **core**: 基础类型 (AppID, ViewID, OperationResult, etc.)
 * - **app**: App 开发者接口 (IView, IViewContext, IAOTUIApp, etc.)
 * - **runtime**: Runtime 内部接口 (IKernel, IDesktop, etc.) - 不对外公开
 * 
 * ## 使用方式
 * 
 * App 开发者应通过 `@aotui/sdk` 导入，而非直接使用此模块。
 * 
 * ```typescript
 * // ✅ 正确：通过 SDK 导入
 * import { View, Operation, type OperationResult } from '@aotui/sdk';
 * 
 * // ❌ 错误：直接导入 SPI
 * import type { IView } from '@aotui/runtime/spi';
 * ```
 * 
 * @module @aotui/runtime/spi
 */

// ============================================================================
// Core Layer - Foundation Types (Public)
// ============================================================================
export * from './core/index.js';

// ============================================================================
// App Layer - App Developer Interfaces (Public)
// ============================================================================
export * from './app/index.js';

// ============================================================================
// Runtime Layer - Internal Interfaces (Public for Product Layer)
// ============================================================================
// Note: These are intentionally exported for Product Layer (Server) usage.
// SDK developers should NOT use these directly.
export * from './runtime/index.js';

// ============================================================================
// Bridge Layer - Agent I/O Boundary (Public for AgentDriver)
// ============================================================================
// IBridge is the only interface Agents should interact with.
// Product Layer creates Bridge instances and passes to AgentDriver.
export * from './bridge/index.js';

// ============================================================================
// Worker Protocol - IPC Message Contract
// ============================================================================
// Contract between AppWorkerHost (main thread) and Worker Runtime (worker thread).
// Used by both Runtime and SDK Worker.
export * from './worker-protocol/index.js';

// ============================================================================
// Component Factory - SDK-Runtime Contract (RFC-027-C)
// ============================================================================
// Factory Injection Pattern for complete decoupling
export * from './component-factory.interface.js';
