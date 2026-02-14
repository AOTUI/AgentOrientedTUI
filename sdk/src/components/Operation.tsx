/**
 * AOTUI SDK - Operation Component (v4)
 *
 * RFC-003: Operation 作用域与生命周期设计
 *
 * Operation 组件负责注册 View-scoped Operation 并渲染语义化按钮。
 *
 * @example 基础用法
 * ```tsx
 * <Operation
 *     name="send_message"
 *     description="发送消息"
 *     params={{
 *         content: { type: 'string', required: true, desc: '消息内容' },
 *         priority: { type: 'number', desc: '优先级' }
 *     }}
 *     onExecute={async (args) => {
 *         // args.content: string
 *         // args.priority: number | undefined
 *         return { success: true };
 *     }}
 * >
 *     发送消息
 * </Operation>
 * ```
 *
 * @example 使用 defineParams 辅助函数
 * ```tsx
 * import { defineParams } from '@aotui/sdk';
 *
 * const sendMessageParams = defineParams({
 *     content: { type: 'string', required: true },
 *     priority: { type: 'number' }
 * });
 *
 * <Operation
 *     name="send_message"
 *     params={sendMessageParams}
 *     onExecute={async (args) => {
 *         // 类型自动推断
 *     }}
 * >
 *     发送
 * </Operation>
 * ```
 */

import { h, type VNode, type ComponentChildren } from "preact";
import { useEffect, useRef, useMemo, useContext } from "../hooks/preact-hooks.js";
import { ViewRuntimeContext } from "../contexts/index.js";
import { validateArgs, formatValidationErrors } from "../utils/validateArgs.js";
import { assertValidOperationName } from "../utils/validation.js";

// ─────────────────────────────────────────────────────────────
//  Types (SSOT from operation/types.ts)
// ─────────────────────────────────────────────────────────────

// Import types from SSOT
import type {
  ParamBaseType,
  ParamType,
  ParamConstraints,
  ParamDef,
  ParamSchema,
  InferArgs,
  OperationHandlerContext,
  OperationError,
  OperationResult,
  OperationHandler,
  OperationProps,
} from "../operation/types.js";

// Re-export for backward compatibility
// 开发者仍可从 '@aotui/sdk' 或 'components/Operation' 导入这些类型
export type {
  ParamBaseType,
  ParamType,
  ParamConstraints,
  ParamDef,
  ParamSchema,
  InferArgs,
  OperationHandlerContext,
  OperationError,
  OperationResult,
  OperationHandler,
  OperationProps,
};

/**
 * Operation Component
 */
export function Operation<T extends ParamSchema = ParamSchema>({
  name,
  description,
  params,
  onExecute,
  children,
  className,
  disabled,
}: OperationProps<T>): VNode {
  const ctx = useContext(ViewRuntimeContext);
  if (!ctx) {
    throw new Error(
      "[AOTUI SDK] Operation must be used within a View.\n" +
        "Tip: Ensure your component is rendered inside a <View>.",
    );
  }

  const { registerOperation, unregisterOperation } = ctx.operations;

  if (process.env.NODE_ENV !== "production") {
    assertValidOperationName(name, "Operation");
  }

  const handlerRef = useRef(onExecute);
  handlerRef.current = onExecute;

  useEffect(() => {
    const stableHandler = async (
      args: Record<string, unknown>,
    ): Promise<OperationResult> => {
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

      const currentHandler = handlerRef.current;
      const handlerContext: OperationHandlerContext = {
        viewId: ctx.meta.viewId,
        appId: ctx.meta.appId,
        desktopId: ctx.meta.desktopId,
        markDirty: ctx.meta.markDirty,
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

    registerOperation(name, stableHandler);

    return () => {
      unregisterOperation(name);
    };
  }, [
    name,
    registerOperation,
    unregisterOperation,
    params,
    ctx.meta.viewId,
    ctx.meta.appId,
    ctx.meta.desktopId,
    ctx.meta.markDirty,
  ]);

  const OperationUIComponent = useMemo(() => {
    const paramArray = schemaToArray(params);

    const UIComponent = ({
      children: uiChildren,
      className: uiClassName,
      disabled: uiDisabled,
    }: OperationUIProps): VNode => {
      return h(
        "button",
        {
          operation: name,
          desc: description,
          class: uiClassName,
          disabled: uiDisabled,
        } as any,
        [
          uiChildren || name,
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

    (UIComponent as any).displayName = `OperationUI(${name})`;
    return UIComponent;
  }, [name, description, params]);

  return OperationUIComponent({
    children,
    className,
    disabled,
  });
}

// ─────────────────────────────────────────────────────────────
//  Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * 定义参数 Schema 的辅助函数
 *
 * 使用此函数可以获得完整的类型推断，无需手写 `as const`
 *
 * @example 基础用法
 * ```ts
 * const params = defineParams({
 *     content: { type: 'string', required: true },
 *     limit: { type: 'number' }
 * })
 * ```
 *
 * @example 数组类型
 * ```ts
 * const params = defineParams({
 *     tags: { type: 'array', itemType: 'string', desc: '标签列表' }
 * })
 * ```
 *
 * @example 枚举类型
 * ```ts
 * const params = defineParams({
 *     priority: { type: 'enum', options: ['low', 'medium', 'high'] as const }
 * })
 * ```
 */
export function defineParams<T extends ParamSchema>(schema: T): T {
  const VALID_BASE_TYPES = ["string", "number", "boolean", "object", "reference"];
  const VALID_ALL_TYPES = [...VALID_BASE_TYPES, "array", "enum"];

  // 开发环境校验
  if (process.env.NODE_ENV !== "production") {
    for (const [name, def] of Object.entries(schema)) {
      // 校验类型是否有效
      if (!VALID_ALL_TYPES.includes(def.type)) {
        console.warn(
          `[AOTUI SDK] defineParams: Invalid type "${def.type}" for param "${name}". ` +
          `Allowed: ${VALID_ALL_TYPES.join(", ")}`,
        );
      }

      // array 类型必须指定 itemType
      if (def.type === "array" && !def.itemType) {
        console.warn(
          `[AOTUI SDK] defineParams: param "${name}" is array type but missing "itemType". ` +
          `Add itemType: 'string' | 'number' | 'boolean' | 'object' | 'reference'`,
        );
      }

      // array 的 itemType 必须是基础类型
      if (def.itemType && !VALID_BASE_TYPES.includes(def.itemType)) {
        console.warn(
          `[AOTUI SDK] defineParams: Invalid itemType "${def.itemType}" for param "${name}". ` +
          `Allowed: ${VALID_BASE_TYPES.join(", ")}`,
        );
      }

      // enum 类型必须指定 options
      if (def.type === "enum" && (!def.options || def.options.length === 0)) {
        console.warn(
          `[AOTUI SDK] defineParams: param "${name}" is enum type but missing "options". ` +
          `Add options: ['value1', 'value2'] as const`,
        );
      }

      // 校验约束合法性
      if (def.constraints) {
        const c = def.constraints;
        if (
          c.minLength !== undefined &&
          c.maxLength !== undefined &&
          c.minLength > c.maxLength
        ) {
          console.warn(
            `[AOTUI SDK] defineParams: param "${name}" has minLength (${c.minLength}) > maxLength (${c.maxLength})`,
          );
        }
        if (c.min !== undefined && c.max !== undefined && c.min > c.max) {
          console.warn(
            `[AOTUI SDK] defineParams: param "${name}" has min (${c.min}) > max (${c.max})`,
          );
        }
      }
    }
  }
  return schema;
}

interface OperationUIProps {
  children?: ComponentChildren;
  className?: string;
  disabled?: boolean;
}

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
