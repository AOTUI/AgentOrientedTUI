/**
 * App Registry
 * 
 * 管理第三方 TUI App 的注册和加载。
 * 
 * 职责:
 * - 从 ~/.agentina/config.json 加载配置
 * - 动态加载 App 模块
 * - 为 Desktop 提供 App 安装服务
 * 
 * @module @aotui/runtime/engine/app-registry
 */

import type { IDesktop, AppID, TUIAppFactory, AOAppManifest } from '../../spi/index.js';
import { isTUIAppFactory, isLegacyFactory, validateManifest, isValidAppName, isKernelConfigFactory } from '../../spi/index.js';
import { AOTUIError } from '../../spi/core/errors.js';
import type { TUIConfig, AppConfigEntry } from './config.js';
import type { AppLaunchConfig } from '../../spi/app/app-config.interface.js';
import { createDefaultConfig, validateConfig } from './config.js';
// [Option C] ESM-compatible imports for file system operations
import * as fs from 'fs';
import * as pathModule from 'path';

// Re-export
export type { TUIConfig, AppConfigEntry } from './config.js';

/**
 * 已加载的 App 信息
 */
export interface LoadedApp {
    /** App 名称 (来自 manifest) */
    name: string;
    /** App 清单 (传统模式) 或 undefined (方案 B kernelConfig 模式) */
    manifest?: AOAppManifest;
    /** 工厂对象 */
    factory: TUIAppFactory;
    /** 来源 */
    source: string;
}

/**
 * AppRegistry 配置
 */
export interface AppRegistryOptions {
    /** 配置文件路径 (默认 ~/.agentina/config.json) */
    configPath?: string;
    /** 是否自动加载 (默认 true) */
    autoLoad?: boolean;
}

/**
 * App Registry
 * 
 * 管理第三方 TUI App 的生命周期
 * 
 * @example
 * ```typescript
 * const registry = new AppRegistry();
 * await registry.loadFromConfig();
 * 
 * // 为 Desktop 安装所有已注册的 App
 * await registry.installAllTo(desktop);
 * ```
 */
export class AppRegistry {
    private apps = new Map<string, LoadedApp>();
    private config: TUIConfig = createDefaultConfig();
    private configPath: string;

    constructor(options?: AppRegistryOptions) {
        this.configPath = options?.configPath ?? this.getDefaultConfigPath();
    }

    // ════════════════════════════════════════════════════════════════
    //  Public API
    // ════════════════════════════════════════════════════════════════

    /**
     * 从配置文件加载所有 App
     */
    async loadFromConfig(): Promise<void> {
        // 读取配置
        this.config = await this.readConfig();

        // 加载每个启用的 App
        for (const [name, entry] of Object.entries(this.config.apps)) {
            if (!entry.enabled) continue;

            // [Hybrid Model] 跳过 system: 协议 - 系统 App 应通过 local: 或 npm: 安装
            if (entry.source.startsWith('system:')) {
                console.warn(
                    `[AppRegistry] Skipped "${name}": 'system:' protocol is deprecated. ` +
                    `Use 'local:' or 'npm:' instead.`
                );
                continue;
            }

            try {
                const factory = await this.loadFactory(entry.source);
                this.apps.set(name, {
                    name,
                    manifest: factory.manifest, // 方案 B 模式下可能是 undefined
                    factory,
                    source: entry.source
                });
                console.log(`[AppRegistry] Loaded app: ${name}`);
            } catch (error) {
                console.error(`[AppRegistry] Failed to load app "${name}":`, error);
            }
        }
    }

    /**
     * 添加 App 到配置
     * 
     * @param source 来源 (npm:xxx, local:xxx, git:xxx)
     * @param options 选项
     */
    async add(source: string, options?: { force?: boolean; alias?: string }): Promise<string> {
        // 加载工厂
        const factory = await this.loadFactory(source);

        // [方案 B] 支持两种模式获取名称
        const name = options?.alias
            ?? factory.manifest?.name
            ?? factory.displayName
            ?? source.split('/').pop() ?? 'unknown';

        // 检查名称冲突
        if (this.config.apps[name] && !options?.force) {
            throw new AOTUIError('OPERATION_DUPLICATE', {
                operationName: name,
                reason: `App already exists from ${this.config.apps[name].source}. Use --force to replace or --as <alias> to install with different name.`
            });
        }

        // 注册到配置
        this.config.apps[name] = {
            source,
            enabled: true,
            installedAt: new Date().toISOString()
        };

        // 添加到内存
        this.apps.set(name, {
            name,
            manifest: factory.manifest,
            factory,
            source
        });

        // 保存配置
        await this.saveConfig();

        console.log(`[AppRegistry] Added app: ${name} from ${source}`);
        return name;
    }

    /**
     * 注册临时 App (不保存到配置文件)
     * 用于开发环境自动发现或运行时动态添加
     */
    async registerTransient(source: string, options?: { alias?: string }): Promise<string> {
        // 加载工厂
        const factory = await this.loadFactory(source);

        // [方案 B] 支持两种模式获取名称
        const name = options?.alias
            ?? factory.manifest?.name
            ?? factory.displayName
            ?? source.split('/').pop() ?? 'unknown';

        // 检查名称冲突 (仅检查内存中)
        if (this.apps.has(name)) {
            console.log(`[AppRegistry] Transient app "${name}" already loaded from ${this.apps.get(name)?.source}`);
            return name;
        }

        // 添加到内存
        this.apps.set(name, {
            name,
            manifest: factory.manifest,
            factory,
            source
        });

        console.log(`[AppRegistry] Registered transient app: ${name} from ${source}`);
        return name;
    }

    /**
     * 移除 App
     */
    async remove(name: string): Promise<void> {
        if (!this.config.apps[name]) {
            throw new AOTUIError('APP_NOT_FOUND', { appId: name });
        }

        delete this.config.apps[name];
        this.apps.delete(name);

        await this.saveConfig();
        console.log(`[AppRegistry] Removed app: ${name}`);
    }

    /**
     * 列出所有已安装的 App
     */
    list(): LoadedApp[] {
        return Array.from(this.apps.values());
    }

    /**
     * 获取已安装的 App
     */
    get(name: string): LoadedApp | undefined {
        return this.apps.get(name);
    }

    /**
     * 检查 App 是否已安装
     */
    has(name: string): boolean {
        return this.apps.has(name);
    }

    /**
     * 启用/禁用 App
     */
    async setEnabled(name: string, enabled: boolean): Promise<void> {
        if (!this.config.apps[name]) {
            throw new AOTUIError('APP_NOT_FOUND', { appId: name });
        }

        this.config.apps[name].enabled = enabled;
        await this.saveConfig();

        console.log(`[AppRegistry] ${enabled ? 'Enabled' : 'Disabled'} app: ${name}`);
    }

    /**
     * [RFC-014] 设置 App 自动启动状态
     * 
     * @param name - App 名称
     * @param autoStart - 是否在 Desktop 创建时自动启动
     */
    async setAutoStart(name: string, autoStart: boolean): Promise<void> {
        if (!this.config.apps[name]) {
            throw new AOTUIError('APP_NOT_FOUND', { appId: name });
        }

        this.config.apps[name].autoStart = autoStart;
        await this.saveConfig();

        console.log(`[AppRegistry] Set autoStart=${autoStart} for: ${name}`);
    }


    /**
     * [Option D] 为 Desktop 安装所有已注册的 App (配置驱动)
     * 
     * 使用 config.json 中的 runtime.workerScript 作为默认 Worker 脚本，
     * 各 App 可以通过 workerScript 字段覆盖。
     * 
     * @param desktop - 目标 Desktop
     * @param options - 可选配置
     * @returns 已安装的 App ID 列表
     */
    async installAll(
        desktop: IDesktop,
        options?: { 
            defaultWorkerScript?: string;
            /** [RFC-025] Dynamic config to inject into all apps (e.g. projectPath) */
            dynamicConfig?: AppLaunchConfig;
        }
    ): Promise<AppID[]> {
        // 获取默认 Worker 脚本路径
        const defaultWorkerScript = options?.defaultWorkerScript
            ?? this.config.runtime?.workerScript;

        // [C1 Fix] defaultWorkerScript is now optional
        // If not provided, Runtime will use its built-in worker-runtime

        const installedIds: AppID[] = [];

        for (const [name, app] of this.apps) {
            const configEntry = this.config.apps[name];
            const dynamicConfig: AppLaunchConfig = { ...(options?.dynamicConfig ?? {}) };
            if (dynamicConfig.AOTUI_APP_KEY === undefined) {
                dynamicConfig.AOTUI_APP_KEY = name;
            }
            if (dynamicConfig.AOTUI_APP_NAME === undefined) {
                dynamicConfig.AOTUI_APP_NAME = name;
            }

            // [RFC-014] 检查 autoStart 配置，默认为 true (向后兼容)
            const autoStart = configEntry?.autoStart ?? true;

            // Worker 模式需要模块路径，从 source 解析
            const modulePath = this.resolveModulePath(app.source);
            if (!modulePath) {
                console.warn(`[AppRegistry] Skipped "${name}": cannot resolve module path from source: ${app.source}`);
                continue;
            }

            // [Option D] 使用 per-app workerScript 或默认值 (可以是 undefined)
            const workerScript = configEntry?.workerScript ?? defaultWorkerScript;

            try {
                // [Fix] Extract promptRole from Factory (KernelConfig or Manifest)
                let promptRole = configEntry?.promptRole;
                if (!promptRole) {
                    if (isKernelConfigFactory(app.factory)) {
                        promptRole = app.factory.kernelConfig.promptRole;
                    } else if (app.manifest?.promptRole) {
                        promptRole = app.manifest.promptRole;
                    }
                }

                const kernelConfig = isKernelConfigFactory(app.factory)
                    ? app.factory.kernelConfig
                    : undefined;

                const whatItIs = configEntry?.whatItIs
                    ?? kernelConfig?.whatItIs
                    ?? configEntry?.description
                    ?? kernelConfig?.description
                    ?? app.manifest?.whatItIs
                    ?? app.manifest?.description;
                const whenToUse = configEntry?.whenToUse
                    ?? kernelConfig?.whenToUse
                    ?? app.manifest?.whenToUse;

                if (autoStart) {
                    // Phase 2: 立即安装并启动
                    const appId = await desktop.installDynamicWorkerApp(
                        modulePath,
                        {
                            workerScriptPath: workerScript,
                            name,
                            description: app.manifest?.description,
                            whatItIs,
                            whenToUse,
                            promptRole, // [Fix] Propagate promptRole
                            config: dynamicConfig // [RFC-025] Inject dynamic config
                        }
                    );
                    installedIds.push(appId as AppID);
                    console.log(`[AppRegistry] Installed "${name}" to Desktop ${desktop.id} (Worker mode)`);
                } else {
                    // Phase 1: 只注册，不启动 (Pending)
                    const appId = await desktop.registerPendingApp({
                        name,
                        description: app.manifest?.description,
                        whatItIs,
                        whenToUse,
                        modulePath,
                        workerScriptPath: workerScript,
                        promptRole // [Fix] Propagate promptRole
                    });
                    installedIds.push(appId as AppID);
                    console.log(`[AppRegistry] Registered "${name}" to Desktop ${desktop.id} (Pending mode)`);
                }
            } catch (error) {
                console.error(`[AppRegistry] Failed to install "${name}":`, error);
            }
        }

        return installedIds;
    }



    /**
     * 解析模块路径
     * 
     * [Fix] Now properly resolves directory paths to their entry points
     * by checking aoapp.json, package.json, or defaulting to index.js
     */
    public resolveModulePath(source: string): string | null {
        // local:/path/to/module -> /path/to/module (with entry point resolution)
        if (source.startsWith('local:')) {
            let localPath = source.slice(6);

            if (!pathModule.isAbsolute(localPath)) {
                localPath = pathModule.resolve(process.cwd(), localPath);
            }

            // If it's a directory, resolve entry point
            if (fs.existsSync(localPath) && fs.statSync(localPath).isDirectory()) {
                // Try to find entry point from aoapp.json or package.json
                const aoappPath = pathModule.join(localPath, 'aoapp.json');
                const pkgPath = pathModule.join(localPath, 'package.json');

                if (fs.existsSync(aoappPath)) {
                    try {
                        const aoapp = JSON.parse(fs.readFileSync(aoappPath, 'utf-8'));
                        if (aoapp.entry?.main) {
                            localPath = pathModule.join(localPath, aoapp.entry.main);
                        }
                    } catch (e) {
                        console.warn(`[AppRegistry] Failed to parse aoapp.json at ${aoappPath}:`, e);
                    }
                }
                
                // Fallback to package.json if no aoapp entry or failed
                if (fs.existsSync(pkgPath) && (!fs.existsSync(aoappPath) || localPath === source.slice(6))) {
                    try {
                        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                        if (pkg.main) {
                            localPath = pathModule.join(localPath, pkg.main);
                        }
                    } catch (e) {
                         console.warn(`[AppRegistry] Failed to parse package.json at ${pkgPath}:`, e);
                    }
                }
                
                // If still directory, default to index.js or dist/index.js check
                if (fs.existsSync(localPath) && fs.statSync(localPath).isDirectory()) {
                     const distIndex = pathModule.join(localPath, 'dist/index.js');
                     const srcIndex = pathModule.join(localPath, 'index.js');
                     if (fs.existsSync(distIndex)) {
                         localPath = distIndex;
                     } else if (fs.existsSync(srcIndex)) {
                         localPath = srcIndex;
                     }
                }
            }

            return localPath;
        }
        // npm:package-name -> 需要进一步解析，暂不支持
        if (source.startsWith('npm:')) {
            throw new AOTUIError('CONFIG_NOT_SUPPORTED', { feature: 'npm sources in Worker mode' });
            return null;
        }
        return null;
    }

    /**
     * 获取配置（用于调试）
     */
    getConfig(): TUIConfig {
        return { ...this.config };
    }

    // ════════════════════════════════════════════════════════════════
    //  Internal Methods
    // ════════════════════════════════════════════════════════════════

    private getDefaultConfigPath(): string {
        const home = process.env.HOME || process.env.USERPROFILE || '~';
        return `${home}/.agentina/config.json`;
    }

    private async readConfig(): Promise<TUIConfig> {
        try {
            const fs = await import('fs/promises');
            const content = await fs.readFile(this.configPath, 'utf-8');
            const config = JSON.parse(content);

            if (!validateConfig(config)) {
                console.warn('[AppRegistry] Invalid config, using defaults');
                return createDefaultConfig();
            }

            return config;
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                // 配置文件不存在，使用默认值
                return createDefaultConfig();
            }
            throw error;
        }
    }

    private async saveConfig(): Promise<void> {
        const fs = await import('fs/promises');
        const path = await import('path');

        // 确保目录存在
        const dir = path.dirname(this.configPath);
        await fs.mkdir(dir, { recursive: true });

        // 写入配置
        const content = JSON.stringify(this.config, null, 2);
        await fs.writeFile(this.configPath, content, 'utf-8');
    }

    private async loadFactory(source: string): Promise<TUIAppFactory> {
        let modulePath: string;

        if (source.startsWith('npm:')) {
            // npm 包: npm:@scope/name 或 npm:name
            modulePath = source.slice(4);
        } else if (source.startsWith('local:')) {
            // 本地路径: local:/path/to/app
            let localPath = source.slice(6);

            const fs = await import('fs');
            const path = await import('path');

            if (!path.isAbsolute(localPath)) {
                localPath = path.resolve(process.cwd(), localPath);
            }

            if (fs.existsSync(localPath) && fs.statSync(localPath).isDirectory()) {
                // Try to find entry point from aoapp.json or package.json
                const aoappPath = path.join(localPath, 'aoapp.json');
                const pkgPath = path.join(localPath, 'package.json');

                if (fs.existsSync(aoappPath)) {
                    try {
                        const aoapp = JSON.parse(fs.readFileSync(aoappPath, 'utf-8'));
                        if (aoapp.entry?.main) {
                            localPath = path.join(localPath, aoapp.entry.main);
                        }
                    } catch (e) {
                        console.warn(`[AppRegistry] Failed to parse aoapp.json at ${aoappPath}:`, e);
                    }
                }
                
                // Fallback to package.json if no aoapp entry or failed
                if (fs.existsSync(pkgPath) && (!fs.existsSync(aoappPath) || localPath === source.slice(6))) {
                    try {
                        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                        if (pkg.main) {
                            localPath = path.join(localPath, pkg.main);
                        }
                    } catch (e) {
                         console.warn(`[AppRegistry] Failed to parse package.json at ${pkgPath}:`, e);
                    }
                }
                
                // If still directory, default to index.js or dist/index.js check
                if (fs.existsSync(localPath) && fs.statSync(localPath).isDirectory()) {
                     const distIndex = path.join(localPath, 'dist/index.js');
                     const srcIndex = path.join(localPath, 'index.js');
                     if (fs.existsSync(distIndex)) {
                         localPath = distIndex;
                     } else if (fs.existsSync(srcIndex)) {
                         localPath = srcIndex;
                     }
                }
            }

            modulePath = localPath;
        } else if (source.startsWith('git:')) {
            throw new AOTUIError('CONFIG_NOT_SUPPORTED', { feature: 'Git source' });
        } else {
            throw new AOTUIError('CONFIG_INVALID', { reason: `Unknown source format: ${source}` });
        }

        // 动态导入模块
        const module = await import(modulePath);

        const candidates = [
            module.factory,
            module.default?.factory,
            module.default,
            ...Object.values(module)
        ];

        const factory = candidates.find((candidate) => isTUIAppFactory(candidate));

        if (!factory) {
            throw new AOTUIError('APP_INVALID_EXPORT', { modulePath });
        }

        if (isLegacyFactory(factory) && !validateManifest(factory.manifest)) {
            throw new AOTUIError('APP_INVALID_MANIFEST', { modulePath });
        }

        return factory;
    }
}

// Re-export factory interface
export type { TUIAppFactory, AOAppManifest } from '../../spi/index.js';
export { isTUIAppFactory, validateManifest, isValidAppName } from '../../spi/index.js';
