/**
 * Worker Protocol - Message Definitions
 * 
 * 定义主线程与 Worker 之间的 IPC 消息协议。
 * 这是 SDK Worker Runtime 和 Runtime AppWorkerHost 的统一契约。
 * 
 * ## 消息流向
 * 
 * - **MainToWorkerMessage**: 主线程 → Worker (请求)
 * - **WorkerToMainMessage**: Worker → 主线程 (响应/推送)
 * 
 * ## 设计原则
 * 
 * 1. 所有消息都有 `type` 字段用于区分
 * 2. 请求消息都有 `requestId` 用于匹配响应
 * 3. Worker 可以主动推送消息 (如 DOM_UPDATE)
 * 
 * @module @aotui/runtime/spi/worker-protocol
 */

import type { RequestID, AppID, DesktopID, ViewID, OperationID, SnapshotID, DataPayload } from './types.js';
import type { OperationResult } from '../core/index.js';
import type { AppLaunchConfig } from '../app/app-config.interface.js';

// ============================================================================
// Re-export WorkerMessageType from canonical source
// ============================================================================
// WorkerMessageType is defined in worker-message.interface.ts (Single Source of Truth)
// We re-export it here for convenience when importing from worker-protocol
export type { WorkerMessageType } from '../runtime/worker-message.interface.js';

// ============================================================================
// Main → Worker Messages
// ============================================================================


/**
 * App 初始化消息
 */
export interface InitMessage {
    type: 'INIT';
    requestId: RequestID;
    appId: AppID;
    desktopId: DesktopID;
    /** App 模块路径 (动态 import) */
    appModulePath: string;
    /** 应用启动配置 (Configuration Injection) */
    config?: AppLaunchConfig;
}

/**
 * App 生命周期消息
 */
export interface AppLifecycleMessage {
    type: 'APP_OPEN' | 'APP_PAUSE' | 'APP_RESUME' | 'APP_CLOSE' | 'APP_DELETE' | 'APP_SHUTDOWN';
    requestId: RequestID;
}

/**
 * View 生命周期消息
 */
export interface ViewLifecycleMessage {
    type: 'VIEW_DISMOUNT';
    requestId: RequestID;
    viewId: ViewID;
    parentId?: ViewID | null;
}

/**
 * Operation 执行消息
 */
export interface OperationMessage {
    type: 'APP_OPERATION' | 'VIEW_OPERATION';
    requestId: RequestID;
    viewId?: ViewID;
    operation: OperationID;
    args: Record<string, unknown>;
    snapshotId: SnapshotID;
}

/**
 * 外部事件消息
 */
export interface ExternalEventMessage {
    type: 'EXTERNAL_EVENT';
    requestId: RequestID;
    viewId: ViewID;
    eventType: string;
    data: Record<string, unknown>;
}


/**
 * 终止消息
 */
export interface TerminateMessage {
    type: 'TERMINATE';
}

/**
 * 重置 Worker 状态消息 (用于 Worker 池复用)
 */
export interface ResetMessage {
    type: 'RESET';
    requestId: RequestID;
}

/**
 * [RFC-006] ViewLink Mount 消息
 */
export interface ViewMountByLinkMessage {
    type: 'VIEW_MOUNT_BY_LINK';
    requestId: RequestID;
    parentViewId: ViewID;
    linkId: string;
}

/**
 * [RFC-011] LLM Output Push 消息
 * [RFC-020] 支持结构化 payload { reasoning?, content? }
 * 
 * 主线程推送 LLM 输出文本到 Worker，用于 SDK 的 useLLMOutputChannel
 */
export interface LLMOutputPushMessage {
    type: 'LLM_OUTPUT_PUSH';
    /** [RFC-020] LLM 思考/推理过程 */
    reasoning?: string;
    /** LLM 最终回复内容 */
    content?: string;
    eventType: 'complete';
    timestamp: number;
    meta?: {
        model?: string;
        usage?: {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
        };
    };
}

/**
 * 主线程 → Worker 消息联合类型
 */
export type MainToWorkerMessage =
    | InitMessage
    | AppLifecycleMessage
    | ViewLifecycleMessage
    | ViewMountByLinkMessage
    | OperationMessage
    | ExternalEventMessage
    | TerminateMessage
    | ResetMessage
    | LLMOutputPushMessage;

// ============================================================================
// Worker → Main Messages
// ============================================================================

/**
 * 错误信息结构
 */
export interface WorkerError {
    code: string;
    message: string;
}

/**
 * 响应消息基类
 */
export interface ResponseBase {
    requestId: RequestID;
    success: boolean;
}

/**
 * 初始化完成响应
 */
export interface InitResponse extends ResponseBase {
    type: 'INIT_RESPONSE';
}

/**
 * 生命周期完成响应
 */
export interface LifecycleResponse extends ResponseBase {
    type: 'LIFECYCLE_RESPONSE';
}

/**
 * Operation 结果响应
 */
export interface OperationResponse extends ResponseBase {
    type: 'OPERATION_RESPONSE';
    result: OperationResult;
}


/**
 * 错误响应
 */
export interface ErrorResponse extends ResponseBase {
    type: 'ERROR_RESPONSE';
    success: false;
    error: WorkerError;
}

/**
 * Worker 主动请求: 通知更新
 */
export interface UpdateRequest {
    type: 'REQUEST_UPDATE';
}

/**
 * Worker 主动请求: mount 子 View
 */
export interface MountChildRequest {
    type: 'REQUEST_MOUNT_CHILD';
    viewId: ViewID;
}

/**
 * Worker 主动请求: dismount 子 View
 */
export interface DismountChildRequest {
    type: 'REQUEST_DISMOUNT_CHILD';
    viewId: ViewID;
}



/**
 * Worker 主动推送: Snapshot Fragment
 * 
 * [RFC-001] Worker-Side Transformation
 * Worker 直接执行 Transformer，推送 Markdown + IndexMap，
 * 避免主线程 HTML 解析开销。
 */
export interface SnapshotFragmentPush {
    type: 'SNAPSHOT_FRAGMENT';
    /** App ID */
    appId: AppID;
    /** 更新时间戳 (用于去重) */
    timestamp: number;
    /** TUI Markdown for this App */
    markup: string;
    /** Partial IndexMap (app-scoped paths) */
    indexMap: Record<string, DataPayload>;
    /**
     * [RFC-007] View tree markdown for Application Info section
     * 
     * Format:
     * ```markdown
     * ## Application View Tree
     * - [Chat](view:view_0, mounted)
     *     ↳ [Detail](link:CD_0)
     * ```
     */
    viewTree?: string;
    /** Version for incremental updates (future) */
    version?: number;

    /**
     * [RFC-012] Signal Suppression Flag
     * 
     * When true, main thread should update snapshot cache but NOT emit UpdateSignal.
     * Used by passive apps (signalPolicy: 'never') to maintain data freshness
     * without triggering Agent reaction loops.
     */
    suppressSignal?: boolean;
}

/**
 * 重置完成响应
 */
export interface ResetResponse extends ResponseBase {
    type: 'RESET_RESPONSE';
}

/**
 * Worker → 主线程消息联合类型
 */
export type WorkerToMainMessage =
    | InitResponse
    | LifecycleResponse
    | OperationResponse
    | ErrorResponse
    | UpdateRequest
    | MountChildRequest
    | DismountChildRequest

    | SnapshotFragmentPush
    | ResetResponse;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * 检查是否为响应消息
 */
export function isResponse(msg: WorkerToMainMessage): msg is ResponseBase & WorkerToMainMessage {
    return 'requestId' in msg && 'success' in msg;
}

/**
 * 检查是否为请求消息 (Worker 主动发起)
 */
export function isRequest(msg: WorkerToMainMessage): boolean {
    return msg.type.startsWith('REQUEST_');
}



/**
 * 检查是否为 Snapshot Fragment 推送
 * [RFC-001] Worker-Side Transformation
 */
export function isSnapshotFragment(msg: WorkerToMainMessage): msg is SnapshotFragmentPush {
    return msg.type === 'SNAPSHOT_FRAGMENT';
}
