/**
 * OpenAppOperation
 * 
 * 打开指定的应用程序。
 */

import type {
    ISystemOperation,
    SystemOperationContext,
    OperationResult,
    IDesktopForOperation
} from '../../../../spi/index.js';
import { createAppId } from '../../../../spi/index.js';
import type { Tool } from '../../../../spi/core/tool-call.js';

export class OpenAppOperation implements ISystemOperation {
    readonly name = 'open';
    readonly aliases = ['open_app'] as const;

    readonly toolDefinition: Tool = {
        type: "function",
        function: {
            name: "system-open_app",
            description: "打开指定应用,使其对 Agent 可见",
            parameters: {
                type: "object",
                properties: {
                    app_id: {
                        type: "string",
                        description: "应用 ID,格式为 app_n (如 app_0, app_1)"
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

        await desktop.openApp(createAppId(appId));
        return { success: true };
    }
}
