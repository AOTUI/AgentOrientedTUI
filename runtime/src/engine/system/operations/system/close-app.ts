/**
 * CloseAppOperation
 * 
 * 关闭指定的应用程序。
 */

import type {
    ISystemOperation,
    SystemOperationContext,
    OperationResult,
    IDesktopForOperation
} from '../../../../spi/index.js';
import { createAppId } from '../../../../spi/index.js';
import type { Tool } from '../../../../spi/core/tool-call.js';

export class CloseAppOperation implements ISystemOperation {
    readonly name = 'close';
    readonly aliases = ['close_app'] as const;

    readonly toolDefinition: Tool = {
        type: "function",
        function: {
            name: "system-close_app",
            description: "关闭指定应用,将其从 Agent 视野中移除",
            parameters: {
                type: "object",
                properties: {
                    app_id: {
                        type: "string",
                        description: "应用 ID"
                    }
                },
                required: ["app_id"]
            }
        }
    };

    async execute(
        ctx: SystemOperationContext,
        desktop: IDesktopForOperation
    ): Promise<OperationResult> {
        const appId = (ctx.args.app_id ?? ctx.args.application) as string | undefined;

        if (!appId) {
            return {
                success: false,
                error: {
                    code: 'E_MISSING_ARG',
                    message: "Missing required argument 'application'",
                    context: { operation: this.name }
                }
            };
        }

        await desktop.closeApp(createAppId(appId));
        return { success: true };
    }
}
