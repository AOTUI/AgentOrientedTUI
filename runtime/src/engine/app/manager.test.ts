/**
 * AppManager 单元测试
 * 
 * 测试 App 安装与生命周期管理功能。
 * 
 * [Worker-Only] 由于 AppManager 依赖 WorkerSandbox，
 * 我们使用 mock 来隔离 Worker 线程依赖。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppManager, type InstalledApp } from './index.js';
import type { IDesktop, AppID } from '../../spi/index.js';

// ============================================================================
// Mock Desktop
// ============================================================================
function createMockDesktop(): IDesktop & {
    emitSignal: ReturnType<typeof vi.fn>;
    logSystem: ReturnType<typeof vi.fn>;
    logAppOperation: ReturnType<typeof vi.fn>;
} {
    return {
        id: 'dt_test' as any,
        status: 'running',
        createdAt: Date.now(),
        emitSignal: vi.fn(),
        logSystem: vi.fn(),
        logAppOperation: vi.fn(),
        getInstalledApps: vi.fn().mockReturnValue([]),
        getSystemLogs: vi.fn().mockReturnValue([]),
        getAppOperationLogs: vi.fn().mockReturnValue([]),
        getAppStates: vi.fn().mockReturnValue([]),
        suspend: vi.fn(),
        resume: vi.fn(),
        dispose: vi.fn(),
        installDynamicWorkerApp: vi.fn(),
        dispatchOperation: vi.fn(),
        injectEvent: vi.fn(),

        dismountView: vi.fn(),
        acquireSnapshot: vi.fn(),
        releaseSnapshot: vi.fn(),
    } as any;
}

// ============================================================================
// Tests
// ============================================================================

describe('AppManager', () => {
    let desktop: ReturnType<typeof createMockDesktop>;
    let manager: AppManager;

    beforeEach(() => {
        desktop = createMockDesktop();
        manager = new AppManager(desktop);
    });

    afterEach(() => {
        // 清理所有 Worker（防止泄漏）
        manager.cleanup();
    });

    // ════════════════════════════════════════════════════════════════
    // 构造与初始化
    // ════════════════════════════════════════════════════════════════

    describe('constructor', () => {
        it('创建 AppManager 实例', () => {
            expect(manager).toBeInstanceOf(AppManager);
        });

        it('初始状态下没有已安装的 App', () => {
            expect(manager.getInstalledApps()).toHaveLength(0);
            expect(manager.getDynamicAppIds()).toHaveLength(0);
        });

        it('接受可选的 options 参数', () => {
            const onAppInstalled = vi.fn();
            const onAppRemoved = vi.fn();
            const managerWithOptions = new AppManager(desktop, {
                onAppInstalled,
                onAppRemoved
            });
            expect(managerWithOptions).toBeInstanceOf(AppManager);
        });
    });

    // ════════════════════════════════════════════════════════════════
    // 查询方法（无 Worker 依赖）
    // ════════════════════════════════════════════════════════════════

    describe('getInstalledApps', () => {
        it('返回空数组当没有安装 App', () => {
            const apps = manager.getInstalledApps();
            expect(apps).toEqual([]);
        });
    });

    describe('getDynamicAppIds', () => {
        it('返回空数组当没有安装 App', () => {
            const ids = manager.getDynamicAppIds();
            expect(ids).toEqual([]);
        });
    });

    describe('getAppStates', () => {
        it('返回空数组当没有安装 App', () => {
            const states = manager.getAppStates();
            expect(states).toEqual([]);
        });
    });

    describe('isWorkerMode', () => {
        it('对不存在的 App 返回 false', () => {
            expect(manager.isWorkerMode('nonexistent_app' as AppID)).toBe(false);
        });
    });

    describe('getWorkerSandbox', () => {
        it('对不存在的 App 返回 undefined', () => {
            expect(manager.getWorkerSandbox('nonexistent_app' as AppID)).toBeUndefined();
        });
    });

    describe('getAllWorkers', () => {
        it('返回空 Map 当没有安装 App', () => {
            const workers = manager.getAllWorkers();
            expect(workers.size).toBe(0);
        });
    });

    // ════════════════════════════════════════════════════════════════
    // 生命周期方法（空状态）
    // ════════════════════════════════════════════════════════════════

    describe('pauseAll', () => {
        it('空状态下不抛出错误', async () => {
            await expect(manager.pauseAll()).resolves.toBeUndefined();
        });
    });

    describe('resumeAll', () => {
        it('空状态下不抛出错误', async () => {
            await expect(manager.resumeAll()).resolves.toBeUndefined();
        });
    });

    describe('closeAll', () => {
        it('空状态下不抛出错误', async () => {
            await expect(manager.closeAll()).resolves.toBeUndefined();
        });
    });

    describe('openApp', () => {
        it('对不存在的 App 打印警告', async () => {
            const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });
            await manager.openApp('nonexistent_app' as AppID);
            expect(warnSpy).toHaveBeenCalledWith('App nonexistent_app not found.');
            warnSpy.mockRestore();
        });
    });

    describe('closeApp', () => {
        it('对不存在的 App 静默返回', async () => {
            await expect(manager.closeApp('nonexistent_app' as AppID)).resolves.toBeUndefined();
        });

        it('应该真正关闭 worker 并将 app 标记为 closed', async () => {
            const appId = 'app_0' as AppID;
            const worker = {
                close: vi.fn().mockResolvedValue(undefined),
                dispose: vi.fn(),
            };

            (manager as any).installedApps.set(appId, {
                appId,
                name: 'ide',
                html: '',
                status: 'running',
                installedAt: Date.now(),
                modulePath: '/path/to/module',
            });
            (manager as any).workers.set(appId, worker);

            await manager.closeApp(appId);

            expect(worker.close).toHaveBeenCalledTimes(1);
            expect(worker.dispose).toHaveBeenCalledTimes(1);
            expect(manager.getAllWorkers().has(appId)).toBe(false);
            expect(manager.getInstalledApps()[0]?.status).toBe('closed');
        });
    });

    describe('collapseApp', () => {
        it('对不存在的 App 静默返回', async () => {
            await expect(manager.collapseApp('nonexistent_app' as AppID)).resolves.toBeUndefined();
        });
    });

    describe('showApp', () => {
        it('对不存在的 App 静默返回', async () => {
            await expect(manager.showApp('nonexistent_app' as AppID)).resolves.toBeUndefined();
        });
    });

    // ════════════════════════════════════════════════════════════════
    // [RFC-014] 懒加载测试
    // ════════════════════════════════════════════════════════════════

    describe('Lazily Loaded Apps', () => {
        it('registerPendingApp 应该注册 App 但不创建 Worker', () => {
            const appId = manager.registerPendingApp({
                name: 'lazy-app',
                modulePath: '/path/to/module',
                description: 'Lazy App'
            });

            expect(appId).toBeDefined();

            // 验证已安装
            const apps = manager.getInstalledApps();
            expect(apps).toHaveLength(1);
            expect(apps[0]).toMatchObject({
                appId,
                name: 'lazy-app',
                status: 'pending',
                modulePath: '/path/to/module'
            });

            // 验证没有 Worker
            expect(manager.getAllWorkers().has(appId)).toBe(false);
            expect(manager.getWorkerSandbox(appId)).toBeUndefined();
        });

        it('openApp 应该自动启动 pending 状态的 App', async () => {
            // Mock install 方法以避开 WorkerSandbox 创建
            const installSpy = vi.spyOn(manager, 'install').mockResolvedValue('app_0' as any);

            const appId = manager.registerPendingApp({
                name: 'lazy-app',
                modulePath: '/path/to/module'
            });

            await manager.openApp(appId);

            expect(installSpy).toHaveBeenCalledWith('/path/to/module', expect.objectContaining({
                appId: appId,
                name: 'lazy-app'
            }));

            installSpy.mockRestore();
        });

        it('openApp 应该自动重新启动 closed 状态的 App', async () => {
            const installSpy = vi.spyOn(manager, 'install').mockResolvedValue('app_0' as any);

            const appId = manager.registerPendingApp({
                name: 'lazy-app',
                modulePath: '/path/to/module',
                workerScriptPath: '/path/to/worker',
            });

            const installedApp = manager.getInstalledApps()[0]!;
            installedApp.status = 'closed';
            installedApp.whatItIs = 'IDE';
            installedApp.whenToUse = 'Use for code';
            installedApp.config = { projectPath: '/repo' };

            await manager.openApp(appId);

            expect(installSpy).toHaveBeenCalledWith('/path/to/module', {
                appId,
                name: 'lazy-app',
                description: undefined,
                whatItIs: 'IDE',
                whenToUse: 'Use for code',
                workerScriptPath: '/path/to/worker',
                config: { projectPath: '/repo' },
                runtimeConfig: undefined,
                promptRole: undefined,
            });

            installSpy.mockRestore();
        });

        it('startPendingApp 应该启动 App 并更新状态', async () => {
            // Mock install 方法
            const installSpy = vi.spyOn(manager, 'install').mockResolvedValue('app_0' as any);

            const appId = manager.registerPendingApp({
                name: 'lazy-app',
                modulePath: '/path/to/module',
                workerScriptPath: '/path/to/worker'
            });

            const result = await manager.startPendingApp(appId);

            expect(result).toBe(true);
            expect(installSpy).toHaveBeenCalledWith('/path/to/module', {
                appId,
                name: 'lazy-app',
                description: undefined,
                workerScriptPath: '/path/to/worker'
            });

            installSpy.mockRestore();
        });

        it('startPendingApp 对非 staged App 应返回 false', async () => {
            const result = await manager.startPendingApp('nonexistent' as any);
            expect(result).toBe(false);
        });
    });

    // ════════════════════════════════════════════════════════════════
    // 清理
    // ════════════════════════════════════════════════════════════════

    describe('cleanup', () => {
        it('清理后 installedApps 为空', () => {
            manager.cleanup();
            expect(manager.getInstalledApps()).toHaveLength(0);
        });

        it('清理后 workers 为空', () => {
            manager.cleanup();
            expect(manager.getAllWorkers().size).toBe(0);
        });
    });
});

// ============================================================================
// 集成测试（需要真实 Worker）- 标记为需要单独运行
// ============================================================================

describe.skip('AppManager Integration (requires real Worker)', () => {
    // 这些测试需要真实的 Worker 环境
    // 在 CI/CD 中可能需要特殊配置

    describe('install', () => {
        it.todo('安装 App 并返回 AppID');
        it.todo('安装后 App 状态为 running');
        it.todo('触发 onAppInstalled 回调');
        it.todo('emitSignal 被调用');
    });

    describe('App 生命周期', () => {
        it.todo('pauseAll 暂停所有运行中的 App');
        it.todo('resumeAll 恢复所有暂停的 App');
        it.todo('closeAll 关闭并清理所有 App');
    });
});
