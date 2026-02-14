/**
 * AOTUI SDK - View Runtime Context
 *
 * [RFC-004] 统一的 View 运行时上下文
 *
 * 将原有的 7 个独立 Context Provider 合并为单一 Context，
 * 配合 Selector Hook 实现细粒度订阅。
 *
 * @module @aotui/sdk/contexts/view-runtime-context
 */
import { createContext } from "preact";
import type {
  IViewMeta,
  IOperationRegistry,
  IMountableViewRegistry,
  IDynamicViewRegistry,
  IRefRegistry,
  ITypeToolRegistry,
  IAppConfig,
} from "./index.js";
import type { LLMOutputEvent, LLMOutputListener } from "@aotui/runtime/spi";

// ═══════════════════════════════════════════════════════════════
//  LLM Output Channel Context (RFC-011)
// ═══════════════════════════════════════════════════════════════

/**
 * SDK 侧的 LLM 文本通道接口
 * 
 * View 通过此接口订阅 LLM 文本输出。
 */
export interface ILLMOutputChannelContext {
  /** 
   * 订阅 LLM 文本事件
   * @returns 取消订阅函数
   */
  subscribe(listener: LLMOutputListener): () => void;

  /** 获取历史消息 */
  getHistory(): LLMOutputEvent[];
}

// ═══════════════════════════════════════════════════════════════
//  统一 Context 值接口
// ═══════════════════════════════════════════════════════════════

/**
 * 统一的 View 运行时上下文值
 *
 * [RFC-004] 合并原有 6 个独立 Context 的数据
 *
 * 设计原则:
 * 1. 所有字段使用 readonly 防止意外修改
 * 2. 公共 API (meta) 与内部 API 清晰分离
 * 3. 每个子接口保持独立，便于 Selector 细粒度选择
 */
export interface ViewRuntimeContextValue {
  // ═══════════════════════════════════════════════════════════
  // 公共 API - 应用开发者可使用
  // ═══════════════════════════════════════════════════════════

  /** View 元数据 (viewId, appId, desktopId, markDirty) */
  readonly meta: Readonly<IViewMeta>;

  // ═══════════════════════════════════════════════════════════
  // 内部 API - 仅 SDK 组件/Hooks 使用
  // ═══════════════════════════════════════════════════════════

  /** Operation 注册表 - <Operation> */
  readonly operations: Readonly<IOperationRegistry>;

  /** 可挂载视图注册表 - <ViewLink> */
  readonly mountable: Readonly<IMountableViewRegistry>;

  /** 动态子视图注册表 - <ChildView> */
  readonly dynamic: Readonly<IDynamicViewRegistry>;

  /** Ref 注册表 - useArrayRef, useRef */
  readonly refs: Readonly<IRefRegistry>;

  /** Type Tool 注册表 - useViewTypeTool (RFC-020) */
  readonly typeTools: Readonly<ITypeToolRegistry>;

  /** App 配置 - useAppEnv */
  readonly config: Readonly<IAppConfig>;

  // ═══════════════════════════════════════════════════════════
  // LLM Output Channel (RFC-011)
  // ═══════════════════════════════════════════════════════════

  /** LLM 文本通道 - useLLMOutputChannel */
  readonly llmOutput: Readonly<ILLMOutputChannelContext>;
}

// ═══════════════════════════════════════════════════════════════
//  Context 实例
// ═══════════════════════════════════════════════════════════════

/**
 * 统一运行时 Context
 *
 * [RFC-004] 取代原有的 7 层 Provider 嵌套
 */
export const ViewRuntimeContext = createContext<ViewRuntimeContextValue | null>(
  null,
);
ViewRuntimeContext.displayName = "AOTUI.ViewRuntime";
