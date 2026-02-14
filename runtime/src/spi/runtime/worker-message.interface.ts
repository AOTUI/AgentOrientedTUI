/**
 * SPI Layer - Worker Message Interface
 * 
 * Defines the stable contract for Worker-Main thread communication.
 * 
 * [架构原则] 这是 SPI 层的抽象接口，只暴露最小必要的消息契约。
 * 具体的消息结构由 Engine 层定义，SDK Worker 使用本地兼容类型。
 * 
 * 这样设计的长期收益:
 * 1. SPI 保持纯粹的契约层
 * 2. 未来可替换 IPC 实现 (如 SharedArrayBuffer)
 * 3. 协议变更不破坏 SDK 兼容性
 * 
 * @module @aotui/runtime/spi
 */

// ============================================================================
// Request ID (稳定契约)
// ============================================================================

/**
 * 请求 ID 类型
 * 
 * 用于匹配 Worker 请求-响应对
 */
export type RequestID = string;

/**
 * 生成唯一请求 ID
 */
export function generateRequestId(): RequestID {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// Message Type Enumeration (稳定契约)
// ============================================================================

/**
 * Worker 消息类型枚举
 * 
 * 这是稳定的 API 契约，新增类型是向后兼容的，
 * 但移除或重命名类型需要版本升级。
 */
export type WorkerMessageType =
    // ─────────────────────────────────────────────────────────────
    // Main → Worker (请求)
    // ─────────────────────────────────────────────────────────────
    | 'INIT'
    | 'APP_OPEN'
    | 'APP_PAUSE'
    | 'APP_RESUME'
    | 'APP_CLOSE'
    | 'VIEW_DISMOUNT'
    | 'APP_OPERATION'
    | 'VIEW_OPERATION'
    | 'EXTERNAL_EVENT'
    | 'RENDER_VIEW'
    | 'RENDER_ALL'
    | 'GET_DOM_HTML'
    | 'TERMINATE'
    | 'RESET'           // Worker Pool support
    // ─────────────────────────────────────────────────────────────
    // Worker → Main (响应 & 推送)
    // ─────────────────────────────────────────────────────────────
    | 'INIT_RESPONSE'
    | 'LIFECYCLE_RESPONSE'
    | 'OPERATION_RESPONSE'
    | 'RENDER_RESPONSE'
    | 'ERROR_RESPONSE'
    | 'DOM_UPDATE'
    | 'REQUEST_UPDATE'
    | 'REQUEST_MOUNT_CHILD'
    | 'REQUEST_DISMOUNT_CHILD'
    | 'RESET_RESPONSE'; // Worker Pool support

// ============================================================================
// Abstract Message Interfaces (稳定契约)
// ============================================================================

/**
 * 基础消息接口
 * 
 * 所有 Worker 消息都必须包含 type 字段
 */
export interface IWorkerMessage {
    readonly type: WorkerMessageType;
}

/**
 * 请求消息接口
 * 
 * Main → Worker 的请求消息
 */
export interface IWorkerRequest extends IWorkerMessage {
    readonly requestId: RequestID;
}

/**
 * 响应消息接口
 * 
 * Worker → Main 的响应消息
 */
export interface IWorkerResponse extends IWorkerMessage {
    readonly requestId: RequestID;
    readonly success: boolean;
}

/**
 * 错误信息结构
 */
export interface IWorkerError {
    readonly code: string;
    readonly message: string;
}

// ============================================================================
// Type Guards (稳定契约)
// ============================================================================

/**
 * 检查消息是否为响应类型
 */
export function isWorkerResponse(msg: IWorkerMessage): msg is IWorkerResponse {
    return 'requestId' in msg && 'success' in msg;
}

/**
 * 检查消息是否为请求类型
 */
export function isWorkerRequest(msg: IWorkerMessage): msg is IWorkerRequest {
    return 'requestId' in msg && !('success' in msg);
}

/**
 * 检查是否为 DOM 更新推送
 */
export function isDomUpdateMessage(msg: IWorkerMessage): boolean {
    return msg.type === 'DOM_UPDATE';
}

/**
 * 检查是否为 Worker 主动请求
 */
export function isWorkerPush(msg: IWorkerMessage): boolean {
    return msg.type.startsWith('REQUEST_') || msg.type === 'DOM_UPDATE';
}
