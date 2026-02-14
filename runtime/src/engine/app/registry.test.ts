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
    });
});

describe('AOApp Validation', () => {
    describe('validateManifest', () => {
        it('should accept valid manifest', () => {
            const manifest = {
                name: 'my-app',
                displayName: 'My App',
                version: '1.0.0',
                entry: { main: './index.js' }
            };
            expect(validateManifest(manifest)).toBe(true);
        });

        it('should reject missing name', () => {
            const manifest = {
                displayName: 'My App',
                version: '1.0.0',
                entry: { main: './index.js' }
            };
            expect(validateManifest(manifest)).toBe(false);
        });

        it('should reject missing entry', () => {
            const manifest = {
                name: 'my-app',
                displayName: 'My App',
                version: '1.0.0'
            };
            expect(validateManifest(manifest)).toBe(false);
        });
    });

    describe('isValidAppName', () => {
        it('should accept valid names', () => {
            expect(isValidAppName('weather')).toBe(true);
            expect(isValidAppName('todo-list')).toBe(true);
            expect(isValidAppName('my-app-123')).toBe(true);
        });

        it('should reject invalid names', () => {
            expect(isValidAppName('MyApp')).toBe(false); // uppercase
            expect(isValidAppName('my_app')).toBe(false); // underscore
            expect(isValidAppName('-app')).toBe(false); // starts with hyphen
            expect(isValidAppName('app-')).toBe(false); // ends with hyphen
        });
    });
});
