/**
 * AOTUI SDK - useAppOperation Hook
 *
 * RFC-003: Operation 作用域与生命周期设计
 *
 * 注册 App-scoped Operation，生命周期与 App 绑定。
 * 无论当前哪个 View 处于激活状态，都可被 Agent 调用。
 *
 * @example 基础用法
 * ```tsx
 * function ChatAppRoot() {
 *     const [SwitchTopicUI] = useAppOperation('switch_topic', {
 *         description: '切换对话',
 *         params: defineParams({ topicId: { type: 'string', required: true } })
 *     }, async (args) => {
 *         await switchToTopic(args.topicId);
 *         return { success: true };
 *     });
 *
 *     return (
 *         <>
 *             <GlobalToolbar>
 *                 <SwitchTopicUI>切换</SwitchTopicUI>
 *             </GlobalToolbar>
 *             <ChatView />
 *         </>
 *     );
 * }
 * ```
 *
 * @module @aotui/sdk/hooks/useAppOperation
 */

import { h, type VNode, type ComponentChildren } from "preact";
import { useEffect, useRef, useMemo, useContext } from "./preact-hooks.js";
import { TUIAppContext, type AppOperationHandler } from "./app-context.js";
import { validateArgs, formatValidationErrors } from "../utils/validateArgs.js";
import { assertValidOperationName } from "../utils/validation.js";

// [SSOT] Import types from operation/types.ts
import type {
  ParamSchema,
  ParamType,
  ParamBaseType,
  ParamConstraints,
  InferArgs,
  OperationHandler,
  OperationResult,
  OperationHandlerContext,
} from "../operation/types.js";

// ─────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────

/**
 * App Operation 定义选项
 */
export interface AppOperationOptions<T extends ParamSchema = ParamSchema> {
  /** 描述（显示给 Agent） */
  description: string;
  /** 参数定义 */
  params?: T;
}

/**
 * App Operation UI 渲染器组件 Props
 */
export interface AppOperationUIProps {
  /** 按钮文字（children） */
  children?: ComponentChildren;
  /** 额外的 CSS 类名 */
  className?: string;
  /** 禁用状态 */
  disabled?: boolean;
}

/**
 * App Operation UI 渲染器类型
 */
export type AppOperationUI = (props: AppOperationUIProps) => VNode;

/**
 * useAppOperation 返回值
 */
export type UseAppOperationResult = [AppOperationUI];

// ─────────────────────────────────────────────────────────────
//  Hook Implementation
// ─────────────────────────────────────────────────────────────

/**
 * 注册一个 App-scoped Operation
 *
 * 生命周期与 App 绑定：App open 时可用，close 时注销。
 * 无论当前哪个 View 激活，Agent 都可调用此 Operation。
 *
 * @param name - Operation 名称（snake_case，如 switch_topic）
 * @param options - Operation 定义选项
 * @param handler - 执行处理函数
 * @returns [AppOperationUI] - 可选的 UI 渲染器组件
 */
export function useAppOperation<T extends ParamSchema = ParamSchema>(
  name: string,
  options: AppOperationOptions<T>,
  handler: OperationHandler<InferArgs<T>>,
): UseAppOperationResult {
  const { description, params } = options;

  // 获取 App Context
  const appCtx = useContext(TUIAppContext);
  if (!appCtx) {
    throw new Error(
      "[AOTUI SDK] useAppOperation must be used within an App context.\n" +
        "Tip: Ensure you are using createTUIApp() or your App provides AppContext.",
    );
  }

  const {
    registerAppOperation,
    unregisterAppOperation,
    appId,
    desktopId,
    markAppDirty,
  } = appCtx;

  // 开发环境校验 Operation 名称
  if (process.env.NODE_ENV !== "production") {
    assertValidOperationName(name, "useAppOperation");
  }

  // 使用 ref 保存最新 handler
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // 注册 App Operation
  useEffect(() => {
    const stableHandler: AppOperationHandler = async (
      args: Record<string, unknown>,
    ): Promise<OperationResult> => {
      // 运行时参数验证
      if (params) {
        const errors = validateArgs(args, params);
        if (errors.length > 0) {
          return {
            success: false,
            error: {
              code: "E_INVALID_ARGS",
              message: formatValidationErrors(errors),
              context: {
                errors,
                receivedArgs: args,
              },
            },
          };
        }
      }

      // 调用用户 handler
      const currentHandler = handlerRef.current;
      const handlerContext: OperationHandlerContext = {
        viewId: "", // App-scoped Operation 没有 viewId
        appId,
        desktopId,
        markDirty: markAppDirty,
      };

      try {
        const result = await currentHandler(
          args as InferArgs<T>,
          handlerContext,
        );
        return {
          success: result.success,
          data: result.data as Record<string, unknown> | undefined,
          error: result.error,
        };
      } catch (err) {
        return {
          success: false,
          error: {
            code: "E_HANDLER_ERROR",
            message: err instanceof Error ? err.message : String(err),
          },
        };
      }
    };

    registerAppOperation(name, stableHandler);

    return () => {
      unregisterAppOperation(name);
    };
  }, [
    name,
    registerAppOperation,
    unregisterAppOperation,
    params,
    appId,
    desktopId,
    markAppDirty,
  ]);

  // 创建 UI 渲染器组件
  const AppOperationUIComponent = useMemo(() => {
    const paramArray = schemaToArray(params);

    const UIComponent: AppOperationUI = ({
      children,
      className,
      disabled,
    }: AppOperationUIProps): VNode => {
      return h(
        "button",
        {
          operation: name,
          desc: description,
          "data-scope": "app", // 标记为 App 级 Operation
          class: className,
          disabled: disabled,
        } as any,
        [
          children || name,
          ...paramArray.map((p) =>
            h("param", {
              key: p.name,
              name: p.name,
              type: p.type,
              required: p.required ? "true" : undefined,
              desc: p.desc,
              "item-type": p.itemType || undefined,
              options: p.options ? p.options.join(",") : undefined,
              default: p.default !== undefined ? String(p.default) : undefined,
              "min-length": p.constraints?.minLength?.toString(),
              "max-length": p.constraints?.maxLength?.toString(),
              pattern: p.constraints?.pattern,
              min: p.constraints?.min?.toString(),
              max: p.constraints?.max?.toString(),
            }),
          ),
        ],
      ) as VNode;
    };

    (UIComponent as any).displayName = `AppOperationUI(${name})`;

    return UIComponent;
  }, [name, description, params]);

  return [AppOperationUIComponent];
}

// ─────────────────────────────────────────────────────────────
//  Helper Functions
// ─────────────────────────────────────────────────────────────

interface ParamRenderInfo {
  name: string;
  type: ParamType;
  required: boolean;
  desc?: string;
  itemType?: ParamBaseType;
  options?: readonly string[];
  constraints?: ParamConstraints;
  default?: unknown;
}

function schemaToArray(schema: ParamSchema | undefined): ParamRenderInfo[] {
  if (!schema) return [];
  return Object.entries(schema).map(([name, def]) => ({
    name,
    type: def.type,
    required: def.required === true,
    desc: def.desc,
    itemType: def.itemType,
    options: def.options,
    constraints: def.constraints,
    default: def.default,
  }));
}
