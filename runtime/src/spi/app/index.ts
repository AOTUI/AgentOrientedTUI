/**
 * SPI App Layer - App Developer API
 * 
 * 面向 App 开发者的稳定接口。
 * 开发者通过 @aotui/sdk 使用这些类型，不直接导入此模块。
 * 
 * @module @aotui/runtime/spi/app
 */

// ============================================================================
// View Interfaces (3-Layer Context)
// ============================================================================
export type { IViewContextCore } from './view-context-core.interface.js';
export type { IViewContext, IView, IViewContextFull } from './view.interface.js';
export type { IViewContextMountable, RegisterLinkOptions } from './view-context-ext.interface.js';
export { hasMountableSupport } from './view-context-ext.interface.js';

// ============================================================================
// ViewLink Types (RFC-006)
// ============================================================================
export type {
    LinkEntry,
    ViewBinding,
    BindingKey,
    MountViewArgsV2,
    MountViewResult,
    DismountViewArgs
} from './view-link.types.js';
export { createBindingKey } from './view-link.types.js';

// ============================================================================
// View Tree Interface [RFC-011]
// ============================================================================
export type { IViewTree, ViewNode, ViewContextFactory, MountableViewEntry } from './view-tree.interface.js';

// ============================================================================
// App Interface
// ============================================================================
export type { IAOTUIApp } from './app.interface.js';

// ============================================================================
// View Factory Interface (方案 B: 从 SDK 提升)
// ============================================================================
export type { IViewFactory } from './view-factory.interface.js';

// ============================================================================
// App Kernel Configuration (方案 B: 解耦 SDK 和 Runtime)
// ============================================================================
export type { AppKernelConfig, AppOperationHandler, SignalPolicy } from './app-kernel.interface.js';

// ============================================================================
// App Context (Store)
// ============================================================================
export type { AppContext } from './store.interface.js';

// ============================================================================
// App Launch Configuration
// ============================================================================
export type { AppLaunchConfig } from './app-config.interface.js';

// ============================================================================
// App Factory & Manifest
// ============================================================================
export type { TUIAppFactory } from './app-factory.interface.js';
export { isTUIAppFactory, isKernelConfigFactory, isLegacyFactory } from './app-factory.interface.js';

export type {
    AOAppManifest,
    AOAppView,
    AOAppRuntime,
    AOAppEntry,
} from './aoapp.js';
export { validateManifest, isValidAppName } from './aoapp.js';

// ============================================================================
// Ref Exporter (RFC-002)
// ============================================================================
export type { IRefExporter } from './ref-exporter.interface.js';

// ============================================================================
// [P4/P5 FIX] Public Types for App Developers (SSOT)
// ============================================================================
// These are the canonical types that SDK should re-export.
// App developers should import from @aotui/sdk, not directly from here.
export type {
    IViewMeta,
    IRefRegistry,
    ITypeToolRegistry,
    TypeToolDefinition,
    IViewLinkRegistry,
    IMountableViewRegistry,
    IOperationRegistry,
    IDynamicViewRegistry,
    IAppConfig,
    RegisterLinkOptions as RegisterLinkOptionsPublic,
    SimpleOperationHandler,
} from './public-types.js';
