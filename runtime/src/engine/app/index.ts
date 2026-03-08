/**
 * App Domain
 * 
 * 包含 App 生命周期管理、注册机制、Worker 隔离及通信相关模块。
 * 
 * @module @aotui/runtime/engine/app
 */

// ============================================================================
// AppManager - App 生命周期管理
// ============================================================================
export { AppManager, type InstalledApp, type AppManagerOptions } from './manager.js';

// ============================================================================
// AppRegistry - 第三方 App 加载
// ============================================================================
export {
    AppRegistry,
    type LoadedApp,
    type AppRegistryEntry,
    type AppRegistryOptions,
    validateManifest,
    isValidAppName
} from './registry.js';
export { createDefaultConfig, validateConfig, type TUIConfig, type AppConfigEntry } from './config.js';

// ============================================================================
// WorkerSandbox - Worker 线程隔离
// ============================================================================
export { WorkerSandbox, type WorkerSandboxConfig, type SandboxStatus } from './worker-sandbox.js';

// ============================================================================
// AppWorkerHost - 主线程 IPC Host
// ============================================================================
export { AppWorkerHost, type AppWorkerHostConfig, type WorkerStatus } from './worker-host.js';


// ============================================================================
// WorkerPool - Worker 池管理
// ============================================================================
export { WorkerPool, type WorkerPoolConfig } from './worker-pool.js';

// ============================================================================
// WorkerAppHostService - IAppHostService 实现 (Option B)
// ============================================================================
export { WorkerAppHostService } from './worker-app-host.service.js';
