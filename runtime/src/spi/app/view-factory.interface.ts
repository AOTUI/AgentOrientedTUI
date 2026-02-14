/**
 * SPI Layer - IViewFactory Interface
 *
 * View Factory 接口，由 SDK 提供，
 * 用于创建 IView 实例。
 *
 * [方案 B] 从 SDK 提升到 SPI 层，使 Runtime 可以引用此类型
 * 而不依赖 SDK 具体实现。
 *
 * @module @aotui/runtime/spi/app
 */
import type { IView } from './view.interface.js';

/**
 * View Factory Interface
 *
 * 工厂函数，用于创建 IView 实例。
 * SDK 返回符合此接口的工厂。
 *
 * @example
 * ```typescript
 * // SDK 端
 * const ChatView = (viewId: string) => new ChatViewImpl(viewId);
 *
 * // Runtime 端
 * const view: IView = ChatView('view_0');
 * ```
 */
export interface IViewFactory {
    /**
     * 创建 View 实例
     * @param viewId - View 唯一标识符
     * @param props - 可选的初始属性
     * @returns IView 实例
     */
    (viewId: string, props?: Record<string, unknown>): IView;

    /**
     * View 显示名称
     * 用于 ViewTree 输出和调试信息
     */
    displayName?: string;

    /**
     * 可选：统一工厂接口
     * 与直接调用等价：factory.create(id) === factory(id)
     */
    create?: (viewId: string, props?: Record<string, unknown>) => IView;
}
