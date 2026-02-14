/**
 * SPI - IDispatcher Interface
 *
 * Defines the contract for operation dispatching.
 * The Kernel depends on this interface, not on concrete implementations.
 *
 * @module @aotui/runtime/spi/runtime
 */

import type { IDesktop, IRegistry } from './kernel.interface.js';
import type { Operation, OperationResult } from '../core/index.js';

/**
 * Dispatcher Interface
 *
 * Dispatches operations to the target application.
 * Handles argument resolution and delegates transport to Desktop.
 *
 * @example
 * ```typescript
 * const dispatcher: IDispatcher = new Dispatcher();
 * const result = await dispatcher.dispatch(desktop, operation, registry);
 * console.log(result.success); // true or false
 * ```
 */
export interface IDispatcher {
    /**
     * Dispatches an operation to the target application
     *
     * @param desktop - The Desktop instance containing the target app
     * @param operation - The Operation to dispatch
     * @param registry - The SnapshotRegistry for argument resolution
     * @returns The result of the operation execution
     */
    dispatch(
        desktop: IDesktop,
        operation: Operation,
        registry: IRegistry
    ): Promise<OperationResult>;
}
