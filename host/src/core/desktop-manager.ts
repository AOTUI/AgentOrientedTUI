/**
 * Desktop Manager
 * 
 * Manages Desktop lifecycle using SDK createRuntime().
 * 
 * [RFC-021] TUI-chat has been removed. Desktop now:
 * - Only hosts TUI tool applications (third-party apps via AppRegistry)
 * - Chat/conversation is handled by ConversationManager (not a TUI App)
 * 
 * [SDK 标准化] 只使用 Runtime 的公开 API:
 * - createRuntime() - SDK Facade
 * - Kernel (IKernel) - 通过 createRuntime 获得
 * - 类型从 SPI 层导入
 */
import {
    // SDK Facade
    createRuntime,
    // SPI Types
    type DesktopID,
    type IDesktop,
    type IKernel,
    type AppLaunchConfig,
    // Third-party Apps
    AppRegistry,
    installNpmPackage,
    parseInstallSource,
    resolveCatalog,
    resolveCatalogOptionsFromConfig,
    searchCatalog,
    type AppConfigEntry,
    type CatalogSearchResult,
    type ResolvedCatalog
} from '@aotui/runtime';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { Config } from '../config/config.js';

export type { DesktopID };

export interface DesktopInfo {
    desktopId: DesktopID;
    // [RFC-021] appId is now optional since we may not have any apps installed
    appId?: string;
    thirdPartyAppCount: number;
}

export interface InstallAppOptions {
    force?: boolean;
    alias?: string;
    autoStart?: boolean;
    enabled?: boolean;
}

export interface InstallAppResult {
    name: string;
    source: string;
    originalSource: string;
    distributionType: 'local' | 'npm';
}

export interface CatalogSearchEntry extends CatalogSearchResult {
    installed: boolean;
    installedName: string | null;
}

export interface CatalogSearchResponse {
    source: ResolvedCatalog['source'];
    remoteUrl?: string;
    cachedAt?: string;
    signatureVerified: boolean;
    warnings: string[];
    apps: CatalogSearchEntry[];
}

export class DesktopManager {
    private kernel: IKernel;
    private appRegistry: AppRegistry;
    private desktopAppMap = new Map<DesktopID, string[]>(); // desktopId -> installed app IDs

    constructor() {
        // [SDK 标准化] 使用 createRuntime() 代替手动实例化 Engine 组件
        this.kernel = createRuntime();

        // [Third-Party Apps] 初始化 AppRegistry
        this.appRegistry = new AppRegistry();
    }

    /**
     * 异步初始化 (加载第三方 App)
     * 
     * 必须在使用 createDesktop 之前调用此方法
     */
    async initialize(): Promise<void> {
        // 加载配置中的第三方 App
        await this.appRegistry.loadFromConfig();

        // [Dev Experience] Auto-discover system-todo in development environment
        try {
            const fs = await import('fs');
            const path = await import('path');
            const devTodoPath = path.resolve(process.cwd(), '../system-todo');
            
            if (fs.existsSync(devTodoPath) && fs.statSync(devTodoPath).isDirectory()) {
                console.log('[DesktopManager] Found system-todo in dev environment, registering...');
                await this.appRegistry.registerTransient(`local:${devTodoPath}`);
            }
        } catch (e) {
            console.warn('[DesktopManager] Failed to auto-register system-todo:', e);
        }

        console.log(`[DesktopManager] Initialized with ${this.appRegistry.list().length} third-party apps`);
    }

    /**
     * Get the Kernel instance
     * 
     * [SDK 标准化] 返回 IKernel 接口而非具体实现
     */
    getKernel(): IKernel {
        return this.kernel;
    }

    /**
     * Create a new Desktop
     * 
     * [RFC-021] ChatApp has been removed. Desktop now only hosts third-party TUI apps.
     * Chat/conversation is handled by ConversationManager in the Product Layer.
     * 
     * [Option D] Third-party apps are installed via AppRegistry.installAll()
     * using config-driven workerScript from ~/.agentina/config.json
     * 
     * @param desktopId - Optional: specify a custom Desktop ID (for historical topics)
     * @param config - Optional: runtime config to inject into apps (e.g. projectPath)
     */
    async createDesktop(desktopId?: DesktopID, config?: Record<string, any>): Promise<DesktopInfo> {
        const runtimeDataDir = process.env.AOTUI_DATA_DIR
            || path.join(os.homedir(), '.aotui', 'data');

        const runtimeContext = {
            env: {
                AOTUI_DATA_DIR: runtimeDataDir,
                AOTUI_TOPIC_ID: desktopId ?? '',
            }
        };

        const actualDesktopId = await this.kernel.createDesktop(desktopId, runtimeContext);
        const installedAppIds: string[] = [];

        // [RFC-021] No more ChatApp installation
        // Desktop is now a pure TUI container for tool applications

        // Install third-party apps via AppRegistry (if any configured)
        try {
            const desktop = this.kernel.getDesktop(actualDesktopId);
            const thirdPartyIds = await this.appRegistry.installAll(desktop, {
                dynamicConfig: config
            } as any);
            installedAppIds.push(...thirdPartyIds);
            console.log(`[DesktopManager] Created Desktop ${actualDesktopId} with ${thirdPartyIds.length} third-party apps`);
        } catch (error) {
            console.error('[DesktopManager] Failed to install third-party apps:', error);
        }

        this.desktopAppMap.set(actualDesktopId, installedAppIds);

        return {
            desktopId: actualDesktopId,
            appId: installedAppIds[0],  // First app ID for backward compatibility
            thirdPartyAppCount: installedAppIds.length
        };
    }

    /**
     * Get Desktop by ID
     */
    getDesktop(desktopId: DesktopID): IDesktop | null {
        try {
            return this.kernel.getDesktop(desktopId);
        } catch {
            return null;
        }
    }

    /**
     * Get app IDs for a Desktop
     */
    getAppIds(desktopId: DesktopID): string[] {
        return this.desktopAppMap.get(desktopId) || [];
    }

    /**
     * Get first app ID for backward compatibility
     */
    getAppId(desktopId: DesktopID): string | undefined {
        const ids = this.desktopAppMap.get(desktopId);
        return ids?.[0];
    }

    /**
     * Delete Desktop
     */
    async deleteDesktop(desktopId: DesktopID): Promise<boolean> {
        try {
            await this.kernel.destroyDesktop(desktopId);
            this.desktopAppMap.delete(desktopId);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get snapshot for a Desktop
     * 
     * [SDK 标准化] 使用 kernel.acquireSnapshot() 替代 snapshotBuilder
     */
    async getSnapshot(desktopId: DesktopID): Promise<string | null> {
        try {
            const snapshot = await this.kernel.acquireSnapshot(desktopId);
            return snapshot.markup;
        } catch {
            return null;
        }
    }

    /**
     * Get all Desktop IDs
     */
    getAllDesktopIds(): DesktopID[] {
        return Array.from(this.desktopAppMap.keys());
    }

    /**
     * Get third-party apps configuration (module paths)
     * Used by SessionManager to configure AgentSession
     */
    getThirdPartyAppsConfig(): { modulePath: string }[] {
        return this.appRegistry.list()
            .map(app => ({
                modulePath: this.appRegistry.resolveModulePath(app.source)
            }))
            .filter(app => app.modulePath !== null) as { modulePath: string }[];
    }

    async getAppsConfig(): Promise<Record<string, AppConfigEntry>> {
        return { ...(await Config.getAppsConfig()) };
    }

    async getAppDetail(name: string): Promise<AppConfigEntry> {
        const app = (await this.getAppsConfig())[name];
        if (!app) {
            throw new Error(`App "${name}" not found`);
        }
        return app;
    }

    async searchAppsCatalog(query?: string): Promise<CatalogSearchResponse> {
        const installedApps = await this.getAppsConfig();
        const installedEntries = Object.entries(installedApps);
        const resolvedCatalog = await resolveCatalog(resolveCatalogOptionsFromConfig(this.appRegistry.getConfig().catalog));

        const apps = searchCatalog(query, resolvedCatalog.catalog).map((entry) => {
            const installedMatch = installedEntries.find(([, app]) => (
                app.distribution?.packageName === entry.packageName
                || app.originalSource === `npm:${entry.packageName}`
                || app.originalSource?.startsWith(`npm:${entry.packageName}@`)
            ));

            return {
                ...entry,
                installed: Boolean(installedMatch),
                installedName: installedMatch?.[0] ?? null
            };
        });

        return {
            source: resolvedCatalog.source,
            remoteUrl: resolvedCatalog.remoteUrl,
            cachedAt: resolvedCatalog.cachedAt,
            signatureVerified: resolvedCatalog.signatureVerified,
            warnings: resolvedCatalog.warnings,
            apps
        };
    }

    async installApp(sourceInput: string, options?: InstallAppOptions): Promise<InstallAppResult> {
        const resolved = parseInstallSource(sourceInput);

        if (resolved.kind === 'local') {
            if (!fs.existsSync(resolved.absolutePath)) {
                throw new Error(`Local path does not exist: ${resolved.absolutePath}`);
            }

            const name = await this.appRegistry.add(resolved.source, {
                force: options?.force,
                alias: options?.alias,
                autoStart: options?.autoStart,
                enabled: options?.enabled,
                originalSource: resolved.source,
                distribution: {
                    type: 'local',
                    installedPath: resolved.absolutePath,
                    installedAt: new Date().toISOString()
                }
            });

            return {
                name,
                source: resolved.source,
                originalSource: resolved.source,
                distributionType: 'local'
            };
        }

        const installResult = await installNpmPackage(resolved.packageSpec, {
            forceReinstall: options?.force
        });

        const name = await this.appRegistry.add(installResult.localSource, {
            force: options?.force,
            alias: options?.alias,
            autoStart: options?.autoStart,
            enabled: options?.enabled,
            originalSource: resolved.source,
            distribution: {
                type: 'npm',
                packageName: installResult.packageName,
                requested: installResult.packageSpec,
                resolvedVersion: installResult.resolvedVersion ?? undefined,
                installedPath: installResult.installedPath,
                installedAt: new Date().toISOString()
            }
        });

        return {
            name,
            source: installResult.localSource,
            originalSource: resolved.source,
            distributionType: 'npm'
        };
    }

    async updateApp(name: string): Promise<InstallAppResult> {
        const current = await this.getAppDetail(name);
        const originalSource = current.originalSource;
        if (!originalSource || !originalSource.startsWith('npm:')) {
            throw new Error(`App "${name}" is not installed from npm and cannot be updated yet`);
        }

        return this.installApp(originalSource, {
            force: true,
            alias: name,
            autoStart: current.autoStart,
            enabled: current.enabled
        });
    }

    async removeApp(name: string): Promise<void> {
        await this.appRegistry.remove(name);
    }

    async setAppEnabled(name: string, enabled: boolean): Promise<void> {
        await this.appRegistry.setEnabled(name, enabled);
    }
}

// Singleton instance
export const desktopManager = new DesktopManager();

// Initialize immediately (fire-and-forget for backward compatibility)
// Server should await this before processing requests
export const desktopManagerReady = desktopManager.initialize();
