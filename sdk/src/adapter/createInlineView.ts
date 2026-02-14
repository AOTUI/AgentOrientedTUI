/**
 * AOTUI SDK - Inline View Factory
 * 
 * [RFC-027 + View Type Mechanism] 为component模式下的<View>组件创建轻量级IView实例
 * 
 * 与createView的区别:
 * - createView: 完整的Preact渲染流程,独立容器
 * - createInlineView: 轻量级包装,复用已存在的DOM
 * 
 * View Type机制改造:
 * - 增加type字段，用于Tool聚合
 */

import type { IView, ViewID, OperationResult, IViewContextFull } from '@aotui/runtime/spi';
import { createViewId } from '@aotui/runtime/spi';

/**
 * Inline View配置
 */
export interface InlineViewConfig {
    /** View ID (developer-specified) */
    id: ViewID;

    /** View名称 (display name) */
    name: string;

    /** View类型 (用于Tool聚合) */
    type?: string;

    /** DOM容器 (已由Preact渲染) */
    container: HTMLElement;

    /** Operation处理器映射 */
    operations?: Map<string, (args: Record<string, unknown>) => Promise<OperationResult>>;
}

/**
 * 创建Inline View实例
 * 
 * Inline View不负责渲染,只提供IView接口给Runtime
 */
export function createInlineView(config: InlineViewConfig): IView {
    let mounted = false;
    const viewType = config.type || config.name;

    return {
        get id(): ViewID {
            return config.id;
        },

        name: config.name,
        displayName: config.name,
        type: viewType,

        setId(newId: string) {
            console.warn(
                `[AOTUI SDK] Attempting to change Inline View ID from ${config.id} to ${newId}. ` +
                `This is unexpected in component mode.`
            );
        },

        async onMount(ctx: IViewContextFull): Promise<void> {
            mounted = true;
        },

        async onDismount(): Promise<void> {
            mounted = false;
        },

        async onOperation(
            operation: string,
            args: Record<string, unknown>
        ): Promise<OperationResult> {
            if (!config.operations) {
                return {
                    success: false,
                    error: {
                        code: 'NO_OPERATIONS',
                        message: `View ${config.name} has no operations registered`
                    }
                };
            }

            const handler = config.operations.get(operation);
            if (!handler) {
                return {
                    success: false,
                    error: {
                        code: 'UNKNOWN_OPERATION',
                        message: `Operation ${operation} not found in view ${config.name}`
                    }
                };
            }

            try {
                return await handler(args);
            } catch (err) {
                return {
                    success: false,
                    error: {
                        code: 'HANDLER_ERROR',
                        message: err instanceof Error ? err.message : String(err)
                    }
                };
            }
        },

        render(): string {
            if (!mounted) {
                throw new Error(`Inline View ${config.name} is not mounted`);
            }

            return config.container.innerHTML;
        }
    };
}
