/**
 * AppRegistry Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppRegistry, validateManifest, isValidAppName } from './index.js';
import type { TUIAppFactory } from '../../spi/app-factory.interface.js';
import type { IAOTUIApp } from '../../spi/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock factory
function createMockFactory(name: string): TUIAppFactory {
    return {
        manifest: {
            name,
            displayName: `${name} App`,
            version: '1.0.0',
            entry: { main: './index.js' }
        },
        create: () => ({
            id: undefined,
            name,
            onOpen: vi.fn(),
            onClose: vi.fn(),
            onOperation: vi.fn().mockResolvedValue({ success: true })
        } as IAOTUIApp)
    };
}

describe('AppRegistry', () => {
    let tempDir: string;
    let configPath: string;

    beforeEach(async () => {
        // 创建临时目录
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tui-test-'));
        configPath = path.join(tempDir, 'config.json');
    });

    afterEach(async () => {
        // 清理临时目录
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe('Configuration', () => {
        it('should create default config if not exists', async () => {
            const registry = new AppRegistry({ configPath });
            await registry.loadFromConfig();

            const config = registry.getConfig();
            // [Option D] Default config version is now 2
            expect(config.version).toBe(2);
            expect(config.apps).toEqual({});
        });

        it('should load existing config', async () => {
            // 写入测试配置
            const testConfig = {
                version: 1,
                apps: {
                    'test-app': {
                        source: 'npm:@test/app',
                        enabled: false
                    }
                }
            };
            await fs.mkdir(path.dirname(configPath), { recursive: true });
            await fs.writeFile(configPath, JSON.stringify(testConfig));

            const registry = new AppRegistry({ configPath });
            await registry.loadFromConfig();

            const config = registry.getConfig();
            expect(config.apps['test-app']).toBeDefined();
            expect(config.apps['test-app'].enabled).toBe(false);
        });
    });

    describe('App Management', () => {
        it('should list installed apps', async () => {
            const registry = new AppRegistry({ configPath });
            await registry.loadFromConfig();

            expect(registry.list()).toHaveLength(0);
        });

        it('should check if app exists', async () => {
            const registry = new AppRegistry({ configPath });
            await registry.loadFromConfig();

            expect(registry.has('non-existent')).toBe(false);
        });

        it('should use canonical app_name from kernel metadata when manifest identity is missing', async () => {
            const registry = new AppRegistry({ configPath });
            await registry.loadFromConfig();

            const factoryWithoutManifestName = {
                kernelConfig: {
                    appName: 'system_ide',
                    name: 'system_ide',
                    component: {},
                },
                manifest: undefined,
            } as unknown as TUIAppFactory;

            // @ts-ignore
            registry.loadFactory = vi.fn().mockResolvedValue(factoryWithoutManifestName);

            const name = await registry.add('local:/tmp/cache/node_modules/@agentina/aotui-ide');
            expect(name).toBe('system_ide');
            expect(registry.getConfig().apps['system_ide']).toBeDefined();
        });

        it('should delete managed npm install artifacts on remove', async () => {
            const registry = new AppRegistry({ configPath });
            await registry.loadFromConfig();

            const installRoot = path.join(tempDir, '.agentina', 'apps', 'npm', 'scope-agentina__aotui-ide', 'latest');
            const installedPath = path.join(installRoot, 'node_modules', '@agentina', 'aotui-ide');
            await fs.mkdir(installedPath, { recursive: true });
            await fs.writeFile(path.join(installRoot, 'package.json'), JSON.stringify({ name: 'agentina-app-cache', private: true }));

            // @ts-ignore
            registry['config'].apps['aotui-ide'] = {
                source: `local:${installedPath}`,
                enabled: true,
                originalSource: 'npm:@agentina/aotui-ide',
                distribution: {
                    type: 'npm',
                    packageName: '@agentina/aotui-ide',
                    installedPath,
                }
            };
            // @ts-ignore
            registry['apps'].set('aotui-ide', {
                name: 'aotui-ide',
                source: `local:${installedPath}`,
                factory: createMockFactory('aotui-ide'),
                manifest: createMockFactory('aotui-ide').manifest,
            });
            // @ts-ignore
            registry.getDefaultNpmCacheRoot = vi.fn().mockReturnValue(path.join(tempDir, '.agentina', 'apps', 'npm'));

            await registry.remove('aotui-ide');

            await expect(fs.stat(installRoot)).rejects.toThrow();
            expect(registry.getConfig().apps['aotui-ide']).toBeUndefined();
        });

        it('should not delete npm artifacts outside managed root on remove', async () => {
            const registry = new AppRegistry({ configPath });
            await registry.loadFromConfig();

            const installRoot = path.join(tempDir, 'external-cache', 'latest');
            const installedPath = path.join(installRoot, 'node_modules', '@agentina', 'aotui-ide');
            await fs.mkdir(installedPath, { recursive: true });

            // @ts-ignore
            registry['config'].apps['aotui-ide'] = {
                source: `local:${installedPath}`,
                enabled: true,
                originalSource: 'npm:@agentina/aotui-ide',
                distribution: {
                    type: 'npm',
                    packageName: '@agentina/aotui-ide',
                    installRoot,
                    installedPath,
                }
            };
            // @ts-ignore
            registry['apps'].set('aotui-ide', {
                name: 'aotui-ide',
                source: `local:${installedPath}`,
                factory: createMockFactory('aotui-ide'),
                manifest: createMockFactory('aotui-ide').manifest,
            });
            // @ts-ignore
            registry.getDefaultNpmCacheRoot = vi.fn().mockReturnValue(path.join(tempDir, '.agentina', 'apps', 'npm'));

            await registry.remove('aotui-ide');

            expect(await fs.stat(installRoot)).toBeDefined();
        });
    });

    describe('Manifest Validation', () => {
        it('should validate complete manifest', () => {
            const factory = createMockFactory('test');
            expect(factory.manifest.name).toBe('test');
            expect(factory.manifest.displayName).toBe('test App');
            expect(factory.manifest.version).toBe('1.0.0');
        });
    });

    describe('Installation (AppRegistry)', () => {
        let registry: AppRegistry;
        let mockDesktop: any;

        beforeEach(async () => {
            // Create mock desktop
            mockDesktop = {
                id: 'dt_test',
                installDynamicWorkerApp: vi.fn().mockResolvedValue('app_worker'),
                registerPendingApp: vi.fn().mockResolvedValue('app_pending'),
                logSystem: vi.fn()
            };

            registry = new AppRegistry({ configPath });
            await registry.loadFromConfig();

            // Mock resolveModulePath to avoid file system dependency
            // @ts-ignore
            registry.resolveModulePath = vi.fn().mockReturnValue('/mock/module/path');
        });

        it('should install autoStart=true apps immediately', async () => {
            // Setup: Add app with autoStart=true
            // @ts-ignore
            registry['apps'].set('worker-app', {
                name: 'worker-app',
                source: 'local:/mock',
                // @ts-ignore
                factory: createMockFactory('worker-app'),
                manifest: { name: 'worker-app', description: 'Worker App' } as any
            });
            // config defaults to autoStart=true if not present, or we can explicit set it
            registry['config'].apps['worker-app'] = {
                source: 'local:/mock',
                enabled: true,
                autoStart: true
            };

            await registry.installAll(mockDesktop);

            expect(mockDesktop.installDynamicWorkerApp).toHaveBeenCalledWith('/mock/module/path', expect.objectContaining({
                name: 'worker-app',
                description: 'Worker App'
            }));
            expect(mockDesktop.registerPendingApp).not.toHaveBeenCalled();
        });

        it('should inject only canonical AOTUI_APP_NAME into launch config', async () => {
            registry['apps'].set('worker-app', {
                name: 'worker-app',
                source: 'local:/mock',
                // @ts-ignore
                factory: createMockFactory('worker-app'),
                manifest: { name: 'worker-app', description: 'Worker App' } as any
            });
            registry['config'].apps['worker-app'] = {
                source: 'local:/mock',
                enabled: true,
                autoStart: true
            };

            await registry.installAll(mockDesktop);

            expect(mockDesktop.installDynamicWorkerApp).toHaveBeenCalledWith(
                '/mock/module/path',
                expect.objectContaining({
                    config: expect.objectContaining({
                        AOTUI_APP_NAME: 'worker-app',
                    }),
                })
            );

            const installOptions = mockDesktop.installDynamicWorkerApp.mock.calls[0]?.[1];
            expect(installOptions?.config?.AOTUI_APP_KEY).toBeUndefined();
        });

        it('should register autoStart=false apps as pending', async () => {
            // Setup: Add app with autoStart=false
            // @ts-ignore
            registry['apps'].set('pending-app', {
                name: 'pending-app',
                source: 'local:/mock',
                // @ts-ignore
                factory: createMockFactory('pending-app'),
                manifest: { name: 'pending-app', description: 'Pending App' } as any
            });
            registry['config'].apps['pending-app'] = {
                source: 'local:/mock',
                enabled: true,
                autoStart: false
            };

            await registry.installAll(mockDesktop);

            expect(mockDesktop.registerPendingApp).toHaveBeenCalledWith(expect.objectContaining({
                name: 'pending-app',
                description: 'Pending App',
                modulePath: '/mock/module/path'
            }));
            expect(mockDesktop.installDynamicWorkerApp).not.toHaveBeenCalled();
        });

        it('should install only selected explicit entries without consulting config apps', async () => {
            const configDrivenFactory = createMockFactory('config-app');
            const explicitFactory = createMockFactory('explicit-app');

            registry['config'].apps['config-app'] = {
                source: 'local:/config-app',
                enabled: true,
                autoStart: true,
            };
            registry['entryConfigs'].set('config-app', { ...registry['config'].apps['config-app'] });
            registry['apps'].set('config-app', {
                name: 'config-app',
                source: 'local:/config-app',
                factory: configDrivenFactory,
                manifest: configDrivenFactory.manifest,
            });

            registry['apps'].clear();
            registry['entryConfigs'].clear();
            registry['loadFactory'] = vi.fn().mockResolvedValue(explicitFactory);

            await registry.loadFromEntries([
                {
                    name: 'explicit-app',
                    source: 'local:/explicit-app',
                    enabled: true,
                    autoStart: true,
                }
            ]);

            expect(registry.has('config-app')).toBe(false);
            expect(registry.has('explicit-app')).toBe(true);

            await registry.installSelected(mockDesktop, ['explicit-app']);

            expect(mockDesktop.installDynamicWorkerApp).toHaveBeenCalledTimes(1);
            expect(mockDesktop.installDynamicWorkerApp).toHaveBeenCalledWith(
                '/mock/module/path',
                expect.objectContaining({
                    name: 'explicit-app'
                })
            );
        });

        it('should keep non-selected explicit entries out of installation', async () => {
            const alphaFactory = createMockFactory('alpha-app');
            const betaFactory = createMockFactory('beta-app');

            registry['loadFactory'] = vi.fn()
                .mockResolvedValueOnce(alphaFactory)
                .mockResolvedValueOnce(betaFactory);

            await registry.loadFromEntries([
                {
                    name: 'alpha-app',
                    source: 'local:/alpha-app',
                    enabled: true,
                    autoStart: true,
                },
                {
                    name: 'beta-app',
                    source: 'local:/beta-app',
                    enabled: true,
                    autoStart: true,
                }
            ]);

            await registry.installSelected(mockDesktop, ['beta-app']);

            expect(mockDesktop.installDynamicWorkerApp).toHaveBeenCalledTimes(1);
            expect(mockDesktop.installDynamicWorkerApp).toHaveBeenCalledWith(
                '/mock/module/path',
                expect.objectContaining({
                    name: 'beta-app'
                })
            );
        });
    });
});

describe('AOApp Validation', () => {
    describe('validateManifest', () => {
        it('should accept valid manifest', () => {
            const manifest = {
                app_name: 'my_app',
                version: '1.0.0',
                entry: { main: './index.js' }
            };
            expect(validateManifest(manifest)).toBe(true);
        });

        it('should reject missing app_name', () => {
            const manifest = {
                version: '1.0.0',
                entry: { main: './index.js' }
            };
            expect(validateManifest(manifest)).toBe(false);
        });

        it('should reject missing entry', () => {
            const manifest = {
                app_name: 'my_app',
                version: '1.0.0'
            };
            expect(validateManifest(manifest)).toBe(false);
        });
    });

    describe('isValidAppName', () => {
        it('should accept valid names', () => {
            expect(isValidAppName('weather')).toBe(true);
            expect(isValidAppName('todo_list')).toBe(true);
            expect(isValidAppName('my_app_123')).toBe(true);
        });

        it('should reject invalid names', () => {
            expect(isValidAppName('MyApp')).toBe(false); // uppercase
            expect(isValidAppName('my-app')).toBe(false); // hyphen
            expect(isValidAppName('-app')).toBe(false); // starts with hyphen
            expect(isValidAppName('app-')).toBe(false); // ends with hyphen
        });
    });
});
