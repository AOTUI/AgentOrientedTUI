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
import * as os from 'os';

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

export interface AppRegistryEntry extends AppConfigEntry {
    /** Registry key used to reference the app */
    name: string;
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
    private entryConfigs = new Map<string, AppConfigEntry>();
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
        this.apps.clear();
        this.entryConfigs.clear();

        // 加载每个启用的 App
        for (const [name, entry] of Object.entries(this.config.apps)) {
            await this.loadEntry(name, entry);
        }
    }

    /**
     * 从显式 entries 加载 App，不读取 config.json
     *
     * 适用于 Host-owned capability control plane。
     */
    async loadFromEntries(
        entries: AppRegistryEntry[],
        options?: {
            replace?: boolean;
        }
    ): Promise<void> {
        if (options?.replace !== false) {
            this.apps.clear();
            this.entryConfigs.clear();
        }

        for (const entry of entries) {
            const { name, ...appEntry } = entry;
            await this.loadEntry(name, appEntry);
        }
    }

    /**
     * 添加 App 到配置
     * 
     * @param source 来源 (npm:xxx, local:xxx, git:xxx)
     * @param options 选项
     */
    async add(
        source: string,
        options?: {
            force?: boolean;
            alias?: string;
            enabled?: boolean;
            autoStart?: boolean;
            originalSource?: string;
            distribution?: AppConfigEntry['distribution'];
        }
    ): Promise<string> {
        // 加载工厂
        const factory = await this.loadFactory(source);

        const name = this.resolveRegistrationName(source, factory);

        // 检查名称冲突
        if (this.config.apps[name] && !options?.force) {
            throw new AOTUIError('OPERATION_DUPLICATE', {
                operationName: name,
                reason: `App already exists from ${this.config.apps[name].source}. Use --force to replace it.`
            });
        }

        // 注册到配置
        this.config.apps[name] = {
            source,
            enabled: options?.enabled ?? true,
            autoStart: options?.autoStart,
            installedAt: new Date().toISOString(),
            originalSource: options?.originalSource,
            distribution: options?.distribution
        };
        this.entryConfigs.set(name, { ...this.config.apps[name] });

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

        const name = this.resolveRegistrationName(source, factory);

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
        this.entryConfigs.set(name, {
            source,
            enabled: true,
            autoStart: true,
        });

        console.log(`[AppRegistry] Registered transient app: ${name} from ${source}`);
        return name;
    }

    /**
     * 移除 App
     */
    async remove(name: string): Promise<void> {
        const entry = this.entryConfigs.get(name) ?? this.config.apps[name];
        if (!entry) {
            throw new AOTUIError('APP_NOT_FOUND', { appId: name });
        }

        await this.cleanupInstalledArtifacts(entry);
        const shouldPersistRemoval = this.config.apps[name] !== undefined;
        delete this.config.apps[name];
        this.apps.delete(name);
        this.entryConfigs.delete(name);

        if (shouldPersistRemoval) {
            await this.saveConfig();
        }
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

    getEntry(name: string): AppConfigEntry | undefined {
        const entry = this.entryConfigs.get(name) ?? this.config.apps[name];
        return entry ? { ...entry } : undefined;
    }

    getEntries(): Record<string, AppConfigEntry> {
        return Object.fromEntries(
            Array.from(this.entryConfigs.entries()).map(([name, entry]) => [name, { ...entry }])
        );
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
        const entry = this.entryConfigs.get(name) ?? this.config.apps[name];
        if (!entry) {
            throw new AOTUIError('APP_NOT_FOUND', { appId: name });
        }

        this.entryConfigs.set(name, { ...entry, enabled });
        if (this.config.apps[name]) {
            this.config.apps[name].enabled = enabled;
            await this.saveConfig();
        }

        console.log(`[AppRegistry] ${enabled ? 'Enabled' : 'Disabled'} app: ${name}`);
    }

    /**
     * [RFC-014] 设置 App 自动启动状态
     * 
     * @param name - App 名称
     * @param autoStart - 是否在 Desktop 创建时自动启动
     */
    async setAutoStart(name: string, autoStart: boolean): Promise<void> {
        const entry = this.entryConfigs.get(name);
        if (!entry) {
            throw new AOTUIError('APP_NOT_FOUND', { appId: name });
        }

        this.entryConfigs.set(name, { ...entry, autoStart });
        if (this.config.apps[name]) {
            this.config.apps[name].autoStart = autoStart;
            await this.saveConfig();
        }

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

        return this.installEntries(desktop, Array.from(this.apps.keys()), {
            defaultWorkerScript,
            dynamicConfig: options?.dynamicConfig,
        });
    }

    async installSelected(
        desktop: IDesktop,
        names: string[],
        options?: {
            defaultWorkerScript?: string;
            dynamicConfig?: AppLaunchConfig;
        }
    ): Promise<AppID[]> {
        const defaultWorkerScript = options?.defaultWorkerScript
            ?? this.config.runtime?.workerScript;

        return this.installEntries(desktop, names, {
            defaultWorkerScript,
            dynamicConfig: options?.dynamicConfig,
        });
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

    private async loadEntry(name: string, entry: AppConfigEntry): Promise<void> {
        this.entryConfigs.set(name, { ...entry });

        if (!entry.enabled) {
            return;
        }

        // [Hybrid Model] 跳过 system: 协议 - 系统 App 应通过 local: 或 npm: 安装
        if (entry.source.startsWith('system:')) {
            console.warn(
                `[AppRegistry] Skipped "${name}": 'system:' protocol is deprecated. ` +
                `Use 'local:' or 'npm:' instead.`
            );
            return;
        }

        try {
            const factory = await this.loadFactory(entry.source);
            this.apps.set(name, {
                name,
                manifest: factory.manifest,
                factory,
                source: entry.source
            });
            console.log(`[AppRegistry] Loaded app: ${name}`);
        } catch (error) {
            console.error(`[AppRegistry] Failed to load app "${name}":`, error);
        }
    }

    private async installEntries(
        desktop: IDesktop,
        names: string[],
        options: {
            defaultWorkerScript?: string;
            dynamicConfig?: AppLaunchConfig;
        }
    ): Promise<AppID[]> {
        const installedIds: AppID[] = [];

        for (const name of names) {
            const app = this.apps.get(name);
            if (!app) {
                throw new AOTUIError('APP_NOT_FOUND', { appId: name });
            }

            const configEntry = this.entryConfigs.get(name) ?? this.config.apps[name];
            const dynamicConfig: AppLaunchConfig = { ...(options.dynamicConfig ?? {}) };
            if (dynamicConfig.AOTUI_APP_NAME === undefined) {
                dynamicConfig.AOTUI_APP_NAME = name;
            }

            const autoStart = configEntry?.autoStart ?? true;
            const modulePath = this.resolveModulePath(app.source);
            if (!modulePath) {
                console.warn(`[AppRegistry] Skipped "${name}": cannot resolve module path from source: ${app.source}`);
                continue;
            }

            const workerScript = configEntry?.workerScript ?? options.defaultWorkerScript;

            try {
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
                    const appId = await desktop.installDynamicWorkerApp(
                        modulePath,
                        {
                            workerScriptPath: workerScript,
                            name,
                            description: app.manifest?.description,
                            whatItIs,
                            whenToUse,
                            promptRole,
                            config: dynamicConfig
                        }
                    );
                    installedIds.push(appId as AppID);
                    console.log(`[AppRegistry] Installed "${name}" to Desktop ${desktop.id} (Worker mode)`);
                } else {
                    const appId = await desktop.registerPendingApp({
                        name,
                        description: app.manifest?.description,
                        whatItIs,
                        whenToUse,
                        modulePath,
                        workerScriptPath: workerScript,
                        promptRole
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

    private async cleanupInstalledArtifacts(entry: AppConfigEntry): Promise<void> {
        if (entry.distribution?.type !== 'npm') {
            return;
        }

        const installRoot = this.resolveNpmInstallRoot(entry);
        if (!installRoot) {
            return;
        }

        const allowedRoot = this.getDefaultNpmCacheRoot();
        const normalizedAllowedRoot = pathModule.resolve(allowedRoot);
        const normalizedInstallRoot = pathModule.resolve(installRoot);

        if (
            normalizedInstallRoot !== normalizedAllowedRoot &&
            !normalizedInstallRoot.startsWith(`${normalizedAllowedRoot}${pathModule.sep}`)
        ) {
            console.warn(`[AppRegistry] Skip deleting npm cache outside managed root: ${normalizedInstallRoot}`);
            return;
        }

        const fsPromises = await import('fs/promises');
        await fsPromises.rm(normalizedInstallRoot, { recursive: true, force: true });
        await this.pruneEmptyParentDirs(pathModule.dirname(normalizedInstallRoot), normalizedAllowedRoot);
    }

    private resolveRegistrationName(source: string, factory: TUIAppFactory): string {
        if (isKernelConfigFactory(factory) && factory.kernelConfig.appName) {
            return factory.kernelConfig.appName;
        }

        if (factory.manifest?.app_name) {
            return factory.manifest.app_name;
        }

        if (factory.manifest?.name) {
            return factory.manifest.name;
        }

        throw new AOTUIError('CONFIG_INVALID', {
            reason: `App source ${source} does not expose a canonical app_name`
        });
    }

    private resolveNpmInstallRoot(entry: AppConfigEntry): string | null {
        const explicitInstallRoot = entry.distribution?.installRoot;
        if (typeof explicitInstallRoot === 'string' && explicitInstallRoot.trim()) {
            return explicitInstallRoot;
        }

        const installedPath = entry.distribution?.installedPath;
        if (typeof installedPath !== 'string' || !installedPath.trim()) {
            return null;
        }

        const packageName = entry.distribution?.packageName;
        if (typeof packageName === 'string' && packageName.trim()) {
            const nodeModulesSuffix = pathModule.join('node_modules', ...packageName.split('/'));
            const normalizedInstalledPath = pathModule.normalize(installedPath);
            if (normalizedInstalledPath.endsWith(nodeModulesSuffix)) {
                return normalizedInstalledPath.slice(0, normalizedInstalledPath.length - nodeModulesSuffix.length - 1);
            }
        }

        const segments = pathModule.normalize(installedPath).split(pathModule.sep);
        const nodeModulesIndex = segments.lastIndexOf('node_modules');
        if (nodeModulesIndex > 0) {
            return segments.slice(0, nodeModulesIndex).join(pathModule.sep) || pathModule.sep;
        }

        return null;
    }

    private getDefaultNpmCacheRoot(): string {
        return pathModule.join(os.homedir(), '.agentina', 'apps', 'npm');
    }

    private async pruneEmptyParentDirs(startDir: string, stopDir: string): Promise<void> {
        const fsPromises = await import('fs/promises');
        let current = pathModule.resolve(startDir);
        const normalizedStop = pathModule.resolve(stopDir);

        while (current.startsWith(`${normalizedStop}${pathModule.sep}`)) {
            try {
                const entries = await fsPromises.readdir(current);
                if (entries.length > 0) {
                    break;
                }
                await fsPromises.rmdir(current);
                current = pathModule.dirname(current);
            } catch {
                break;
            }
        }
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
