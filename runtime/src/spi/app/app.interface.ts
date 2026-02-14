/**
 * SPI Layer - App Interface
 * 
 * 定义 App 的契约。只有接口，没有实现。
 * AOTUIApp 抽象基类在 SDK 层。
 */

import type { AppID, OperationID } from '../core/types.js';
import type { OperationContext, OperationResult } from '../core/operations.js';
import type { AppContext } from './store.interface.js';

/**
 * AOTUI App 接口
 *
 * 所有 App 必须实现此接口。定义了 App 的生命周期和核心交互方法。
 *
 * 生命周期:
 * ```
 * onOpen() → [运行中] → onPause() → [暂停] → onResume() → [运行中] → onClose()
 * ```
 */
export interface IAOTUIApp {
    /** 
     * App 唯一标识
     * 
     * 如果不提供，Runtime 会自动分配 (app_0, app_1, ...)
     */
    id?: AppID;

    /** App 语义名称 */
    readonly name: string;

    /**
     * App 打开时调用
     * 
     * 在此方法中进行初始化工作：
     * - 从存储加载数据
     * - 渲染初始 UI
     * - 设置事件监听
     * 
     * @param context - App 运行上下文（包含 store 和 notifyUpdate）
     * @param container - App 的 DOM 容器
     */
    onOpen(context: AppContext, container: HTMLElement): Promise<void>;

    /**
     * App 关闭时调用
     * 
     * 在此方法中进行清理工作：
     * - 断开网络连接
     * - 清理定时器
     * - 保存未持久化的状态
     */
    onClose(): Promise<void>;

    /**
     * [RFC-015] App 删除时调用（可选）
     * 
     * 在此方法中进行数据清理工作：
     * - 删除持久化存储 (IndexedDB, SQLite)
     * - 删除文件
     * 
     * 注意：onDelete() 执行完后框架会自动调用 onClose()，
     * 所以只需关注数据清理，不需要重复资源释放逻辑。
     */
    onDelete?(): Promise<void>;

    /**
     * Desktop 暂停时调用（可选）
     */
    onPause?(): Promise<void>;

    /**
     * Desktop 恢复时调用（可选）
     */
    onResume?(): Promise<void>;

    /**
     * 处理 Agent 发送的操作
     * 
     * @param context - 操作上下文 (包含 appId 和可选的 viewId)
     * @param operation - 操作名称
     * @param args - 操作参数
     */
    onOperation(
        context: OperationContext,
        operation: OperationID,
        args: Record<string, unknown>
    ): Promise<OperationResult>;

    /**
     * [RFC-007] Render View Tree
     * 
     * Optional method to render the application's view tree in Markdown format.
     * Used for TUI snapshots.
     */
    renderViewTree?(): string;
}

