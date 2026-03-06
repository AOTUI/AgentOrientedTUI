/**
 * @aotui/runtime - AOTUI Runtime Package
 * 
 * This is the main entry point for the AOTUI runtime.
 * 
 * ## Recommended Imports
 * 
 * ### For App Developers (SDK Layer)
 * ```typescript
 * import { createRuntime } from '@aotui/runtime';
 * ```
 * 
 * ### For Types (SPI Layer)
 * ```typescript
 * import type { IView, IViewContext, IKernel, OperationResult } from '@aotui/runtime';
 * ```
 * 
 * ### For Integration (Adapters Layer)
 * ```typescript
 * import { Bridge, SYSTEM_TOOLS, generateToolsFromIndexMap } from '@aotui/runtime';
 * ```
 * 
 * ## ⚠️ Internal APIs
 * Engine layer exports (Desktop, ViewTree, Registry, etc.) are for framework
 * contributors only. They may change without notice.
 * 
 * @module @aotui/runtime
 */

// ============================================================================
// 🟢 Public: Facades Layer (Product Layer Integration)
// ============================================================================
// [P1 FIX] Renamed from "sdk" to "facades" to avoid confusion with @aotui/sdk package
// This provides factory functions for Product Layer (Server) to create Runtime instances
export * from './facades/index.js';

// ============================================================================
// 🟢 Public: SPI Layer (Types & Interfaces - Stable Contract)
// ============================================================================
export * from './spi/index.js';

// ============================================================================
// 🟢 Public: Kernel (Orchestrator - Stable API)
// ============================================================================
export * from './kernel/index.js';

// ============================================================================
// 🟢 Public: Adapters Layer (Integration Points)
// ============================================================================
export * from './adapters/bridge/index.js';


// ============================================================================
// 🟢 Public: App Registry (Third-Party App Management)
// Used by Product Layer to load and manage third-party TUI apps
// ============================================================================
export { AppRegistry } from './engine/app/index.js';
export type { LoadedApp, AppRegistryOptions, TUIConfig, AppConfigEntry } from './engine/app/index.js';

// ============================================================================
// 🟢 Public: System Operations (For Agent Driver)
// ============================================================================
export { createSystemOperationRegistry } from './engine/system/operations/index.js';

// ============================================================================
// 🟢 Public: App Distribution Helpers
// Used by Product Layer / CLI for discovery and installation workflows
// ============================================================================
export {
    DEFAULT_APP_CATALOG,
    type CatalogAppEntry,
    type CatalogData
} from './cli/default-catalog.js';
export {
    searchCatalog,
    isCatalogData,
    type CatalogSearchResult
} from './cli/catalog.js';
export {
    resolveCatalog,
    resolveCatalogOptionsFromConfig,
    fetchRemoteCatalog,
    verifyCatalogSignature,
    stableStringify,
    type CatalogSignature,
    type CatalogResolverOptions,
    type ResolvedCatalog,
    type TrustedCatalogKey,
    type RemoteCatalogEnvelope
} from './cli/catalog-resolver.js';
export {
    parseInstallSource,
    parseNpmSpecifier,
    type ParsedInstallSource,
    type ParsedLocalSource,
    type ParsedNpmSource,
    type NpmSpecifier
} from './cli/sources.js';
export {
    installNpmPackage,
    type NpmInstallOptions,
    type NpmInstallResult
} from './cli/npm-installer.js';

// ============================================================================
// 🔴 REMOVED: Engine Layer Exports
//
// [方案 B] Engine internals are no longer exported to external consumers.
// ViewTree implementation is internal to Worker Runtime (AppKernel).
//
// For Runtime internal use (tests), import directly via relative paths:
//   import { ViewTree } from './engine/view/tree.js';
//
// If you need functionality that was previously exported, consider:
// 1. Is there an SPI interface you should use instead?
// 2. Should this functionality be exposed through the SDK layer?
// ============================================================================
