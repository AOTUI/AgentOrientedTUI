/**
 * AOTUI SDK - useViewTypeTool Hook
 *
 * View Type Tool Aggregation - 注册 Type-level 工具
 *
 * Type Tool 绑定到 View Type 而非具体实例，在根视图中聚合展示。
 * LLM 调用时需显式传入 `view_id` 参数指定目标 View。
 *
 * @example 基础用法
 * ```tsx
 * // 在 WorkspaceContent (根视图) 中注册
 * useViewTypeTool('FileDetail', 'lsp_hover', {
 *     description: `Get type info. REQUIRED: view_id (e.g., "fd_0")`,
 *     params: defineParams({
 *         view_id: { type: 'string', required: true, desc: 'Target View ID' },
 *         line: { type: 'number', required: true },
 *         character: { type: 'number', required: true }
 *     })
 * }, async ({ view_id, line, character }) => {
 *     const filePath = getFilePathByViewId(view_id);
 *     // ... LSP 调用
 *     return { success: true };
 * });
 * ```
 *
 * @module @aotui/sdk/hooks/useViewTypeTool
 */

import { h, type VNode } from "preact";
import { useEffect, useRef, useContext, useMemo } from "./preact-hooks.js";
import { ViewRuntimeContext } from "../contexts/index.js";
import { validateArgs, formatValidationErrors } from "../utils/validateArgs.js";

// Import types from operation/types.ts
import type {
    ParamSchema,
    InferArgs,
    OperationResult,
} from "../operation/types.js";

// ─────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────

/** Type Tool 配置选项 */
export interface TypeToolOptions<T extends ParamSchema = ParamSchema> {
    /** 工具描述（应包含 view_id 参数说明） */
    description: string;
    /** 参数定义（必须包含 view_id） */
    params: T;
}

/** Type Tool Handler */
export type TypeToolHandler<T = any> = (
    args: T
) => Promise<OperationResult>;

/** Type Tool UI 组件 Props */
export interface TypeToolUIProps {
    /** 子元素（可选，默认显示工具名） */
    children?: string;
}

/** Type Tool UI 渲染器类型 */
export type TypeToolUI = (props: TypeToolUIProps) => VNode;

/** useViewTypeTool 返回值 */
export type UseViewTypeToolResult = [TypeToolUI];

// ─────────────────────────────────────────────────────────────
//  Hook Implementation  
// ─────────────────────────────────────────────────────────────

/**
 * 注册一个 Type-level Tool
 *
 * 工具 ID 格式: `app_id-view_type-tool_id`
 * LLM 必须传入 `view_id` 参数来指定目标 View
 *
 * @param viewType - View 类型（如 "FileDetail"）
 * @param toolName - 工具名（如 "lsp_hover"）
 * @param options - 工具配置选项
 * @param handler - 执行处理函数
 * @returns [TypeToolUI] - UI 渲染器组件
 */
export function useViewTypeTool<T extends ParamSchema = ParamSchema>(
    viewType: string,
    toolName: string,
    options: TypeToolOptions<T>,
    handler: TypeToolHandler<InferArgs<T>>,
    config?: { enabled?: boolean }
): UseViewTypeToolResult {
    const enabled = config?.enabled ?? true;
    const { description, params } = options;

    // 获取 Context
    const ctx = useContext(ViewRuntimeContext);
    if (!ctx) {
        throw new Error(
            "[AOTUI SDK] useViewTypeTool must be used within a View.\\n" +
            "Tip: Ensure your component is rendered inside a View."
        );
    }

    // 使用 ref 保存最新 handler，避免重新注册
    const handlerRef = useRef(handler);
    handlerRef.current = handler;

    // 创建 stable wrapper (仅当 params 变化时重建)
    const stableHandler = useMemo(() => {
        return async (args: Record<string, unknown>): Promise<OperationResult> => {
            // 运行时参数验证
            if (params) {
                const errors = validateArgs(args, params);
                if (errors.length > 0) {
                    return {
                        success: false,
                        // @ts-ignore - SPI types mismatch fix later
                        error: {
                            code: "E_INVALID_ARGS",
                            message: formatValidationErrors(errors),
                            context: { errors, receivedArgs: args },
                        },
                    };
                }
            }

            // 调用用户 handler
            const currentHandler = handlerRef.current;

            try {
                const result = await currentHandler(args as InferArgs<T>);
                return {
                    success: result.success,
                    data: result.data,
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
    }, [params]); // 仅当参数定义改变时才更新 handler wrapper

    // 注册 Type Tool 到 AppKernel
    useEffect(() => {
        // [RFC-020-Fix] 使用 Context API 直接注册
        if (!ctx.typeTools) {
            console.warn("[SDK] ViewRuntimeContext.typeTools is missing. Type Tools will not be registered.");
            return;
        }

        // [Conditional Registration] 如果 enabled=false，只卸载，不注册
        if (!enabled) {
            try {
                // console.log(`[SDK useViewTypeTool] ⚠️  Tool disabled, unregistering: ${viewType}.${toolName}`);
                ctx.typeTools.unregisterTypeTool(viewType, toolName);
            } catch (err) {
                // 如果工具本来就不存在，忽略错误
            }
            return;
        }

        try {
            // console.log(`[SDK useViewTypeTool] 📝 Registering tool: ${viewType}.${toolName}`);

            ctx.typeTools.registerTypeTool(viewType, toolName, {
                description,
                params,
                handler: stableHandler,
            });
        } catch (err) {
            console.error(`[SDK] Failed to register type tool ${viewType}.${toolName}:`, err);
        }

        return () => {
            // Cleanup: Unregister tool
            if (ctx.typeTools) {
                try {
                    ctx.typeTools.unregisterTypeTool(viewType, toolName);
                } catch (err) {
                    console.error(`[SDK] Failed to unregister type tool ${viewType}.${toolName}:`, err);
                }
            }
        };
    }, [viewType, toolName, description, params, stableHandler, ctx.typeTools, enabled]);

    // 创建 UI 渲染器组件
    const TypeToolUIComponent = useMemo(() => {
        const UIComponent: TypeToolUI = ({ children }: TypeToolUIProps): VNode => {
            // 渲染为 <tool-ref> 元素
            return h(
                "tool-ref",
                {
                    "view-type": viewType,
                    "tool-name": toolName,
                    desc: description,
                } as any,
                children || toolName
            ) as VNode;
        };
        (UIComponent as any).displayName = `TypeToolUI(${viewType}.${toolName})`;
        return UIComponent;
    }, [viewType, toolName, description]);

    return [TypeToolUIComponent];
}
