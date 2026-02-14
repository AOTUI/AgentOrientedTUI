/**
 * SPI Layer - IView Interface
 * 
 * [H1 FIX] 从 Engine 层提取的 View 接口定义。
 * 
 * View 是 App 内部的 UI 组件单元。每个 View:
 * - 有自己的数据状态
 * - 有自己的操作集合 (operations)
 * - 可以被 mount/dismount
 * - 处理针对自己的操作
 * 
 * @module @aotui/runtime/spi
 */

import type { OperationID, ViewID } from '../core/types.js';
import type { OperationResult } from '../core/operations.js';

// ============================================================================
// ViewContext - View 运行上下文
// ============================================================================

import type { IViewContextCore } from './view-context-core.interface.js';

/**
 * Level 2: View 运行上下文 (Full Contract)
 * 
 * SDK 内部使用的完整上下文，包含生命周期管理能力。
 * 继承自 Core 契约。
 */
export interface IViewContext extends IViewContextCore {


    /**
     * [Option D] 标记 View 为 dirty
     * 
     * Runtime 会在收到 DOM_UPDATE 后检查 dirty 标记，才实际发送 UpdateSignal。
     */
    markDirty(): void;

    /**
     * 请求 mount 子 View
     */
    mountChildView(viewId: ViewID): Promise<void>;

    /**
     * 请求 dismount 子 View
     */
    dismountChildView(viewId: ViewID): Promise<void>;

    // ═══════════════════════════════════════════════════════════════
    //  Dynamic Child View Registration (Option D: Component-Centric)
    // ═══════════════════════════════════════════════════════════════

    /**
     * Register a dynamic child view
     * 
     * Called by `<ChildView>` component to register a dynamically created view.
     * The system assigns a sequential ViewID (view_0, view_1, ...).
     * 
     * @param view - The IView instance to register
     * @returns The assigned ViewID
     */
    registerChildView(view: IView): ViewID;

    /**
     * Unregister a dynamic child view
     * 
     * Called when `<ChildView>` unmounts. Dismounts and removes the view.
     * 
     * @param viewId - The ViewID to unregister
     */
    unregisterChildView(viewId: ViewID): void;
}

// Import extension interface for composite type
import type { IViewContextMountable } from './view-context-ext.interface.js';

/**
 * Level 2+3: Full ViewContext (Composite Type)
 * 
 * SDK 内部使用的完整上下文，包含 Core + Full + Mountable 所有能力。
 * 用于 AppRuntime 创建的实际 context 对象。
 */
export type IViewContextFull = IViewContext & IViewContextMountable;

// ============================================================================
// IView - View 接口
// ============================================================================

/**
 * AOTUI View 接口
 * 
 * View 是 App 内部的 UI 组件单元。每个 View:
 * - 有自己的数据状态
 * - 有自己的操作集合 (operations)
 * - 可以被 mount/dismount
 * - 处理针对自己的操作
 */
export interface IView {
    /** View 唯一标识符 (developer-specified in component mode) */
    readonly id: ViewID;

    /** View 显示名称 (开发者定义的语义名称) */
    readonly name?: string;

    /**
     * View 的显示名称，用于调试、日志和开发工具。
     * @optional
     */
    readonly displayName?: string;

    /**
     * View 类型 (用于Tool聚合)
     * 
     * Multiple views can share the same type.
     * Used for grouping tools by view type in Snapshot.
     * 
     * @optional
     * @example "FileDetail", "UserProfile", "Workspace"
     */
    readonly type?: string;

    /**
     * 由 Runtime 调用设置 ID (可选，框架内部使用)
     */
    setId?(newId: ViewID): void;

    /**
     * View 被 mount 时调用
     * 
     * @param context - View 运行上下文
     */
    onMount(context: IViewContext): Promise<void>;

    /**
     * View 被 dismount 时调用
     */
    onDismount(): Promise<void>;

    /**
     * 处理针对此 View 的操作
     * 
     * @param operation - 操作名称 (如 'send_message')
     * @param args - 操作参数
     * @returns 操作执行结果
     */
    onOperation(operation: OperationID, args: Record<string, unknown>): Promise<OperationResult>;

    /**
     * 渲染 View 内容
     * 
     * 返回 TUI Markdown 格式的内容
     */
    render(): string;
}
