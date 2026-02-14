/**
 * SPI Core Layer - Foundation Types
 * 
 * 最基础的类型定义，零外部依赖。
 * 这是整个 AOTUI 框架的"语言"。
 * 
 * @module @aotui/runtime/spi/core
 */

// ============================================================================
// ID Types
// ============================================================================
export type {
    SnapshotID,
    DesktopID,
    AppID,
    ViewID,
    OperationID,
} from './types.js';

// ============================================================================
// ID Factory Functions
// ============================================================================
export {
    // Factory Functions
    createDesktopId,
    createAppId,
    createViewId,
    createSnapshotId,
    createOperationId,
    // Type Guards
    isDesktopId,
    isAppId,
    isViewId,
    isSnapshotId,
    // Unsafe Casts (backward compatibility)

    // Constants
    ID_PREFIXES,
} from './id-factory.js';


// ============================================================================
// Data Structures
// ============================================================================
export type {
    DataPayload,
    IndexMap,
} from './types.js';

// ============================================================================
// State Types
// ============================================================================
export type {
    DesktopStatus,
    AppState,
    DesktopState,
    AppConfig,
} from './types.js';

// ============================================================================
// Operation Types
// ============================================================================
export type {
    OperationContext,
    OperationScope,
    Operation,
    OperationError,
    OperationResult,
    OperationPayload,
    SystemOperationContext,
    ISystemOperation,
    IDesktopForOperation,
    ISystemOperationRegistry,
} from './operations.js';

// ============================================================================
// Signals
// ============================================================================
export type { UpdateSignal } from './signals.js';

// ============================================================================
// Snapshot
// ============================================================================
export type { CachedSnapshot, StructuredSnapshot, AppStateFragment } from './snapshot.js';
export { isSnapshotExpired } from './snapshot.js';

// ============================================================================
// Tool Call Types (LLM Function Calling)
// ============================================================================
export type {
    Tool,
    ToolCall,
    ToolCallResult,
    OperationParamDef,
    OperationDef,
} from './tool-call.js';

// ============================================================================
// Error System
// ============================================================================
export {
    ERROR_CODES,
    AOTUIError,
    createOperationError,
    failedResult,
} from './errors.js';

export type { ErrorCode } from './errors.js';

// ============================================================================
// Operation Log Types (RFC-008)
// ============================================================================
export type {
    OperationLogScope,
    OperationLogEntry,
    IOperationLogBuffer,
    OperationLogParams,
} from './operation-log.js';

// ============================================================================
// LLM Output Types (RFC-011)
// ============================================================================
export type {
    LLMOutputEvent,
    LLMOutputEventMeta,
    LLMOutputListener,
} from './llm-output.js';

