/**
 * SPI Runtime Layer - Internal Interfaces
 * 
 * Runtime 内部使用的接口，不对外公开。
 * Product Layer 和 Runtime Engine 使用这些接口。
 * 
 * @module @aotui/runtime/spi/runtime
 * @internal
 */

// ============================================================================
// Kernel Interfaces
// ============================================================================
export type {
    IDesktop,
    IRegistry,
    IKernel,
    ShutdownOptions,
} from './kernel.interface.js';

// ============================================================================
// Desktop Manager Interface
// ============================================================================
export type {
    IDesktopManager,
    LockInfo,
} from './desktop-manager.interface.js';

// ============================================================================
// Desktop Manager Atoms (Atomic Interfaces)
// ============================================================================
export type { IDesktopRepository } from './desktop-repository.interface.js';
export type { IDesktopLockService } from './desktop-lock.interface.js';
export type { IAppInstaller } from './app-installer.interface.js';
export type { IDesktopStateAccessor } from './desktop-state-accessor.interface.js';
export type { IDesktopLifecycleController } from './desktop-lifecycle.interface.js';

// ============================================================================
// Desktop DOM Interface (Interface Segregation)
// ============================================================================
export type { IDesktopDOM } from './desktop-dom.interface.js';

// ============================================================================


// ============================================================================
// Worker Runtime Interface (Multi-Framework Support)
// ============================================================================
export type {
    IWorkerRuntime,
    WorkerRuntimeConfig,
    WorkerDOMEnvironment,
    WorkerMessage,
    IAppAdapter,
    AppAdapterMountResult,
} from './worker-runtime.interface.js';

// ============================================================================
// Worker Message Interface (Stable Contract)
// ============================================================================
export type {
    RequestID,
    WorkerMessageType,
    IWorkerMessage,
    IWorkerRequest,
    IWorkerResponse,
    IWorkerError,
} from './worker-message.interface.js';

export {
    generateRequestId,
    isWorkerResponse,
    isWorkerRequest,
    isDomUpdateMessage,
    isWorkerPush,
} from './worker-message.interface.js';

// ============================================================================
// Transformer Interface (DIP Support)
// ============================================================================
export type { ITransformer, TransformResult } from './transformer.interface.js';

// ============================================================================
// Dispatcher Interface (DIP Support)
// ============================================================================
export type { IDispatcher } from './dispatcher.interface.js';

// ============================================================================
// App Host Service Interface (Option B - Desktop Decomposition)
// ============================================================================
export type {
    IAppHostService,
    SnapshotFragment,
    AppInstallOptions,
} from './app-host.interface.js';

// ============================================================================
// Signal Service Interface (Option B - Desktop Decomposition)
// ============================================================================
export type {
    ISignalService,
    ISignalOutputStream,
    SignalListener,
} from './signal.interface.js';

// ============================================================================
// Desktop Context Interface (Option B - Desktop Decomposition)
// ============================================================================
export type {
    DesktopContext,
    DesktopContextFactory,
} from './desktop-context.interface.js';

export type { IRuntimeContext } from './context.interface.js';

// ============================================================================
// Snapshot Interfaces (RFC-007)
// ============================================================================
export type {
    InstalledAppInfo,
    LogEntry,
    IDesktopMetadata,
    ISnapshotFragment,
    FormattedSnapshotResult,
    ISnapshotFormatter,
} from './snapshot.interface.js';

// ============================================================================
// LLM Output Channel Service Interface (RFC-011)
// ============================================================================
export type { ILLMOutputChannelService } from './llm-output-channel.interface.js';

