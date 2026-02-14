import type { Operation, OperationResult, IDesktop, IRegistry } from '../../spi/index.js';
import type { IDispatcher } from '../../spi/runtime/dispatcher.interface.js';

/**
 * Dispatcher - Operation routing and argument resolution
 * 
 * [DIP] Implements IDispatcher interface for Kernel decoupling.
 */
export class Dispatcher implements IDispatcher {
    /**
     * Dispatches an operation to the target application container in the desktop.
     * 
     * [C2 Refactor] Now delegates transport details to Desktop to ensure type safety.
     * Dispatcher is only responsible for Argument Resolution.
     * 
     * @returns The result from the App's operation handler
     */
    async dispatch(desktop: IDesktop, operation: Operation, registry: IRegistry): Promise<OperationResult> {
        const { context, name: operationName, args } = operation;

        // 1. Data Resolution (Argument Injection)
        const resolvedArgs: Record<string, unknown> = {};
        const snapshotId = context.snapshotId;

        for (const [key, value] of Object.entries(args)) {
            if (typeof value === 'string' && snapshotId && context.appId && context.viewId) {
                // 构造完整 namespace key: "appId:viewId:refId"
                // 例如: "app_0:view_0:pinned_msgs[0]"
                const fullKey = `${context.appId}:${context.viewId}:${value}`;

                console.log(`[Dispatcher] Attempting to resolve: "${value}" → "${fullKey}"`);
                const payload = registry.resolve(snapshotId, fullKey);

                if (payload !== undefined) {
                    console.log(`[Dispatcher] ✓ Resolved "${fullKey}" →`, typeof payload, payload);
                    resolvedArgs[key] = payload;
                    continue;
                } else {
                    console.log(`[Dispatcher] ✗ Failed to resolve "${fullKey}" (not found in registry)`);
                }
            }
            resolvedArgs[key] = value;
        }

        // 2. Delegate Dispatch to Desktop (Environment Agnostic)
        // [P0-1 FIX] Now returns the actual OperationResult from the App
        return await desktop.dispatchOperation(context.appId, {
            context,
            operation: operationName,
            args: resolvedArgs,
            meta: { snapshotId }
        });
    }
}
