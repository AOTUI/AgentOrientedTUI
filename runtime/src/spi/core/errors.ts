/**
 * SPI Core Layer - Error System
 * 
 * 统一的错误处理机制，提供类型安全的错误码和结构化错误类。
 * 
 * @module @aotui/runtime/spi/core/errors
 */

import type { OperationError } from './operations.js';

// ============================================================================
// Error Code Registry (按域分组)
// ============================================================================

/**
 * AOTUI 错误码常量
 * 
 * 命名规范: DOMAIN_SPECIFIC_ERROR
 * 例如: DESKTOP_NOT_FOUND, VIEW_DUPLICATE
 */
export const ERROR_CODES = {
    // ─────────────────────────────────────────────────────────────
    //  Desktop Domain
    // ─────────────────────────────────────────────────────────────
    DESKTOP_NOT_FOUND: 'DESKTOP_NOT_FOUND',
    DESKTOP_DISPOSED: 'DESKTOP_DISPOSED',
    DESKTOP_LOCKED: 'DESKTOP_LOCKED',

    // ─────────────────────────────────────────────────────────────
    //  App Domain
    // ─────────────────────────────────────────────────────────────
    APP_NOT_FOUND: 'APP_NOT_FOUND',
    APP_LOAD_FAILED: 'APP_LOAD_FAILED',
    APP_INVALID_MANIFEST: 'APP_INVALID_MANIFEST',
    APP_INVALID_EXPORT: 'APP_INVALID_EXPORT',

    // ─────────────────────────────────────────────────────────────
    //  View Domain
    // ─────────────────────────────────────────────────────────────
    VIEW_NOT_FOUND: 'VIEW_NOT_FOUND',
    VIEW_DUPLICATE: 'VIEW_DUPLICATE',
    VIEW_PARENT_NOT_FOUND: 'VIEW_PARENT_NOT_FOUND',
    VIEW_ROOT_EXISTS: 'VIEW_ROOT_EXISTS',
    VIEW_MOUNTABLE_NOT_FOUND: 'VIEW_MOUNTABLE_NOT_FOUND',
    VIEW_INVALID_FACTORY: 'VIEW_INVALID_FACTORY',

    // ─────────────────────────────────────────────────────────────
    //  ViewLink Domain (RFC-006)
    // ─────────────────────────────────────────────────────────────
    LINK_DUPLICATE: 'LINK_DUPLICATE',
    LINK_NOT_FOUND: 'LINK_NOT_FOUND',

    // ─────────────────────────────────────────────────────────────
    //  Operation Domain
    // ─────────────────────────────────────────────────────────────
    OPERATION_NOT_FOUND: 'OPERATION_NOT_FOUND',
    OPERATION_INVALID_ARGS: 'OPERATION_INVALID_ARGS',
    OPERATION_NO_HANDLER: 'OPERATION_NO_HANDLER',
    OPERATION_DUPLICATE: 'OPERATION_DUPLICATE',
    OPERATION_REQUIRES_CONTEXT: 'OPERATION_REQUIRES_CONTEXT',

    // ─────────────────────────────────────────────────────────────
    //  Worker Domain
    // ─────────────────────────────────────────────────────────────
    WORKER_TIMEOUT: 'WORKER_TIMEOUT',
    WORKER_NOT_STARTED: 'WORKER_NOT_STARTED',
    WORKER_TERMINATED: 'WORKER_TERMINATED',

    // ─────────────────────────────────────────────────────────────
    //  Snapshot Domain
    // ─────────────────────────────────────────────────────────────
    SNAPSHOT_NOT_FOUND: 'SNAPSHOT_NOT_FOUND',
    SNAPSHOT_EXPIRED: 'SNAPSHOT_EXPIRED',

    // ─────────────────────────────────────────────────────────────
    //  Config Domain
    // ─────────────────────────────────────────────────────────────
    CONFIG_INVALID: 'CONFIG_INVALID',
    CONFIG_NOT_SUPPORTED: 'CONFIG_NOT_SUPPORTED',

    // ─────────────────────────────────────────────────────────────
    //  Context Domain (SDK)
    // ─────────────────────────────────────────────────────────────
    CONTEXT_NOT_FOUND: 'CONTEXT_NOT_FOUND',

    // ─────────────────────────────────────────────────────────────
    //  Generic
    // ─────────────────────────────────────────────────────────────
    RUNTIME_SHUTDOWN: 'RUNTIME_SHUTDOWN',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
    EXECUTION_FAILED: 'EXECUTION_FAILED',
} as const;

/**
 * 错误码类型
 */
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// ============================================================================
// Error Message Templates
// ============================================================================

type MessageFormatter = (ctx: Record<string, unknown>) => string;

/**
 * 错误消息模板
 * 
 * 每个错误码对应一个消息格式化函数，接收 context 参数生成人类可读的消息。
 */
const ERROR_MESSAGES: Record<ErrorCode, MessageFormatter> = {
    // Desktop
    DESKTOP_NOT_FOUND: (c) => `Desktop '${c.desktopId ?? 'unknown'}' not found`,
    DESKTOP_DISPOSED: (c) => `Desktop '${c.desktopId ?? 'unknown'}' has been disposed`,
    DESKTOP_LOCKED: (c) => `Desktop '${c.desktopId ?? 'unknown'}' is locked by '${c.ownerId ?? 'unknown'}'`,

    // App
    APP_NOT_FOUND: (c) => `App '${c.appId ?? 'unknown'}' not found${c.desktopId ? ` in Desktop '${c.desktopId}'` : ''}`,
    APP_LOAD_FAILED: (c) => `Failed to load app '${c.appId ?? c.modulePath ?? 'unknown'}': ${c.reason ?? 'unknown error'}`,
    APP_INVALID_MANIFEST: (c) => `Invalid manifest for app module '${c.modulePath ?? 'unknown'}'`,
    APP_INVALID_EXPORT: (c) => `App module '${c.modulePath ?? 'unknown'}' has invalid export: expected default or app`,

    // View
    VIEW_NOT_FOUND: (c) => `View '${c.viewId ?? 'unknown'}' not found`,
    VIEW_DUPLICATE: (c) => `View '${c.viewId ?? 'unknown'}' already exists`,
    VIEW_PARENT_NOT_FOUND: (c) => `Parent view '${c.parentId ?? 'unknown'}' not found`,
    VIEW_ROOT_EXISTS: (c) => `Root view already exists. Remove it first.`,
    VIEW_MOUNTABLE_NOT_FOUND: (c) => `Mountable view '${c.viewId ?? 'unknown'}' not registered`,
    VIEW_INVALID_FACTORY: (c) => `Invalid factory for view '${c.viewId ?? 'unknown'}'. Expected function or Factory object`,

    // ViewLink (RFC-006)
    LINK_DUPLICATE: (c) => `Duplicate LinkID '${c.linkId ?? 'unknown'}' in parent view '${c.parentId ?? 'unknown'}'`,
    LINK_NOT_FOUND: (c) => `Link '${c.linkId ?? 'unknown'}' not found in parent view '${c.parentId ?? 'unknown'}'`,

    // Operation
    OPERATION_NOT_FOUND: (c) => `Operation '${c.operationName ?? 'unknown'}' not found`,
    OPERATION_INVALID_ARGS: (c) => `Invalid arguments for operation '${c.operationName ?? 'unknown'}': ${c.reason ?? 'validation failed'}`,
    OPERATION_NO_HANDLER: (c) => `No handler registered for operation '${c.operationName ?? 'unknown'}'`,
    OPERATION_DUPLICATE: (c) => `Operation '${c.operationName ?? 'unknown'}' is already registered`,
    OPERATION_REQUIRES_CONTEXT: (c) => `Operation '${c.operationName ?? 'unknown'}' requires an App context`,

    // Worker
    WORKER_TIMEOUT: (c) => `Worker request timed out after ${c.timeoutMs ?? 30000}ms`,
    WORKER_NOT_STARTED: (c) => `Worker '${c.appId ?? 'unknown'}' not started`,
    WORKER_TERMINATED: (c) => `Worker '${c.appId ?? 'unknown'}' has been terminated`,

    // Snapshot
    SNAPSHOT_NOT_FOUND: (c) => `Snapshot '${c.snapshotId ?? 'unknown'}' not found`,
    SNAPSHOT_EXPIRED: (c) => `Snapshot '${c.snapshotId ?? 'unknown'}' has expired`,

    // Config
    CONFIG_INVALID: (c) => `Invalid configuration: ${c.reason ?? 'unknown'}`,
    CONFIG_NOT_SUPPORTED: (c) => `Configuration not supported: ${c.feature ?? 'unknown'}`,

    // Context
    CONTEXT_NOT_FOUND: (c) => `${c.contextName ?? 'Context'} not found. Ensure component is wrapped in proper Provider.`,

    // Generic
    RUNTIME_SHUTDOWN: (c) => `Runtime has been shut down${c.reason ? `: ${c.reason}` : ''}`,
    INTERNAL_ERROR: (c) => `Internal error: ${c.message ?? 'unknown'}`,
    NOT_IMPLEMENTED: (c) => `Not implemented: ${c.feature ?? 'unknown'}`,
    EXECUTION_FAILED: (c) => `Execution failed: ${c.message ?? 'unknown'}`,
};

// ============================================================================
// AOTUIError Class
// ============================================================================

/**
 * AOTUI 框架错误基类
 * 
 * 提供结构化错误信息，包含类型安全的错误码和上下文数据。
 * 
 * @example
 * ```typescript
 * // 抛出错误
 * throw new AOTUIError('DESKTOP_NOT_FOUND', { desktopId: 'abc123' });
 * 
 * // 转换为 OperationResult
 * catch (e) {
 *     if (AOTUIError.is(e)) {
 *         return { success: false, error: e.toOperationError() };
 *     }
 * }
 * ```
 */
export class AOTUIError extends Error {
    /**
     * 错误码 (类型安全)
     */
    readonly code: ErrorCode;

    /**
     * 错误上下文 (结构化调试信息)
     */
    readonly context: Record<string, unknown>;

    /**
     * 错误发生时间戳
     */
    readonly timestamp: number;

    constructor(code: ErrorCode, context: Record<string, unknown> = {}) {
        const message = AOTUIError.formatMessage(code, context);
        super(message);

        this.name = 'AOTUIError';
        this.code = code;
        this.context = context;
        this.timestamp = Date.now();

        // 保持原型链正确 (TypeScript 继承 Error 的已知问题)
        Object.setPrototypeOf(this, AOTUIError.prototype);
    }

    /**
     * 转换为 OperationError
     * 
     * 用于在 OperationResult 中返回错误信息
     */
    toOperationError(): OperationError {
        return {
            code: this.code,
            message: this.message,
            context: this.context,
        };
    }

    /**
     * 类型守卫: 检查是否为 AOTUIError
     */
    static is(error: unknown): error is AOTUIError {
        return error instanceof AOTUIError;
    }

    /**
     * 从普通 Error 创建 AOTUIError
     * 
     * 用于包装未知错误
     */
    static fromError(error: unknown, code: ErrorCode = 'INTERNAL_ERROR'): AOTUIError {
        if (AOTUIError.is(error)) {
            return error;
        }

        const message = error instanceof Error ? error.message : String(error);
        return new AOTUIError(code, { message, originalError: error });
    }

    /**
     * 格式化错误消息
     */
    private static formatMessage(code: ErrorCode, context: Record<string, unknown>): string {
        const formatter = ERROR_MESSAGES[code];
        if (formatter) {
            return formatter(context);
        }
        return `[${code}]`;
    }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * 创建 OperationError (不抛出异常)
 * 
 * 用于构造 OperationResult.error
 */
export function createOperationError(
    code: ErrorCode,
    context: Record<string, unknown> = {}
): OperationError {
    return new AOTUIError(code, context).toOperationError();
}

/**
 * 失败的 OperationResult 快捷构造
 */
export function failedResult(
    code: ErrorCode,
    context: Record<string, unknown> = {}
): { success: false; error: OperationError } {
    return {
        success: false,
        error: createOperationError(code, context),
    };
}
