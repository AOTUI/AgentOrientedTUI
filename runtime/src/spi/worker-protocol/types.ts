/**
 * Worker Protocol - Type Definitions
 * 
 * 基础类型定义，用于 Worker IPC 通信。
 * 
 * [架构原则] 这里重新导出 SPI 中已有的类型，保持单一来源。
 * 
 * @module @aotui/runtime/spi/worker-protocol
 */

import type { AppID, DesktopID, ViewID, OperationID, SnapshotID, DataPayload, IndexMap } from '../core/index.js';

// ============================================================================
// Re-export core types for convenience
// ============================================================================

export type { AppID, DesktopID, ViewID, OperationID, SnapshotID, DataPayload, IndexMap };

// ============================================================================
// Re-export from existing worker-message.interface (Single Source of Truth)
// ============================================================================
// Note: WorkerMessageType is defined in messages.ts with additional types (RESET, RESET_RESPONSE)
// so we don't re-export it here to avoid conflicts.

export {
    type RequestID,
    generateRequestId,
    type IWorkerMessage,
    type IWorkerRequest,
    type IWorkerResponse,
    type IWorkerError,
} from '../runtime/worker-message.interface.js';
