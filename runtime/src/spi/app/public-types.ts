/**
 * SPI App Layer - Public Types for App Developers
 *
 * [P4/P5 FIX] 类型定义碎片化修复
 *
 * 这些接口是 App 开发者可见的公共 API。
 * SDK 应该 re-export 这些类型，而不是定义自己的版本。
 *
 * 设计原则:
 * 1. 使用 string 替代 Branded Types (AppID, ViewID 等) - 降低开发者心智负担
 * 2. 只暴露 App 开发者需要的最小接口 - 接口隔离原则 (ISP)
 * 3. 作为 SSOT (Single Source of Truth) - SDK 和应用层都从这里导入
 *
 * @module @aotui/runtime/spi/app/public-types
 */

// Import IView for type safety
import type { IView } from './view.interface.js';

// ============================================================================
// IViewMeta - View 元数据 (App 开发者可见)
// ============================================================================

/**
 * View 元数据接口 - App 开发者的公共 API
 *
 * 这是 App 开发者通过 `useViewContext()` 获取的上下文类型。
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *     const ctx = useViewContext();
 *     console.log('Current view:', ctx.viewId);
 *     console.log('Desktop:', ctx.desktopId);
 *
 *     // 标记 View 需要更新
 *     ctx.markDirty();
 * }
 * ```
 */
export interface IViewMeta {
    /** 当前 View 的唯一标识符 */
    readonly viewId: string;

    /**
     * 当前View的类型 (用于Tool聚合)
     * 
     * @optional
     */
    readonly viewType?: string;

    /** 父 App 的唯一标识符 */
    readonly appId: string;

    /** Desktop 的唯一标识符 (用于加载相关数据，如历史记录) */
    readonly desktopId: string;

    /**
     * 标记 View 为 dirty，触发 UpdateSignal
     *
     * 数据链路: markDirty() → Preact render → MutationObserver → UpdateSignal
     */
    markDirty(): void;
}

// ============================================================================
// IRefRegistry - Ref 注册表 (App 开发者可见)
// ============================================================================

/**
 * Ref 注册表接口 - App 开发者的公共 API
 *
 * 用于 `useArrayRef` 等 Hooks 内部注册数据引用。
 * App 开发者通常不直接使用此接口，而是通过 Hooks。
 *
 * @internal 主要供 SDK Hooks 使用
 */
export interface IRefRegistry {
    /**
     * 注册数据引用
     *
     * @param refId - 引用 ID (View 内唯一)
     * @param data - 绑定的数据对象
     */
    registerRef(refId: string, data: object): void;

    /**
     * 注销数据引用
     *
     * @param refId - 要注销的引用 ID
     */
    unregisterRef(refId: string): void;
}

// ============================================================================
// ITypeToolRegistry - Type Tool 注册表 (RFC-020)
// ============================================================================

/**
 * Type Tool 定义
 * 
 * Type Tool 是绑定到 View Type 而非 View 实例的工具。
 * 例如: FileDetail 类型的所有 View 共享同一组 LSP tools。
 */
export interface TypeToolDefinition {
    /** 工具描述,发送给 LLM */
    description: string;

    /** 参数定义 (可选) */
    params?: unknown;

    /** 工具处理函数 */
    handler: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Type Tool 注册表接口
 *
 * [RFC-020] Type Tool Aggregation
 * 
 * **设计背景**:
 * - 原方案使用 DOM 事件注册,但 LinkedOM 的事件冒泡机制不可靠
 * - 改为直接 API 调用,与 IRefRegistry 架构一致
 * 
 * **核心价值**:
 * - 避免重复注册: 10个 FileDetailView 只注册 8 个 LSP tools (不是 80 个)
 * - 动态加载: 根据条件 (如 activeFiles.length > 0) 注册/注销
 * - 职责分离: Root View 管理 Type Tools, Child View 专注业务逻辑
 * 
 * **使用场景**:
 * ```tsx
 * // WorkspaceContent.tsx (Root View)
 * const hasFiles = activeFiles.length > 0;
 * 
 * useViewTypeTool('FileDetail', 'lsp_hover', {
 *   description: `Get type info for: ${activeFiles.join(', ')}`,
 *   params: lspHoverParams,
 *   enabled: hasFiles  // 条件注册
 * }, handler);
 * ```
 * 
 * @internal 主要供 SDK Hooks (useViewTypeTool) 使用
 */
export interface ITypeToolRegistry {
    /**
     * 注册 Type Tool
     * 
     * **重要**: 同一个 (viewType, toolName) 组合只能注册一次。
     * 重复注册会抛出错误,确保工具定义的唯一性。
     * 
     * @param viewType - View 类型 (e.g., "FileDetail", "SearchResult")
     * @param toolName - 工具名称 (e.g., "lsp_hover", "close_search_view")
     * @param toolDef - 工具定义 (description, params, handler)
     * 
     * @throws Error 如果该 Type Tool 已被注册
     * 
     * @example
     * ```ts
     * registry.registerTypeTool('FileDetail', 'lsp_hover', {
     *   description: 'Get type information at cursor position',
     *   params: defineParams({ line: { type: 'number', required: true } }),
     *   handler: async ({ line }) => { ... }
     * });
     * ```
     */
    registerTypeTool(
        viewType: string,
        toolName: string,
        toolDef: TypeToolDefinition
    ): void;

    /**
     * 注销 Type Tool
     * 
     * 通常在组件卸载或条件不满足时调用。
     * 如果工具不存在,静默忽略 (幂等操作)。
     * 
     * @param viewType - View 类型
     * @param toolName - 工具名称
     * 
     * @example
     * ```ts
     * // useEffect cleanup
     * return () => {
     *   registry.unregisterTypeTool('FileDetail', 'lsp_hover');
     * };
     * ```
     */
    unregisterTypeTool(viewType: string, toolName: string): void;

    /**
     * 获取所有已注册的 Type Tools
     * 
     * **内部使用**: 供 Worker Runtime 生成 Snapshot 时调用。
     * App 开发者通常不需要直接调用此方法。
     * 
     * @returns Map<viewType, Map<toolName, toolDef>>
     * 
     * @internal
     */
    getAllTypeTools(): Map<string, Map<string, TypeToolDefinition>>;
}

// ============================================================================
// IViewLinkRegistry - ViewLink 注册表 (App 开发者可见)
// ============================================================================

/**
 * ViewLink 注册选项
 */
export interface RegisterLinkOptions {
    /**
     * LinkID 前缀 (用于列表)
     *
     * SDK 会自动生成: `${prefix}_${index}`
     * 不提供时使用 viewType 作为前缀
     */
    prefix?: string;

    /**
     * 显示标签
     */
    label?: string;
}

/**
 * ViewLink 注册表接口 - App 开发者的公共 API
 *
 * [RFC-006] ViewLink 机制，用于创建可导航的子 View 链接。
 *
 * @example
 * ```tsx
 * function TopicList() {
 *     const topics = [...];
 *     return (
 *         <ul>
 *             {topics.map(topic => (
 *                 <li key={topic.id}>
 *                     <ViewLink
 *                         uniqueId={topic.id}
 *                         view={TopicDetailView}
 *                         props={{ topicId: topic.id }}
 *                     >
 *                         {topic.title}
 *                     </ViewLink>
 *                 </li>
 *             ))}
 *         </ul>
 *     );
 * }
 * ```
 */
export interface IViewLinkRegistry {
    /**
     * 注册一个 ViewLink
     *
     * @param uniqueId - 业务唯一标识 (跨快照稳定)
     * @param viewType - View 类型名称
     * @param factory - View 工厂函数
     * @param props - 传递给 View 的 Props
     * @param options - 注册选项
     * @returns 分配的 LinkID
     */
    registerLink?(
        uniqueId: string,
        viewType: string,
        factory: (viewId: string, props?: Record<string, unknown>) => IView,
        props?: Record<string, unknown>,
        options?: RegisterLinkOptions,
    ): string;

    /**
     * 注销一个 ViewLink
     *
     * @param linkId - 要注销的 LinkID
     */
    unregisterLink?(linkId: string): void;

    /**
     * 获取已绑定的 ViewID (如果有)
     *
     * @param viewType - View 类型名称
     * @param uniqueId - 业务唯一标识
     * @returns ViewID 或 undefined
     */
    getBoundViewId?(viewType: string, uniqueId: string): string | undefined;
}

// ============================================================================
// Backward Compatibility Aliases
// ============================================================================

/**
 * @deprecated 使用 IViewLinkRegistry 替代
 */
export type IMountableViewRegistry = IViewLinkRegistry;

// ============================================================================
// IOperationRegistry - Operation 注册表 (App 开发者可见)
// ============================================================================

// Import OperationResult from core
import type { OperationResult } from '../core/operations.js';

/**
 * 简化的 Operation Handler 类型
 *
 * 用于内部 Context 注册，不包含类型推断。
 * 公共 API 请使用 `OperationHandler` from '@aotui/sdk'。
 */
export type SimpleOperationHandler = (
    args: Record<string, unknown>,
) => Promise<OperationResult> | OperationResult;

/**
 * Operation 注册表接口 - App 开发者的公共 API
 *
 * 用于 SDK Hooks 内部注册操作处理器。
 * App 开发者通常不直接使用此接口，而是通过 Hooks。
 *
 * @internal 主要供 SDK Hooks 使用
 */
export interface IOperationRegistry {
    /**
     * 注册 Operation handler
     *
     * @param name - 操作名称
     * @param handler - 操作处理函数
     */
    registerOperation(name: string, handler: SimpleOperationHandler): void;

    /**
     * 注销 Operation handler
     *
     * @param name - 要注销的操作名称
     */
    unregisterOperation(name: string): void;
}

// ============================================================================
// IDynamicViewRegistry - 动态子视图注册表 (App 开发者可见)
// ============================================================================

/**
 * 动态子视图注册表接口
 *
 * 用于动态创建和销毁子 View。
 *
 * @internal 主要供 SDK 内部使用
 */
export interface IDynamicViewRegistry {
    /**
     * 注册动态子视图
     *
     * @param view - IView 实例
     * @returns 分配的 ViewID
     */
    registerChildView(view: IView): string;

    /**
     * 注销动态子视图
     *
     * @param viewId - 要注销的 ViewID
     */
    unregisterChildView(viewId: string): void;
}

// ============================================================================
// IAppConfig - 应用配置 (App 开发者可见)
// ============================================================================

/**
 * 应用配置接口
 *
 * 通过 `useAppEnv` Hook 获取环境变量。
 */
export interface IAppConfig {
    /** 环境变量 */
    env?: Record<string, string | number | boolean>;

    /** 初始状态 */
    initialState?: Record<string, unknown>;
}
