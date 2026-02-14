/**
 * AOTUI Runtime - ViewTree Implementation
 *
 * [方案 B] 从 @aotui/sdk 迁移到 @aotui/runtime/worker-runtime。
 *
 * 这是 IViewTree 的实现，管理 App 内部的 View 层级结构。
 * 作为 Worker Kernel 的一部分，负责：
 * - 添加/移除 Views
 * - 挂载/卸载 Views
 * - 渲染树结构
 * - 操作路由
 *
 * @module @aotui/runtime/worker-runtime/app-kernel
 */

// Import interfaces from Runtime SPI (same package, relative path)
import type { IViewTree, ViewNode, ViewContextFactory, MountableViewEntry } from '../../spi/index.js';
import type { IView, ViewID, LinkEntry } from '../../spi/index.js';
import { AOTUIError } from '../../spi/core/errors.js';

// Re-export types for convenience
export type { ViewContextFactory, MountableViewEntry };

// Maximum tree depth to prevent stack overflow
const MAX_TREE_DEPTH = 20;

/**
 * Internal mutable node interface
 *
 * Only used internally for ViewTree implementation.
 * External ViewNode contract remains readonly.
 */
interface MutableViewNode extends ViewNode {
    childIds: ViewID[];
    /** For unmounted views: cached factory and props */
    mountable?: MountableViewEntry;
}

/**
 * ViewTree Implementation
 *
 * Runtime's own implementation of the IViewTree interface.
 * This is used by AppKernel to manage the App's view hierarchy.
 */
export class ViewTree implements IViewTree {
    private nodes = new Map<ViewID, MutableViewNode>();
    private _rootId: ViewID | null = null;
    private contextFactory: ViewContextFactory;

    /**
     * @param contextFactory - Factory function to create ViewContext for each View
     */
    constructor(contextFactory: ViewContextFactory) {
        this.contextFactory = contextFactory;
    }

    get rootId(): ViewID | null {
        return this._rootId;
    }

    getNode(viewId: ViewID): ViewNode | undefined {
        return this.nodes.get(viewId);
    }

    getView(viewId: ViewID): IView | undefined {
        return this.nodes.get(viewId)?.view;
    }

    /**
     * Add View to tree
     *
     * Includes depth checking and cycle detection.
     */
    addView(view: IView, parentId: ViewID | null): void {
        // Check if already exists
        if (this.nodes.has(view.id)) {
            throw new AOTUIError('VIEW_DUPLICATE', { viewId: view.id });
        }

        // Validate parent exists
        if (parentId !== null && !this.nodes.has(parentId)) {
            throw new AOTUIError('VIEW_PARENT_NOT_FOUND', { parentId });
        }

        // Check depth limit
        if (parentId !== null) {
            const depth = this.getDepth(parentId);
            if (depth >= MAX_TREE_DEPTH) {
                throw new AOTUIError('CONFIG_INVALID', {
                    reason: `Tree depth would exceed ${MAX_TREE_DEPTH}. Current depth at parent ${parentId}: ${depth}`
                });
            }
        }

        // Create node (using internal mutable type)
        const node: MutableViewNode = {
            view,
            parentId,
            childIds: [],
            mounted: false
        };

        this.nodes.set(view.id, node);

        // Set root or add to parent's children
        if (parentId === null) {
            if (this._rootId !== null) {
                throw new AOTUIError('VIEW_ROOT_EXISTS', {});
            }
            this._rootId = view.id;
        } else {
            const parent = this.nodes.get(parentId);
            if (!parent) {
                throw new AOTUIError('VIEW_PARENT_NOT_FOUND', { parentId });
            }
            if (!parent.childIds.includes(view.id)) {
                parent.childIds.push(view.id);
            }
        }
    }

    /**
     * Calculate node depth (distance from root to this node)
     */
    private getDepth(viewId: ViewID): number {
        let depth = 0;
        let currentId: ViewID | null = viewId;
        const visited = new Set<ViewID>();

        while (currentId !== null) {
            // Cycle detection - should never happen but defensive programming
            if (visited.has(currentId)) {
                throw new AOTUIError('INTERNAL_ERROR', {
                    message: `Cycle detected in view tree at ${currentId}. This indicates a bug in ViewTree implementation.`
                });
            }
            visited.add(currentId);

            const node = this.nodes.get(currentId);
            if (!node) break;
            currentId = node.parentId;
            depth++;
        }

        return depth;
    }

    /**
     * Remove View (and its subtree)
     */
    removeView(viewId: ViewID): void {
        const node = this.nodes.get(viewId);
        if (!node) return;

        // Recursively remove all children
        for (const childId of [...node.childIds]) {
            this.removeView(childId);
        }

        // Remove from parent's children list
        if (node.parentId !== null) {
            const parent = this.nodes.get(node.parentId);
            if (parent) {
                parent.childIds = parent.childIds.filter(id => id !== viewId);
            }
        }

        // Clear root if this is root
        if (this._rootId === viewId) {
            this._rootId = null;
        }

        // Remove node
        this.nodes.delete(viewId);
    }

    /**
     * Mount View
     */
    async mountView(viewId: ViewID): Promise<void> {
        const node = this.nodes.get(viewId);
        if (!node) {
            throw new AOTUIError('VIEW_NOT_FOUND', { viewId });
        }

        if (node.mounted) {
            return; // Already mounted, idempotent
        }

        // Mount parent first if not mounted
        if (node.parentId !== null) {
            const parent = this.nodes.get(node.parentId);
            if (parent && !parent.mounted) {
                await this.mountView(node.parentId);
            }
        }

        // Create context and call onMount
        const context = this.contextFactory(viewId);
        await node.view.onMount(context);
        node.mounted = true;
    }

    /**
     * Dismount View
     */
    async dismountView(viewId: ViewID): Promise<void> {
        const node = this.nodes.get(viewId);
        if (!node) {
            throw new AOTUIError('VIEW_NOT_FOUND', { viewId });
        }

        if (!node.mounted) {
            return; // Already dismounted, idempotent
        }

        // Dismount all children first (from leaves)
        for (const childId of [...node.childIds]) {
            await this.dismountView(childId);
        }

        // Call onDismount
        await node.view.onDismount();
        node.mounted = false;

        // [Orphan Cleanup] If this view has no corresponding ViewLink (mountableEntry),
        // it's an orphan and should be removed from the tree.
        // This happens when data moves (e.g., todo from pending to done) and the
        // ViewLink at the original position no longer exists.

        // V2 Update: Check uniqueIdBindings as well?
        // Actually, V2 views are NEVER in mountableEntries (V1 only).
        // So V2 views should ALWAYS be removed on dismount.
        const isLegacyMountable = this.mountableEntries.has(viewId);
        console.log(`[ViewTree] dismountView: isLegacyMountable=${isLegacyMountable}`);

        if (!isLegacyMountable) {
            console.log(`[ViewTree] dismountView: Removing orphan/V2 view ${viewId}`);
            this.removeView(viewId);
        }
    }

    /**
     * Get all mounted Views
     */
    getMountedViews(): IView[] {
        return Array.from(this.nodes.values())
            .filter(n => n.mounted)
            .map(n => n.view);
    }

    /**
     * Get View's full path (from root to this node)
     */
    getPath(viewId: ViewID): ViewID[] {
        const path: ViewID[] = [];
        let currentId: ViewID | null = viewId;

        while (currentId !== null) {
            path.unshift(currentId);
            const node = this.nodes.get(currentId);
            currentId = node?.parentId ?? null;
        }

        return path;
    }

    /**
     * Get child Views
     */
    getChildren(viewId: ViewID): IView[] {
        const node = this.nodes.get(viewId);
        if (!node) return [];

        return node.childIds
            .map(id => this.nodes.get(id)?.view)
            .filter((v): v is IView => v !== undefined);
    }

    /**
     * Render View Tree state
     *
     * [RFC-007] Output format:
     * ## Application View Tree
     * - [Navigation](view:view_0, mounted)
     *     - [Conversations](view:view_1, mounted)
     *         ↳ [Contact Detail](link:CD_0)
     *
     * Only mounted views are shown. Unmounted ViewLinks use link: protocol.
     */
    renderTree(): string {
        if (this._rootId === null) {
            return '## Application View Tree\n- No views registered.';
        }

        // [RFC-007] Only render if root is mounted
        const rootNode = this.nodes.get(this._rootId);
        if (!rootNode || !rootNode.mounted) {
            return '## Application View Tree\n- No views mounted.';
        }

        const lines: string[] = ['## Application View Tree'];
        this.renderNodeV2(this._rootId, 0, lines);
        return lines.join('\n');
    }

    /**
     * [RFC-007] Enhanced node renderer - only mounted views
     */
    private renderNodeV2(viewId: ViewID, depth: number, lines: string[]): void {
        const node = this.nodes.get(viewId);
        if (!node || !node.mounted) return; // [RFC-007] Only show mounted

        const indent = '    '.repeat(depth);
        const name = node.view.displayName || node.view.name || viewId;

        // [RFC-007] Only "mounted" status is shown
        lines.push(`${indent}- [${name}](view:${viewId}, mounted)`);

        // Render mounted child nodes first
        for (const childId of node.childIds) {
            const childNode = this.nodes.get(childId);
            if (childNode && childNode.mounted) {
                this.renderNodeV2(childId, depth + 1, lines);
            }
        }

        // [RFC-007] Render unmounted ViewLinks as sub-items
        const links = this.getLinksInParent(viewId);
        for (const link of links) {
            // Check if this link is bound to a mounted view (skip if already rendered)
            const boundViewId = this.getBoundViewId(link.viewType, link.uniqueId);
            if (boundViewId) {
                const boundNode = this.nodes.get(boundViewId);
                if (boundNode && boundNode.mounted) {
                    continue; // Already rendered as mounted view
                }
            }

            // Render as unmounted ViewLink with link: protocol
            const linkIndent = '    '.repeat(depth + 1);
            const label = link.label || link.viewType || 'View';
            lines.push(`${linkIndent}↳ [${label}](link:${link.linkId})`);
        }
    }

    /**
     * @deprecated Use renderNodeV2 for RFC-007 compliance
     */
    private renderNode(viewId: ViewID, depth: number, lines: string[]): void {
        const node = this.nodes.get(viewId);
        if (!node) return;

        const indent = '    '.repeat(depth);
        const status = node.mounted ? ', mounted' : '';
        const name = node.view.name || viewId;

        lines.push(`${indent}- [${name}](view:${viewId}${status})`);

        // Render instantiated children
        for (const childId of node.childIds) {
            // Check if this child is an instantiated view or just a mountable placeholder
            if (this.nodes.has(childId)) {
                this.renderNode(childId, depth + 1, lines);
            } else {
                // It's a mountable view (not yet instantiated)
                const entry = this.mountableEntries.get(childId);
                if (entry) {
                    const childIndent = '    '.repeat(depth + 1);
                    // Use factory's name or generate from factory function
                    const mountableName = entry.label || `View ${childId}`;
                    lines.push(`${childIndent}- [${mountableName}](view:${childId})`);
                }
            }
        }
    }

    /**
     * Render all mounted View contents
     *
     * SDK View components output HTML with view attribute (e.g., <div view="Chat">),
     * Transformer will convert to <view> tag.
     */
    renderMountedViews(): string {
        const mountedViews = this.getMountedViews();

        return mountedViews.map(view => {
            // view.render() returns SDK-rendered HTML (with view attribute)
            // Transformer will recognize view attribute and convert to <view> tag
            return view.render();
        }).join('\n\n');
    }

    // ═══════════════════════════════════════════════════════════════
    //  Mountable View API (ViewLink Redesign)
    // ═══════════════════════════════════════════════════════════════

    private mountableEntries = new Map<ViewID, MountableViewEntry>();

    /**
     * Register a mountable view (unmounted state)
     *
     * Called by ViewLink. The view is NOT created yet - only the factory and props
     * are cached. When Agent calls mount_view, we use these to create the actual View.
     *
     * @param viewId - Pre-generated view ID (from FunctionalApp)
     * @param parentId - Parent view ID (where the ViewLink is rendered)
     * @param factory - View factory function
     * @param props - Props to pass when mounted
     * @param label - Display label (optional)
     */
    registerMountableView(
        viewId: ViewID,
        parentId: ViewID,
        factory: (viewId: string, props?: Record<string, unknown>) => IView,
        props?: Record<string, unknown>,
        label?: string
    ): void {
        const entry: MountableViewEntry = {
            factory,
            props,
            parentId,
            label
        };

        this.mountableEntries.set(viewId, entry);

        // Add to parent's children (for tree rendering)
        const parent = this.nodes.get(parentId);
        if (parent) {
            if (!parent.childIds.includes(viewId)) {
                parent.childIds.push(viewId);
            }
        }
    }

    /**
     * Unregister a mountable view
     *
     * Called when ViewLink is removed from React tree.
     *
     * IMPORTANT: If the view has already been mounted (via mount_view),
     * we should NOT remove it from the tree. Only clean up the mountable entry.
     */
    unregisterMountableView(viewId: ViewID): void {
        const entry = this.mountableEntries.get(viewId);
        if (!entry) return;

        // Check if this view has been mounted as an actual View
        const node = this.nodes.get(viewId);
        if (node && node.mounted) {
            // View is mounted - DO NOT remove it!
            // Just clean up the mountable entry, keep the actual view in the tree
            this.mountableEntries.delete(viewId);
            return;
        }

        // View is not mounted - safe to remove from parent's children
        const parent = this.nodes.get(entry.parentId);
        if (parent) {
            parent.childIds = parent.childIds.filter(id => id !== viewId);
        }

        // If it exists as an unmounted node, remove it
        if (this.nodes.has(viewId)) {
            this.removeView(viewId);
        }

        this.mountableEntries.delete(viewId);
    }

    /**
     * Get mountable entry (factory + props) for a view ID
     */
    getMountableEntry(viewId: ViewID): MountableViewEntry | undefined {
        return this.mountableEntries.get(viewId);
    }

    /**
     * Mount a previously registered mountable view
     *
     * Called by Runtime when Agent invokes mount_view.
     * Creates the actual View instance using cached factory and props.
     */
    async mountMountableView(viewId: ViewID): Promise<void> {
        const entry = this.mountableEntries.get(viewId);
        if (!entry) {
            throw new AOTUIError('VIEW_MOUNTABLE_NOT_FOUND', { viewId });
        }

        // Check if already mounted as actual view
        if (this.nodes.has(viewId)) {
            // Already mounted, just ensure mounted flag
            await this.mountView(viewId);
            return;
        }

        // Create the actual View instance
        // Defensive: Handle both Callable Factory (Proxy) and Object Factory
        let view: IView;
        if (typeof entry.factory === 'function') {
            view = entry.factory(viewId, entry.props);
        } else if (typeof entry.factory === 'object' && entry.factory !== null && 'create' in entry.factory) {
            // Fallback for when Proxy mechanism fails or factory is passed as object
            view = (entry.factory as any).create(viewId, entry.props);
        } else {
            console.error('[ViewTree] Invalid factory:', entry.factory);
            throw new AOTUIError('VIEW_INVALID_FACTORY', { viewId });
        }

        // Add to tree
        this.addView(view, entry.parentId);

        // Mount it
        await this.mountView(viewId);
    }

    /**
     * Check if a view ID is a registered mountable view (not yet instantiated)
     */
    isMountableView(viewId: ViewID): boolean {
        return this.mountableEntries.has(viewId) && !this.nodes.has(viewId);
    }

    /**
     * Get all mountable (unmounted) children of a view
     */
    getMountableChildren(parentId: ViewID): ViewID[] {
        return Array.from(this.mountableEntries.entries())
            .filter(([id, entry]) => entry.parentId === parentId && !this.nodes.has(id))
            .map(([id]) => id);
    }

    // ═══════════════════════════════════════════════════════════════
    //  [RFC-006] ViewLink API - Decoupled ViewLink/View IDs
    // ═══════════════════════════════════════════════════════════════

    /**
     * LinkEntry storage by parent view
     * Map<parentViewId, Map<linkId, LinkEntry>>
     */
    private linksByParent = new Map<ViewID, Map<string, LinkEntry>>();

    /**
     * LinkID counter by parent view and prefix
     * Map<parentViewId, Map<prefix, counter>>
     */
    private linkIdCounters = new Map<ViewID, Map<string, number>>();

    /**
     * Binding: ViewType:UniqueId -> ViewID
     * Used for cross-snapshot matching
     */
    private uniqueIdBindings = new Map<string, ViewID>();

    /**
     * Allocate a unique LinkID for a given prefix within a parent view
     */
    allocateLinkId(parentId: ViewID, prefix: string): string {
        let prefixCounters = this.linkIdCounters.get(parentId);
        if (!prefixCounters) {
            prefixCounters = new Map();
            this.linkIdCounters.set(parentId, prefixCounters);
        }

        const current = prefixCounters.get(prefix) ?? 0;
        prefixCounters.set(prefix, current + 1);
        return `${prefix}_${current}`;
    }

    /**
     * Register a ViewLink
     * 
     * @param parentId - Parent View ID
     * @param entry - Link entry data
     */
    registerLink(parentId: ViewID, entry: LinkEntry): void {
        let links = this.linksByParent.get(parentId);
        if (!links) {
            links = new Map();
            this.linksByParent.set(parentId, links);
        }

        // Check for duplicate LinkID
        if (links.has(entry.linkId)) {
            throw new AOTUIError('LINK_DUPLICATE', {
                parentId,
                linkId: entry.linkId
            });
        }

        links.set(entry.linkId, entry);

        // [DEBUG] Log registration
        console.log(`[ViewTree] Registering link: ${entry.linkId}, factory type: ${typeof entry.factory}`);
        if (typeof entry.factory !== 'function') {
            console.error('[ViewTree] INVALID FACTORY REGISTRATION:', entry);
        }

        // Add to parent's children for tree rendering
        const parent = this.nodes.get(parentId);
        if (parent) {
            const childId = entry.linkId as unknown as ViewID; // For tree rendering only
            if (!parent.childIds.includes(childId)) {
                // We don't add unmounted links to childIds anymore
                // They are rendered separately via linksByParent
            }
        }
    }

    /**
     * Unregister a ViewLink
     */
    unregisterLink(parentId: ViewID, linkId: string): void {
        const links = this.linksByParent.get(parentId);
        if (!links) return;

        const entry = links.get(linkId);
        if (!entry) return;

        // Check if a view was mounted from this link
        const bindingKey = `${entry.viewType}:${entry.uniqueId}`;
        const boundViewId = this.uniqueIdBindings.get(bindingKey);

        if (boundViewId && this.nodes.has(boundViewId)) {
            // View is mounted - keep it alive, just remove the link registration
            // The view continues to exist until explicitly dismounted
        }

        links.delete(linkId);
        if (links.size === 0) {
            this.linksByParent.delete(parentId);
        }
    }

    /**
     * Get bound ViewID for a ViewType + UniqueID combination
     */
    getBoundViewId(viewType: string, uniqueId: string): ViewID | undefined {
        const bindingKey = `${viewType}:${uniqueId}`;
        return this.uniqueIdBindings.get(bindingKey);
    }

    /**
     * Mount a view via ViewLink
     * 
     * Called when Agent executes mount(parent_view, link_id)
     * 
     * @param parentId - Parent View ID
     * @param linkId - Link ID
     * @returns Mounted ViewID
     */
    async mountByLink(parentId: ViewID, linkId: string): Promise<ViewID> {
        const links = this.linksByParent.get(parentId);
        if (!links) {
            throw new AOTUIError('LINK_NOT_FOUND', { parentId, linkId });
        }

        const entry = links.get(linkId);
        if (!entry) {
            throw new AOTUIError('LINK_NOT_FOUND', { parentId, linkId });
        }

        // Check if already bound (idempotent)
        const bindingKey = `${entry.viewType}:${entry.uniqueId}`;
        const existingViewId = this.uniqueIdBindings.get(bindingKey);
        if (existingViewId && this.nodes.has(existingViewId)) {
            // Already mounted - ensure it's still mounted and return
            const node = this.nodes.get(existingViewId);
            if (node && !node.mounted) {
                await this.mountView(existingViewId);
            }
            return existingViewId;
        }

        // Create new View - use mountable entry mechanism
        // First, register as mountable entry (for compatibility with existing flow)
        const viewId = `view_${this.nodes.size}` as ViewID;

        // Create the view instance
        let view: IView;
        // console.log(`[ViewTree] Mounting link: ${linkId}, factory type: ${typeof entry.factory}`);
        if (typeof entry.factory === 'function') {
            view = entry.factory(viewId, entry.props);
        } else if (typeof entry.factory === 'object' && entry.factory !== null && typeof (entry.factory as any).create === 'function') {
            // Support Factory object
            view = (entry.factory as any).create(viewId, entry.props);
        } else {
            throw new AOTUIError('VIEW_INVALID_FACTORY', { viewId });
        }

        // Add view to tree
        this.addView(view, parentId);

        // Bind UniqueID to ViewID
        this.uniqueIdBindings.set(bindingKey, viewId);

        // Mount the view
        await this.mountView(viewId);

        return viewId;
    }

    /**
     * Get all links in a parent view (for rendering)
     */
    getLinksInParent(parentId: ViewID): LinkEntry[] {
        const links = this.linksByParent.get(parentId);
        if (!links) return [];
        return Array.from(links.values());
    }

    /**
     * Reset link counters for a parent view
     * Called at the start of each render cycle
     */
    resetLinkCounters(parentId: ViewID): void {
        this.linkIdCounters.delete(parentId);
    }

    /**
     * Clear all links for a parent view
     * Called when parent view is unmounted
     */
    clearLinksForParent(parentId: ViewID): void {
        this.linksByParent.delete(parentId);
        this.linkIdCounters.delete(parentId);
    }

    // ═══════════════════════════════════════════════════════════════
    //  [RFC-027] Component Mode View Registration
    // ═══════════════════════════════════════════════════════════════

    /**
     * Register a component-mode View (from SDK's View component)
     * 
     * Component-mode Views:
     * - Are registered directly without parent (flat structure)
     * - Manage their own mounted state via React lifecycle
     * - Don't participate in traditional ViewTree hierarchy
     * 
     * This method unifies View storage, making ViewTree the single source of truth
     * for both traditional-mode and component-mode Views.
     * 
     * @param view - IView instance created by createInlineView()
     */
    registerComponentView(view: IView): void {
        if (this.nodes.has(view.id)) {
            throw new AOTUIError('VIEW_DUPLICATE', { viewId: view.id });
        }

        // Create node without parent relationship
        const node: MutableViewNode = {
            view,
            parentId: null,     // ✅ Component-mode Views have no parent
            childIds: [],       // ✅ No children (flat structure)
            mounted: true       // ✅ Component manages its own mounted state
        };

        this.nodes.set(view.id, node);

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[ViewTree] Registered component-mode view ${view.id} (${view.name})`);
        }
    }

    /**
     * Unregister a component-mode View
     * 
     * Called when SDK View component unmounts (via useLayoutEffect cleanup)
     * 
     * @param viewId - View ID to unregister
     */
    unregisterComponentView(viewId: ViewID): void {
        const node = this.nodes.get(viewId);
        if (!node) {
            // Idempotent: already removed
            return;
        }

        // Safety check: Component-mode Views should not have children
        if (node.childIds.length > 0) {
            console.warn(
                `[ViewTree] Component-mode view ${viewId} has ${node.childIds.length} children. ` +
                `This should not happen. Children:`,
                node.childIds
            );
        }

        // Remove from storage
        this.nodes.delete(viewId);

        if (process.env.NODE_ENV !== 'production') {
            console.log(`[ViewTree] Unregistered component-mode view ${viewId}`);
        }
    }
}

/**
 * Factory function to create ViewTree instances.
 */
export function createViewTree(contextFactory: ViewContextFactory): IViewTree {
    return new ViewTree(contextFactory);
}
