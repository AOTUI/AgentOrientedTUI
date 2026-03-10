/**
 * Engine Layer - Desktop Manager Implementation
 * 
 * 管理 Desktop 实例的生命周期和并发控制。
 * 
 * @module @aotui/runtime/engine/desktop-manager
 */

import type {
    IDesktopManager,
    LockInfo,
    DesktopID,
    AppID,
    AppState,
    DesktopStatus,
    IDesktop,
    IRuntimeContext, // New
} from '../../spi/index.js';
import { AOTUIError } from '../../spi/core/errors.js';
import { Desktop } from './desktop.js';
import { InMemoryLockService } from './services/lock.service.js';

// ============================================================================
// Desktop Manager Implementation
// ============================================================================

/**
 * Desktop 管理器实现
 * 
 * 封装 Desktop 的创建、存储、锁管理和生命周期控制。
 * Kernel 通过 IDesktopManager 接口与之交互，实现依赖反转。
 * 
 * @example
 * ```typescript
 * const manager = new DesktopManager();
 * const desktopId = await manager.create();
 * manager.acquireLock(desktopId, 'agent_1');
 * await manager.installDynamicWorkerApp(desktopId, myApp);
 * manager.releaseLock(desktopId, 'agent_1');
 * ```
 */
import { RuntimeConfig, RUNTIME_DEFAULTS } from '../../spi/config/index.js';

export class DesktopManager implements IDesktopManager {
    private desktops = new Map<DesktopID, Desktop>();
    private lockService: InMemoryLockService;
    private config: RuntimeConfig;

    constructor(config?: RuntimeConfig) {
        this.config = config ?? RUNTIME_DEFAULTS;
        // [RFC-004] 内部服务组合: 锁管理委托给 InMemoryLockService
        this.lockService = new InMemoryLockService(
            (id) => this.desktops.has(id),
            { ttlMs: this.config.lock.ttlMs }
        );
    }

    // ─────────────────────────────────────────────────────────────
    //  IDesktopRepository 实现
    // ─────────────────────────────────────────────────────────────

    async create(desktopId?: DesktopID, context?: IRuntimeContext): Promise<DesktopID> {
        const desktop = new Desktop(desktopId, { runtimeConfig: this.config, context });
        this.desktops.set(desktop.id, desktop);
        return desktop.id;
    }

    async destroy(desktopId: DesktopID): Promise<void> {
        const desktop = this.desktops.get(desktopId);
        if (desktop) {
            await desktop.dispose();
            this.desktops.delete(desktopId);
            // [RFC-004] 清理关联的锁
            this.lockService.clearLock(desktopId);
        }
    }

    has(desktopId: DesktopID): boolean {
        return this.desktops.has(desktopId);
    }

    get(desktopId: DesktopID): IDesktop | undefined {
        return this.desktops.get(desktopId);
    }

    listDesktopIds(): DesktopID[] {
        return Array.from(this.desktops.keys());
    }

    // ─────────────────────────────────────────────────────────────
    //  IDesktopLockService 实现 (Delegate)
    // ─────────────────────────────────────────────────────────────

    acquireLock(desktopId: DesktopID, ownerId: string): void {
        this.lockService.acquireLock(desktopId, ownerId);
    }

    releaseLock(desktopId: DesktopID, ownerId: string): void {
        this.lockService.releaseLock(desktopId, ownerId);
    }

    verifyLock(desktopId: DesktopID, ownerId: string): boolean {
        return this.lockService.verifyLock(desktopId, ownerId);
    }

    refreshLock(desktopId: DesktopID, ownerId: string): void {
        this.lockService.refreshLock(desktopId, ownerId);
    }

    getLockInfo(desktopId: DesktopID): LockInfo | undefined {
        return this.lockService.getLockInfo(desktopId);
    }

    // ─────────────────────────────────────────────────────────────
    //  IAppInstaller 实现
    // ─────────────────────────────────────────────────────────────

    /**
     * [Worker-Only] 安装 App
     */
    async installDynamicWorkerApp(
        desktopId: DesktopID,
        appModulePath: string,
        options?: {
            workerScriptPath?: string;
            appId?: string;
            name?: string;
            config?: import('../../spi/app/app-config.interface.js').AppLaunchConfig;
        }
    ): Promise<AppID> {
        const desktop = this.getDesktopOrThrow(desktopId);
        return desktop.installDynamicWorkerApp(appModulePath, options) as Promise<AppID>;
    }

    // ─────────────────────────────────────────────────────────────
    //  IDesktopStateAccessor 实现
    // ─────────────────────────────────────────────────────────────

    getAppStates(desktopId: DesktopID): AppState[] {
        const desktop = this.desktops.get(desktopId);
        return desktop?.getAppStates() ?? [];
    }

    getDesktopInfo(desktopId: DesktopID): { status: DesktopStatus; createdAt: number } | undefined {
        const desktop = this.desktops.get(desktopId);
        if (!desktop) return undefined;

        return {
            status: desktop.status,
            createdAt: desktop.createdAt
        };
    }

    // ─────────────────────────────────────────────────────────────
    //  IDesktopLifecycleController 实现
    // ─────────────────────────────────────────────────────────────

    async suspend(desktopId: DesktopID): Promise<void> {
        const desktop = this.getDesktopOrThrow(desktopId);
        await desktop.suspend();
    }

    async resume(desktopId: DesktopID): Promise<void> {
        const desktop = this.getDesktopOrThrow(desktopId);
        await desktop.resume();
    }

    async shutdown(): Promise<void> {
        const desktopIds = this.listDesktopIds();
        for (const desktopId of desktopIds) {
            await this.destroy(desktopId);
        }
        this.lockService.clearAll();
    }

    // ─────────────────────────────────────────────────────────────
    //  Internal Helpers
    // ─────────────────────────────────────────────────────────────

    /**
     * 获取 Desktop 或抛出 E_NOT_FOUND 错误
     */
    private getDesktopOrThrow(desktopId: DesktopID): Desktop {
        const desktop = this.desktops.get(desktopId);
        if (!desktop) {
            throw new AOTUIError('DESKTOP_NOT_FOUND', { desktopId });
        }
        return desktop;
    }
}
