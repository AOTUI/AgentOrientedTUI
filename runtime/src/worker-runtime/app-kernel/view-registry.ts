/**
 * AOTUI Runtime - ViewRegistry
 * 
 * Lightweight View management for component mode.
 * Replaces ViewTree with a simpler flat structure.
 * 
 * Design Goals:
 * - Minimal API surface (register, unregister, get, has)
 * - No tree management (parent-child relationships handled by components)
 * - No lifecycle management (components manage their own mount/dismount)
 * - Performance: O(1) lookups, minimal memory overhead
 * 
 * @module @aotui/runtime/worker-runtime/app-kernel
 */

import type { IView, ViewID } from '../../spi/index.js';
import { AOTUIError } from '../../spi/core/errors.js';

/**
 * ViewRegistry - Simplified View management
 * 
 * Compared to ViewTree (~800 lines):
 * - No parent-child tracking
 * - No mount/dismount lifecycle
 * - No tree rendering
 * - ~50 lines of code
 * 
 * Views are registered by SDK components via AppKernel.registerView()
 * and unregistered when components unmount.
 */
export class ViewRegistry {
    private views = new Map<ViewID, IView>();

    /**
     * Register a View
     * 
     * @throws {AOTUIError} VIEW_DUPLICATE if viewId already registered
     */
    register(view: IView): void {
        if (this.views.has(view.id)) {
            throw new AOTUIError('VIEW_DUPLICATE', { viewId: view.id });
        }

        this.views.set(view.id, view);

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[ViewRegistry] Registered ${view.id} (${view.name})`);
        }
    }

    /**
     * Unregister a View
     * 
     * Idempotent: no error if view doesn't exist
     */
    unregister(viewId: ViewID): void {
        const existed = this.views.delete(viewId);

        if (existed && process.env.NODE_ENV !== 'production') {
            console.log(`[ViewRegistry] Unregistered ${viewId}`);
        }
    }

    /**
     * Get a View by ID
     * 
     * @returns View instance or undefined if not found
     */
    get(viewId: ViewID): IView | undefined {
        return this.views.get(viewId);
    }

    /**
     * Check if a View is registered
     */
    has(viewId: ViewID): boolean {
        return this.views.has(viewId);
    }

    /**
     * Get all registered Views
     * 
     * @returns Array of all Views (order not guaranteed)
     */
    getAll(): IView[] {
        return Array.from(this.views.values());
    }

    /**
     * Get all View IDs
     */
    getAllIds(): ViewID[] {
        return Array.from(this.views.keys());
    }

    /**
     * Get Views by type
     * 
     * Used for Tool聚合 in View Type mechanism.
     * 
     * @param type - View type to filter by
     * @returns Array of Views with matching type
     */
    getByType(type: string): IView[] {
        return Array.from(this.views.values())
            .filter(v => (v.type || v.name) === type);
    }

    /**
     * Get number of registered Views
     */
    size(): number {
        return this.views.size;
    }

    /**
     * Clear all Views
     * 
     * Used during app teardown
     */
    clear(): void {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[ViewRegistry] Clearing ${this.views.size} views`);
        }
        this.views.clear();
    }
}

/**
 * Factory function to create ViewRegistry instances
 */
export function createViewRegistry(): ViewRegistry {
    return new ViewRegistry();
}
