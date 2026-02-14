/**
 * Ref Exporter Interface
 * 
 * Defines the contract for registering and exporting Refs between SDK and Runtime.
 * This replaces the global __AOTUI_REF_REGISTRY__ with an explicit interface.
 * 
 * [RFC-002] Ref Registry Refactoring
 */

export interface IRefExporter {
    /**
     * Register a Ref data object
     * @param viewId The View ID
     * @param refId The Ref ID (unique within the View)
     * @param data The data object
     */
    registerRef(viewId: string, refId: string, data: object): void;

    /**
     * Unregister a Ref
     * @param viewId The View ID
     * @param refId The Ref ID
     */
    unregisterRef(viewId: string, refId: string): void;
}
