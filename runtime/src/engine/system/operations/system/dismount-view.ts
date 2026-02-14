/**
 * DismountViewOperation
 * 
 * 卸载指定的视图。
 */

import type {
    ISystemOperation,
    SystemOperationContext,
    OperationResult,
    IDesktopForOperation
} from '../../../../spi/index.js';
import { createViewId, createAppId } from '../../../../spi/index.js';
import type { Tool } from '../../../../spi/core/tool-call.js';

export class DismountViewOperation implements ISystemOperation {
    readonly name = 'dismount_view';
    readonly aliases = ['close_view'] as const;

    readonly toolDefinition: Tool = {
        type: "function",
        function: {
            name: "system-dismount_view",
            description: "卸载指定视图，减少界面干扰",
            parameters: {
                type: "object",
                properties: {
                    app_id: {
                        type: "string",
                        description: "应用 ID"
                    },
                    view_id: {
                        type: "string",
                        description: "视图 ID (如 view_1)"
                    }
                },
                required: ["app_id", "view_id"]
            }
        }
    };

    async execute(
        ctx: SystemOperationContext,
        desktop: IDesktopForOperation
    ): Promise<OperationResult> {
        const viewId = (ctx.args.view_id ?? ctx.args.viewId) as string | undefined;
        const appId = (ctx.args.app_id ?? ctx.args.appId) as string | undefined;

        if (!viewId || !appId) {
            return {
                success: false,
                error: {
                    code: 'E_MISSING_ARG',
                    message: "Missing required argument 'view_id' or 'app_id'",
                    context: { operation: this.name }
                }
            };
        }

        await desktop.dismountView(createAppId(appId), createViewId(viewId));
        return { success: true };
    }
}
