/**
 * SPI Layer - Operation Types
 * 
 * 定义 Agent 与 Runtime 之间的操作交互协议。
 * 
 * 术语说明:
 * - Operation: 内部统一抽象，替代旧的 Command
 * - ToolCall: 外部 LLM 接口 (保持不变)
 * 
 * @module @aotui/runtime/spi
 */

import type { AppID, ViewID, SnapshotID, OperationID, DesktopID } from './types.js';
import type { Tool } from './tool-call.js';

// ============================================================================
// Operation Context (原 CommandContext)
// ============================================================================

/**
 * 操作上下文
 * 
 * 指定操作的目标位置 (App + View)
 */
export interface OperationContext {
    /** 目标 App ID */
    appId: AppID;

    /** 
     * 目标 View ID (可选)
     * 
     * 如果提供，操作路由到该 View
     * 如果不提供，操作作为 App 级操作处理
     */
    viewId?: ViewID;

    /**
     * 快照 ID (可选，用于数据引用解析)
     */
    snapshotId: SnapshotID;
}

// ============================================================================
// Operation (原 Command)
// ============================================================================

/**
 * 操作范围
 * 
 * 用于区分操作的目标层级
 */
export type OperationScope = 'system' | 'app' | 'view';

/**
 * 操作
 * 
 * 表示 Agent 发送的单个操作指令
 */
export interface Operation {
    /** 操作上下文 (目标 App/View) */
    context: OperationContext;

    /** 操作名称 */
    name: OperationID;

    /** 操作参数 */
    args: Record<string, unknown>;
}

// ============================================================================
// Operation Result (原 CommandAck)
// ============================================================================

/**
 * 操作错误
 *
 * 统一错误模型：
 * - code: 机器可读的错误代码
 * - message: 人类可读的错误描述
 * - context: 额外调试信息（可选）
 */
export interface OperationError {
    /** 错误代码（机器可读），如 E_INVALID_ARGS, E_NOT_FOUND */
    code: string;
    /** 错误描述（人类可读） */
    message: string;
    /** 额外上下文信息（可选，用于调试） */
    context?: Record<string, unknown>;
}

/**
 * 操作结果
 */
export interface OperationResult {
    success: boolean;
    data?: Record<string, unknown>;
    error?: OperationError;
}

// ============================================================================
// Operation Payload (Dispatcher -> Desktop)
// ============================================================================

/**
 * 操作载荷
 * 
 * 用于 Dispatcher 将已解析的操作传递给 Desktop。
 * Desktop 负责将此载荷分发给具体的 App 容器。
 */
export interface OperationPayload {
    /** 完整操作上下文 */
    context: OperationContext;

    /** 操作名称 */
    operation: OperationID;

    /** 已解析的参数 (Snapshot 引用已替换为实际数据) */
    args: Record<string, unknown>;

    /** 元数据 */
    meta?: {
        snapshotId?: SnapshotID;
    };
}

// ============================================================================
// System Operation Interface
// ============================================================================

/**
 * 系统操作上下文
 * 
 * 供 SystemOperation 执行时使用
 */
export interface SystemOperationContext {
    /** Desktop ID */
    desktopId: DesktopID;
    /** 操作参数 */
    args: Record<string, unknown>;
}

/**
 * 系统操作接口
 * 
 * 所有系统级操作（如 open_app, mount_view）必须实现此接口。
 * 系统操作在编译时固定注册，不支持动态注册。
 * 
 * @example
 * ```typescript
 * class OpenAppOperation implements ISystemOperation {
 *     readonly name = 'open';
 *     readonly aliases = ['open_app'];
 *     
 *     async execute(ctx: SystemOperationContext, desktop: IDesktop): Promise<OperationResult> {
 *         const appId = ctx.args.application as string;
 *         await desktop.openApp(appId);
 *         return { success: true };
 *     }
 * }
 * ```
 */
export interface ISystemOperation {
    /** 
     * 操作名称 (主名称)
     * 
     * 用于注册和查找，如 'open', 'mount'
     */
    readonly name: string;

    /**
     * 操作别名 (可选)
     * 
     * 用于向后兼容或语义别名，如 'expand' 是 'show' 的别名
     */
    readonly aliases?: readonly string[];

    /**
     * 执行操作
     * 
     * @param ctx - 系统操作上下文 (包含 desktopId 和 args)
     * @param desktop - 目标 Desktop 实例
     * @returns 操作结果
     */
    execute(ctx: SystemOperationContext, desktop: IDesktopForOperation): Promise<OperationResult>;

    /**
     * Tool Definition (RFC-009)
     * 
     * The LLM Tool Specification for this operation.
     * Runtime uses this to generate the system tools list for the Agent.
     */
    readonly toolDefinition: Tool;
}

/**
 * Desktop 接口 (供 SystemOperation 使用)
 * 
 * 仅暴露 SystemOperation 需要的方法，避免完整 IDesktop 依赖。
 * 这是接口隔离原则 (ISP) 的体现。
 */
export interface IDesktopForOperation {
    readonly id: DesktopID;

    // App 操作
    openApp(appId: AppID): Promise<void>;
    closeApp(appId: AppID): Promise<void>;
    collapseApp(appId: AppID): Promise<void>;
    showApp(appId: AppID): Promise<void>;

    // View 操作

    dismountView(appId: AppID, viewId: ViewID): Promise<void>;
    hideView(appId: AppID, viewId: ViewID): Promise<void>;
    showView(appId: AppID, viewId: ViewID): Promise<void>;

    // [RFC-006] ViewLink 挂载
    mountViewByLink(appId: AppID, parentViewId: ViewID, linkId: string): Promise<void>;
}

// ============================================================================
// System Operation Registry Interface
// ============================================================================

/**
 * 系统操作注册表接口
 * 
 * 管理所有系统级操作的注册和查找。
 */
export interface ISystemOperationRegistry {
    /**
     * 注册系统操作
     */
    register(operation: ISystemOperation): void;

    /**
     * 检查操作是否存在
     */
    has(name: string): boolean;

    /**
     * 获取操作 (通过名称或别名)
     */
    get(name: string): ISystemOperation | undefined;

    /**
     * 执行系统操作
     */
    execute(
        name: string,
        ctx: SystemOperationContext,
        desktop: IDesktopForOperation
    ): Promise<OperationResult>;

    /**
     * Get all tool definitions (RFC-009)
     */
    getToolDefinitions(): Tool[];
}
