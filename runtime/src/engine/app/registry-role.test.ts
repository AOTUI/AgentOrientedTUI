/**
 * AppRegistry Role Propagation Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppRegistry } from './index.js';
import type { TUIAppFactory } from '../../spi/app-factory.interface.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock factory helper
function createMockFactory(name: string, role?: 'user' | 'assistant'): TUIAppFactory {
    return {
        manifest: {
            name,
            displayName: `${name} App`,
            version: '1.0.0',
            entry: { main: './index.js' },
            promptRole: role
        } as any,
        create: vi.fn() as any
    };
}

// Mock KernelConfig factory helper
function createKernelConfigFactory(name: string, role?: 'user' | 'assistant'): TUIAppFactory {
    return {
        kernelConfig: {
            name,
            root: vi.fn() as any,
            promptRole: role
        } as any
    };
}

describe('AppRegistry Role Propagation', () => {
    let tempDir: string;
    let configPath: string;
    let registry: AppRegistry;
    let mockDesktop: any;

    beforeEach(async () => {
        // Setup temp environment
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tui-test-role-'));
        configPath = path.join(tempDir, 'config.json');

        // Mock desktop
        mockDesktop = {
            id: 'dt_test',
            installDynamicWorkerApp: vi.fn().mockResolvedValue('app_worker'),
            registerPendingApp: vi.fn().mockResolvedValue('app_pending'),
            logSystem: vi.fn()
        };

        registry = new AppRegistry({ configPath });
        await registry.loadFromConfig();

        // Mock resolveModulePath
        // @ts-ignore
        registry.resolveModulePath = vi.fn().mockReturnValue('/mock/module/path');
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should propagate promptRole from manifest', async () => {
        // Setup app with manifest role
        const factory = createMockFactory('assistant-app', 'assistant');
        // @ts-ignore
        registry['apps'].set('assistant-app', {
            name: 'assistant-app',
            source: 'local:/mock',
            factory,
            manifest: factory.manifest
        });
        registry['config'].apps['assistant-app'] = {
            source: 'local:/mock',
            enabled: true,
            autoStart: true
        };

        await registry.installAll(mockDesktop);

        expect(mockDesktop.installDynamicWorkerApp).toHaveBeenCalledWith(
            '/mock/module/path',
            expect.objectContaining({
                name: 'assistant-app',
                promptRole: 'assistant'
            })
        );
    });

    it('should propagate promptRole from kernelConfig', async () => {
        // Setup app with kernelConfig role
        const factory = createKernelConfigFactory('kernel-assistant-app', 'assistant');
        // @ts-ignore
        registry['apps'].set('kernel-assistant-app', {
            name: 'kernel-assistant-app',
            source: 'local:/mock',
            factory,
            manifest: undefined
        });
        registry['config'].apps['kernel-assistant-app'] = {
            source: 'local:/mock',
            enabled: true,
            autoStart: true
        };

        await registry.installAll(mockDesktop);

        expect(mockDesktop.installDynamicWorkerApp).toHaveBeenCalledWith(
            '/mock/module/path',
            expect.objectContaining({
                name: 'kernel-assistant-app',
                promptRole: 'assistant'
            })
        );
    });

    it('should allow config override of promptRole', async () => {
        // Setup app with default user role
        const factory = createMockFactory('override-app', 'user');
        // @ts-ignore
        registry['apps'].set('override-app', {
            name: 'override-app',
            source: 'local:/mock',
            factory,
            manifest: factory.manifest
        });
        // Override in config
        registry['config'].apps['override-app'] = {
            source: 'local:/mock',
            enabled: true,
            autoStart: true,
            promptRole: 'assistant'
        };

        await registry.installAll(mockDesktop);

        expect(mockDesktop.installDynamicWorkerApp).toHaveBeenCalledWith(
            '/mock/module/path',
            expect.objectContaining({
                name: 'override-app',
                promptRole: 'assistant'
            })
        );
    });

    it('should propagate promptRole to registerPendingApp (lazy load)', async () => {
        // Setup lazy app with role
        const factory = createMockFactory('lazy-assistant', 'assistant');
        // @ts-ignore
        registry['apps'].set('lazy-assistant', {
            name: 'lazy-assistant',
            source: 'local:/mock',
            factory,
            manifest: factory.manifest
        });
        registry['config'].apps['lazy-assistant'] = {
            source: 'local:/mock',
            enabled: true,
            autoStart: false // Lazy load
        };

        await registry.installAll(mockDesktop);

        expect(mockDesktop.registerPendingApp).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'lazy-assistant',
                promptRole: 'assistant'
            })
        );
    });
});
