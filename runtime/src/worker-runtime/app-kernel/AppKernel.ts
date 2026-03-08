/**
 * AOTUI Runtime - App Kernel
 *
 * [方案 B] 从 @aotui/sdk 迁移到 @aotui/runtime/worker-runtime。
 *
 * Worker 内的 App 执行引擎，负责：
 * - App 生命周期管理 (onOpen, onClose...)
 * - ViewTree 状态管理 (SSOT)
 * - 系统事件处理 (Runtime Bridge)
 * - Operation 路由
 * - Type-level Tools 管理
 *
 * @module @aotui/runtime/worker-runtime/app-kernel
 */

import type {
    AppID,
    ViewID,
    OperationID,
    OperationResult,
    OperationContext,
    AppContext,
    IAOTUIApp,
    IView,
    IViewContext,
    IViewContextFull,
    IViewTree,
    AppKernelConfig,
    IViewFactory,
    IRefExporter, // [RFC-002]
} from '../../spi/index.js';
import { createViewId } from '../../spi/index.js';
import { AOTUIError, failedResult } from '../../spi/core/errors.js';
import type { DataPayload, IndexMap } from '../../spi/worker-protocol/index.js';

import { ViewRegistry, createViewRegistry } from './view-registry.js';

// ─────────────────────────────────────────────────────────────
// Type Definitions for Type-level Tools
// ─────────────────────────────────────────────────────────────

/** Type Tool Definition (for registration) */
export interface TypeToolDefinition {
    description: string;
    params: Record<string, unknown>;
    handler: (params: Record<string, unknown>) => Promise<unknown>;
}

/** Type Tool (stored in registry) */
export interface TypeTool {
    id: string;  // `${appId}-${viewType}-${toolName}`
    name: string;
    viewType: string;
    description: string;
    params: Record<string, unknown>;
    handler: (params: Record<string, unknown>) => Promise<unknown>;
}

interface TypeToolParamDef {
    type?: string;
    itemType?: string;
}

/**
 * App Kernel Implementation
 *
 * 运行在 Worker 内的 App 执行引擎。
 * 实现 IAOTUIApp 接口，供 Worker Runtime 调用。
 */
export class AppKernel implements IAOTUIApp, IRefExporter {
    private _id: AppID = '' as AppID;
    readonly name: string;
    private readonly toolAppName: string;

    private config: AppKernelConfig;
    private context!: AppContext;
    private container!: HTMLElement;

    /**
     * [RFC-B2] ViewRegistry - 轻量级View管理
     * 替代ViewTree,只管理组件模式View
     */
    private viewRegistry: ViewRegistry;
    private viewIdCounter = 0;

    /** [RFC-002] Ref Registry Storage */
    private refRegistry = new Map<string, object>();

    /** [RFC-027] View Registry for component mode (viewKey -> viewId) */
    private viewKeyToId = new Map<string, ViewID>();

    /** Type-level Tools Registry */
    private typeTools = new Map<string, Map<string, TypeTool>>();

    constructor(config: AppKernelConfig) {
        // [RFC-B2] Only support component mode
        if (!config.component) {
            throw new AOTUIError(
                'CONFIG_INVALID',
                { reason: 'AppKernelConfig.component is required. Traditional mode (config.root) is no longer supported.' }
            );
        }

        this.config = config;
        this.name = config.name;
        this.toolAppName = this.resolveToolAppName(config.appName, config.name);

        // Initialize ViewRegistry
        this.viewRegistry = createViewRegistry();
    }

    private resolveToolAppName(explicitAppName: string | undefined, displayName: string): string {
        if (explicitAppName !== undefined) {
            if (!/^[a-zA-Z0-9_]+$/.test(explicitAppName)) {
                throw new AOTUIError('CONFIG_INVALID', {
                    reason: `Invalid appName "${explicitAppName}". appName must match /^[a-zA-Z0-9_]+$/`
                });
            }
            return explicitAppName;
        }

        const normalized = displayName
            .replace(/[^a-zA-Z0-9_]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .replace(/_{2,}/g, '_')
            .toLowerCase();

        if (normalized.length > 0) {
            return normalized;
        }

        return 'app';
    }

    /**
     * Tool 前缀语义名（供 Worker 侧导出 Tool Key）
     */
    getToolAppName(): string {
        return this.toolAppName;
    }

    get id(): AppID {
        return this._id;
    }

    setId(id: AppID): void {
        this._id = id;
    }

    // ─────────────────────────────────────────────────────────────
    //  Lifecycle
    // ─────────────────────────────────────────────────────────────

    async onOpen(context: AppContext, container: HTMLElement): Promise<void> {
        this.context = context;
        this.container = container;

        // Create DOM structure
        this.initializeDOMStructure();

        // Register render callback
        context.onRender(() => {
            // console.log(`[AppKernel:${this.name}] renderCallback triggered`);
            this.renderAllViews();
        });

        // [RFC-B2] Only component mode supported
        await this.initializeFromComponent();

        // [RFC-B2] Removed System Event Listeners
        // mount/dismount/ViewLink are now handled via Operations

        // [RFC-002] Ref event listeners
        this.container.addEventListener('aotui:ref-register', this.handleRefRegister);
        this.container.addEventListener('aotui:ref-unregister', this.handleRefUnregister);

        // System event listeners (component mode)
        this.container.addEventListener('aotui:system', this.handleSystemEvent);

        // [RFC-020] Type Tool event listeners (Dynamic Registration)
        this.container.addEventListener('aotui:type-tool-register', this.handleTypeToolRegister);
        this.container.addEventListener('aotui:type-tool-unregister', this.handleTypeToolUnregister);

        // Initial render
        this.renderAllViews();
    }

    async onClose(): Promise<void> {
        // [RFC-B2] Component mode: Views self-cleanup via useLayoutEffect
        // No need to manually dismount

        // Remove event listeners
        if (this.container) {
            this.container.removeEventListener('aotui:ref-register', this.handleRefRegister);
            this.container.removeEventListener('aotui:ref-unregister', this.handleRefUnregister);
            this.container.removeEventListener('aotui:type-tool-register', this.handleTypeToolRegister);
            this.container.removeEventListener('aotui:type-tool-unregister', this.handleTypeToolUnregister);
            this.container.removeEventListener('aotui:system', this.handleSystemEvent);
        }

        // Clear ViewRegistry
        this.viewRegistry.clear();

        // console.log(`[AppKernel:${this.name}] onClose completed`);
    }

    async onReinitialize(context?: import('../../spi/index.js').AppReinitializeContext): Promise<void> {
        if (this.config.onReinitialize) {
            await this.config.onReinitialize({
                ...this.context,
                reason: context?.reason ?? (this.config.launchConfig as { __aotuiLifecycle?: { reason?: string } } | undefined)
                    ?.__aotuiLifecycle?.reason,
            });
        }
    }

    /**
     * [RFC-015] App Delete Lifecycle
     */
    async onDelete(): Promise<void> {
        if (this.config.onDelete) {
            try {
                await this.config.onDelete(this.context);
            } catch (error) {
                // console.error(`[AppKernel:${this.name}] Error in onDelete:`, error);
                // Swallow error to ensure cleanup continues
            }
        }
    }

    async onPause(): Promise<void> {
        // Default: no-op
    }

    async onResume(): Promise<void> {
        // Default: no-op
    }

    // ─────────────────────────────────────────────────────────────
    //  System Events (Runtime Bridge)
    // ─────────────────────────────────────────────────────────────

    /**
     * Handle system events from Desktop
     * 
     * [RFC-B2] Removed mount/dismount/ViewLink system events
     * View lifecycle is now managed via Operations
     */
    async onSystemEvent(event: string, payload: DataPayload): Promise<void> {
        console.log(`[AppKernel] System event: ${event}`, payload);
        console.warn(`[AppKernel] System event '${event}' is not supported in component mode.`);
    }

    /**
     * Handle DOM-based system events from worker runtime.
     * Used to request view close in component mode.
     */
    private handleSystemEvent = (event: Event) => {
        const detail = (event as CustomEvent).detail as { type?: string; viewId?: ViewID } | undefined;
        if (!detail || detail.type !== 'dismount_view' || !detail.viewId) {
            return;
        }

        const viewId = detail.viewId;
        const viewNode = this.container.querySelector(`[data-view-id="${viewId}"]`) as HTMLElement | null
            ?? this.container.querySelector(`#${viewId}`) as HTMLElement | null;

        if (!viewNode) {
            console.warn(`[AppKernel] dismount_view target not found: ${viewId}`);
            return;
        }

        const CustomEventCtor = this.container.ownerDocument.defaultView?.CustomEvent as typeof CustomEvent | undefined;
        if (!CustomEventCtor) {
            console.warn('[AppKernel] CustomEvent not available for view close dispatch');
            return;
        }

        const closeEvent = new CustomEventCtor('aotui:view-close', {
            bubbles: true,
            detail: { viewId, reason: 'system_dismount' }
        });

        viewNode.dispatchEvent(closeEvent);
    };

    // ─────────────────────────────────────────────────────────────
    //  Operations
    // ─────────────────────────────────────────────────────────────

    /**
     * Execute Operation
     *
     * Routes the operation to the appropriate view or app-level handler.
     */
    async onOperation(
        context: OperationContext,
        operation: OperationID,
        args: Record<string, unknown>
    ): Promise<OperationResult> {
        // Route to view if viewId is specified
        if (context.viewId) {
            // [RFC-B2] Unified query: only ViewRegistry
            const view = this.viewRegistry.get(context.viewId);
            if (!view) {
                // [RFC-020] Type Tool Routing Fallback
                // If view not found, check if viewId is actually a ViewType targeting a Type Tool
                // AgentParser: app-FileDetail-op -> viewId="FileDetail"
                if (this.typeTools.has(context.viewId)) {
                    return this.callTypeTool(context.viewId, operation, args);
                }

                return failedResult('VIEW_NOT_FOUND', { viewId: context.viewId });
            }

            const result = await view.onOperation(operation, args);
            if (result.success) {
                this.renderAllViews();
            }
            return result;
        }

        // App-level operation
        if (this.config.onOperation) {
            return this.config.onOperation(operation, args, {
                appId: this._id,
                desktopId: this.context.desktopId,
            });
        }

        return failedResult('OPERATION_NO_HANDLER', { operationName: operation });
    }

    // ─────────────────────────────────────────────────────────────
    //  Ref Registry (RFC-002)
    // ─────────────────────────────────────────────────────────────
    //  [RFC-002] RefExporter Implementation
    // ─────────────────────────────────────────────────────────────

    /**
     * Handle ref-register event from DOM
     */
    private handleRefRegister = (event: Event) => {
        const { viewId, key, data } = (event as CustomEvent).detail;
        const fullKey = `${viewId}:${key}`;
        this.refRegistry.set(fullKey, data);
    };

    /**
     * Handle ref-unregister event from DOM
     */
    private handleRefUnregister = (event: Event) => {
        const { viewId, key } = (event as CustomEvent).detail;
        const fullKey = `${viewId}:${key}`;
        this.refRegistry.delete(fullKey);
    };

    /**
     * Export ref from view
     */
    exportRef<T extends object>(viewId: ViewID, key: string, data: T): void {
        const fullKey = `${viewId}:${key}`;
        this.refRegistry.set(fullKey, data);
    }

    /**
     * Unexport ref from view
     */
    unexportRef(viewId: ViewID, key: string): void {
        const fullKey = `${viewId}:${key}`;
        this.refRegistry.delete(fullKey);
    }

    /**
     * [IRefExporter] Alias for exportRef
     */
    public registerRef(viewId: string, refId: string, data: object): void {
        this.exportRef(viewId as ViewID, refId, data);
    }

    /**
     * [IRefExporter] Alias for unexportRef
     */
    public unregisterRef(viewId: string, refId: string): void {
        this.unexportRef(viewId as ViewID, refId);
    }

    /**
     * Export all registered refs to IndexMap
     * Called by Worker Runtime during snapshot generation
     */
    exportRefsToIndexMap(): IndexMap {
        const result: IndexMap = {};
        for (const [fullKey, data] of this.refRegistry) {
            // 保留完整 key: "viewId:refId"
            // SnapshotFormatter 会添加 appId 前缀
            result[fullKey] = data as DataPayload;
        }
        return result;
    }

    // ─────────────────────────────────────────────────────────────
    //  Type Tool Management (RFC-020)
    // ─────────────────────────────────────────────────────────────

    /**
     * Unregister Type Tool
     */
    unregisterTypeTool(viewType: string, toolName: string): void {
        const tools = this.typeTools.get(viewType);
        if (tools) {
            tools.delete(toolName);
            if (tools.size === 0) {
                this.typeTools.delete(viewType);
            }

            // Type tool set changed; refresh snapshot indexMap immediately
            this.context?.markDirty?.();

            if (process.env.NODE_ENV !== 'production') {
                // console.log(`[AppKernel:${this.name}] Unregistered Type Tool: ${viewType}.${toolName}`);
            }
        }
    }

    /**
     * Handle type-tool-register event from DOM
     */
    private handleTypeToolRegister = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        this.registerTypeTool(detail.viewType, detail.toolName, {
            description: detail.description,
            params: detail.params,
            handler: detail.handler
        });
    };

    /**
     * Handle type-tool-unregister event from DOM
     */
    private handleTypeToolUnregister = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        this.unregisterTypeTool(detail.viewType, detail.toolName);
    };

    // ─────────────────────────────────────────────────────────────
    //  [RFC-007] View Tree Export
    // ──────────────────────────────────────────────────────────── 

    /**
     * [RFC-B2] Render View Tree to Markdown
     * 
     * Component mode: Parse from DOM instead of ViewTree
     */
    renderViewTree(): string {
        // [RFC-B2] TODO: Implement DOM parsing for component mode
        // For now, return registered views list
        const allViews = this.viewRegistry.getAll();
        return allViews.map(v => `- ${v.name} (${v.id})`).join('\n');
    }

    // ─────────────────────────────────────────────────────────────
    //  Private: View Initialization
    // ─────────────────────────────────────────────────────────────

    private initializeDOMStructure(): void {
        // View Tree Container (Markdown)
        let treeContainer = this.container.querySelector('[data-view-tree]');
        if (!treeContainer) {
            treeContainer = this.container.ownerDocument.createElement('div');
            treeContainer.setAttribute('data-view-tree', '');
            this.container.appendChild(treeContainer);
        }

        // Views Container (Preact mounts)
        let viewsContainer = this.container.querySelector('[data-views]');
        if (!viewsContainer) {
            viewsContainer = this.container.ownerDocument.createElement('div');
            viewsContainer.setAttribute('data-views', '');
            this.container.appendChild(viewsContainer);
        }
    }



    /**
     * [RFC-027-C] Component初始化 (Factory Injection Pattern)
     */
    private componentRenderer?: any; // ComponentRenderer from SDK

    private async initializeFromComponent(): Promise<void> {
        // console.log(`[AppKernel:${this.name}] Initializing via Factory Injection Pattern`);

        // 1. 创建App容器 (在data-views容器中)
        const viewsContainer = this.container.querySelector('[data-views]');
        if (!viewsContainer) {
            throw new Error(
                '[AppKernel] Cannot find data-views container. ' +
                'This is required for component mode.'
            );
        }

        const appContainer = this.container.ownerDocument.createElement('div');
        appContainer.setAttribute('data-app-root', '');
        viewsContainer.appendChild(appContainer);

        // 2. 获取Factory (config.component现在是Factory对象)
        const factory = this.config.component as any;

        if (!factory || typeof factory.initializeComponent !== 'function') {
            throw new Error(
                '[AppKernel] Invalid component factory: initializeComponent method not found. ' +
                'Make sure you are using createTUIApp() from SDK.'
            );
        }

        // 3. 构建RuntimeContext
        const runtimeContext = {
            appId: this._id,
            desktopId: this.context.desktopId,
            launchConfig: this.config.launchConfig,
            allocateViewId: (key: string) => this.allocateViewId(key),
            registerView: (view: IView) => this.registerView(view),
            unregisterView: (viewId: ViewID) => this.unregisterView(viewId),
            refExporter: this,
            markDirty: () => this.context.markDirty(),
            typeTools: this, // AppKernel implements ITypeToolRegistry interface methods
        };

        // 4. 调用SDK factory初始化组件
        this.componentRenderer = await factory.initializeComponent(appContainer, runtimeContext);

        // console.log(`[AppKernel:${this.name}] Factory initialized, Views will self-register`);
    }

    // ─────────────────────────────────────────────────────────────
    //  Private: Rendering
    // ─────────────────────────────────────────────────────────────

    private renderAllViews(): void {
        // [RFC-B2] Component mode: Views auto-render via Preact
        // Just update the tree description
        const treeOutput = this.renderViewTree();
        const treeContainer = this.container.querySelector('[data-view-tree]');
        if (treeContainer) {
            treeContainer.innerHTML = treeOutput;
        }

        // Component-mode Views self-render, no manual triggering needed
    }

    // [RFC-B2] Removed createViewContainer() and removeViewContainer()
    // Component mode: Views manage their own containers

    private generateViewId(): ViewID {
        return createViewId(this.viewIdCounter++);
    }

    // ─────────────────────────────────────────────────────────────
    //  [RFC-027] Component Mode Methods
    // ─────────────────────────────────────────────────────────────

    /**
     * Allocate viewId for component mode
     * Uses view key (name or name_uniqueId) to ensure consistent ID assignment
     */
    private allocateViewId(key: string): ViewID {
        const existing = this.viewKeyToId.get(key);
        if (existing) {
            return existing;
        }

        const viewId = this.generateViewId();
        this.viewKeyToId.set(key, viewId);

        if (process.env.NODE_ENV !== 'production') {
            // console.log(`[AppKernel:${this.name}] Allocated ${viewId} for key "${key}"`);
        }

        return viewId;
    }

    /**
     * [RFC-B2] Register IView instance from component mode
     */
    private registerView(view: IView): void {
        this.viewRegistry.register(view);
        if (process.env.NODE_ENV !== 'production') {
            // console.log(`[AppKernel:${this.name}] Registered view ${view.id} (${view.name})`);
        }
    }

    /**
     * [RFC-B2] Unregister IView instance
     */
    private unregisterView(viewId: ViewID): void {
        this.viewRegistry.unregister(viewId);
        if (process.env.NODE_ENV !== 'production') {
            // console.log(`[AppKernel:${this.name}] Unregistered view ${viewId}`);
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  Type-level Tools (View Type Aggregation)
    // ─────────────────────────────────────────────────────────────

    /**
     * Register a Type-level Tool
     * Tool ID format: `${appId}-${viewType}-${toolName}`
     */
    registerTypeTool(viewType: string, toolName: string, tool: TypeToolDefinition): void {
        if (!this.typeTools.has(viewType)) {
            this.typeTools.set(viewType, new Map());
        }

        const toolId = `${this._id}-${viewType}-${toolName}`;

        // [DEBUG] Log tool.params at registration
        // console.log(`[AppKernel:${this.name}] 🔍 registerTypeTool: ${toolId}`);
        // console.log(`[AppKernel] tool.params type:`, typeof tool.params);
        // console.log(`[AppKernel] tool.params value:`, JSON.stringify(tool.params, null, 2));

        this.typeTools.get(viewType)!.set(toolName, {
            id: toolId,
            name: toolName,
            viewType,
            description: tool.description,
            params: tool.params,
            handler: tool.handler
        });

        // Type tool set changed; refresh snapshot indexMap immediately
        this.context?.markDirty?.();

        if (process.env.NODE_ENV !== 'production') {
            // console.log(`[AppKernel:${this.name}] Registered Type Tool: ${toolId}`);
        }
    }

    /**
     * Call a Type-level Tool - LLM must provide view_id in params
     */
    async callTypeTool(
        viewType: string,
        toolName: string,
        params: Record<string, unknown>
    ): Promise<OperationResult> {
        const tool = this.typeTools.get(viewType)?.get(toolName);
        if (!tool) {
            return {
                success: false,
                error: {
                    code: 'OPERATION_FAILED' as const,
                    message: `Type tool ${viewType}.${toolName} not found`,
                    context: { viewType, toolName }
                }
            };
        }

        try {
            const resolvedArgsResult = this.resolveTypeToolArgs(viewType, toolName, tool.params, params);
            if (!resolvedArgsResult.success) {
                return resolvedArgsResult;
            }

            const result = await tool.handler(resolvedArgsResult.data as Record<string, unknown>);
            this.componentRenderer?.render();
            this.renderAllViews();
            return {
                success: true,
                data: result as Record<string, unknown>
            };
        } catch (error) {
            return {
                success: false,
                error: {
                    code: 'OPERATION_FAILED' as const,
                    message: `Type tool execution failed: ${(error as Error).message}`,
                    context: { viewType, toolName }
                }
            };
        }
    }

    /**
     * Get all Type Tools for a specific view type
     */
    getTypeTools(viewType: string): TypeTool[] {
        const tools = this.typeTools.get(viewType);
        return tools ? Array.from(tools.values()) : [];
    }

    /**
     * Get all registered Type Tools (all types)
     */
    getAllTypeTools(): Map<string, TypeTool[]> {
        const result = new Map<string, TypeTool[]>();
        for (const [viewType, toolsMap] of this.typeTools) {
            result.set(viewType, Array.from(toolsMap.values()));
        }
        return result;
    }

    private resolveTypeToolArgs(
        viewType: string,
        toolName: string,
        paramSchema: Record<string, unknown>,
        rawArgs: Record<string, unknown>
    ): OperationResult {
        const resolvedArgs: Record<string, unknown> = { ...rawArgs };
        const viewIdsForType = this.viewRegistry.getByType(viewType).map(view => view.id);

        for (const [paramName, value] of Object.entries(rawArgs)) {
            const def = (paramSchema[paramName] ?? null) as TypeToolParamDef | null;
            if (!def) {
                continue;
            }

            if (def.type === 'reference') {
                if (typeof value === 'object' && value !== null) {
                    continue;
                }
                if (typeof value !== 'string') {
                    return failedResult('OPERATION_INVALID_ARGS', {
                        param: paramName,
                        operationName: `${viewType}.${paramName}`,
                        reason: 'reference parameter must be string or object',
                        expected: 'reference string or object',
                        received: typeof value,
                        viewType,
                    });
                }

                const resolved = this.resolveRefId(value, viewIdsForType);
                if (!resolved) {
                    return failedResult('OPERATION_INVALID_ARGS', {
                        operationName: toolName,
                        param: paramName,
                        refId: value,
                        reason: `reference '${value}' not found in current snapshot indexMap`,
                        viewType,
                    });
                }
                resolvedArgs[paramName] = resolved;
                continue;
            }

            if (def.type === 'array' && def.itemType === 'reference' && Array.isArray(value)) {
                const resolvedItems: unknown[] = [];
                for (const item of value) {
                    if (typeof item === 'object' && item !== null) {
                        resolvedItems.push(item);
                        continue;
                    }
                    if (typeof item !== 'string') {
                        return failedResult('OPERATION_INVALID_ARGS', {
                            param: paramName,
                            operationName: `${viewType}.${paramName}`,
                            reason: 'reference array contains non-string/non-object item',
                            expected: 'reference[] as string[] or object[]',
                            received: typeof item,
                            viewType,
                        });
                    }
                    const resolvedItem = this.resolveRefId(item, viewIdsForType);
                    if (!resolvedItem) {
                        return failedResult('OPERATION_INVALID_ARGS', {
                            operationName: toolName,
                            param: paramName,
                            refId: item,
                            reason: `reference '${item}' not found in current snapshot indexMap`,
                            viewType,
                        });
                    }
                    resolvedItems.push(resolvedItem);
                }
                resolvedArgs[paramName] = resolvedItems;
            }
        }

        return {
            success: true,
            data: resolvedArgs,
        };
    }

    private resolveRefId(refId: string, scopedViewIds: ViewID[]): object | null {
        for (const viewId of scopedViewIds) {
            const scopedKey = `${viewId}:${refId}`;
            const scopedMatch = this.refRegistry.get(scopedKey);
            if (scopedMatch) {
                return scopedMatch;
            }
        }

        for (const [fullKey, value] of this.refRegistry.entries()) {
            if (fullKey.endsWith(`:${refId}`)) {
                return value;
            }
        }

        return null;
    }
}
