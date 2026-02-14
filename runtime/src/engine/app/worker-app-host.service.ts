/**
 * Engine Layer - Worker App Host Service
 * 
 * [Option B] IAppHostService 的 Worker-based 实现。
 * 
 * 将原有 AppManager 的功能封装为 Service 接口，
 * 解除 Desktop 对 AppManager 的直接依赖。
 * 
 * 设计说明:
 * - 每个 Desktop 有独立的 AppManager 实例
 * - Service 管理所有 Desktop 的 App 托管
 * - Signal 发射通过回调解耦
 * 
 * @module @aotui/runtime/engine/app
 */

import type {
    IAppHostService,
    SnapshotFragment,
    AppInstallOptions,
    DesktopID,
    AppID,
    ViewID,
    OperationPayload,
} from '../../spi/index.js';
import { createAppId, createOperationId, createSnapshotId } from '../../spi/index.js';
import { AOTUIError } from '../../spi/core/errors.js';
import { WorkerSandbox } from './worker-sandbox.js';

// ============================================================================
// Types
// ============================================================================

/**
 * 单个 Desktop 的 App 托管状态
 */
interface DesktopAppState {
    /** WorkerSandbox 集合 */
    workers: Map<AppID, WorkerSandbox>;
    /** App ID 计数器 */
    appIdCounter: number;
}

// ============================================================================
// Worker App Host Service Implementation
// ============================================================================

/**
 * Worker-based App Host Service
 * 
 * 实现 IAppHostService，管理所有 Desktop 的 App 托管。
 * 
 * @example
 * ```typescript
 * const appHost = new WorkerAppHostService();
 * appHost.setSignalEmitter((desktopId, reason) => {
 *     signalService.emit(desktopId, reason);
 * });
 * 
 * const appId = await appHost.install(desktopId, './app.js');
 * ```
 */
export class WorkerAppHostService implements IAppHostService {
    // ─────────────────────────────────────────────────────────────
    //  Private State
    // ─────────────────────────────────────────────────────────────

    /** 每个 Desktop 的 App 状态 */
    private desktopStates = new Map<DesktopID, DesktopAppState>();

    /** Signal 发射器回调 */
    private signalEmitter: ((desktopId: DesktopID, reason: string) => void) | null = null;

    // ─────────────────────────────────────────────────────────────
    //  IAppHostService Implementation
    // ─────────────────────────────────────────────────────────────

    setSignalEmitter(emitter: (desktopId: DesktopID, reason: string) => void): void {
        this.signalEmitter = emitter;
    }

    async install(
        desktopId: DesktopID,
        modulePath: string,
        options?: AppInstallOptions
    ): Promise<AppID> {
        const state = this.getOrCreateState(desktopId);

        // 分配 ID
        const appId = options?.appId ?? createAppId(state.appIdCounter++);

        // 创建 WorkerSandbox
        const workerSandbox = new WorkerSandbox({
            appId,
            desktopId,
            name: options?.name,
            appModulePath: modulePath,
            workerScriptPath: options?.workerScriptPath,
            config: options?.config,
        });

        // 设置更新回调 - 通过 Signal Emitter 解耦
        workerSandbox.onUpdateRequest = () => {
            this.emitSignal(desktopId, 'manual_refresh');
        };

        // 启动 Worker
        await workerSandbox.installDynamic();

        // 注册
        state.workers.set(appId, workerSandbox);

        // 发射 App 安装信号
        this.emitSignal(desktopId, 'app_opened');

        return appId;
    }

    async executeOperation(
        desktopId: DesktopID,
        appId: AppID,
        payload: OperationPayload
    ): Promise<void> {
        const sandbox = this.getWorkerSandbox(desktopId, appId);
        if (!sandbox) {
            throw new AOTUIError('APP_NOT_FOUND', { appId, desktopId });
        }

        await sandbox.executeOperation(
            createOperationId(payload.operation),
            payload.args || {},
            createSnapshotId(payload.context.snapshotId || ''),
            payload.context.viewId
        );
    }



    async dismountView(desktopId: DesktopID, appId: AppID, viewId: ViewID): Promise<void> {
        const sandbox = this.getWorkerSandbox(desktopId, appId);
        if (!sandbox) {
            throw new AOTUIError('APP_NOT_FOUND', { appId, desktopId });
        }
        await sandbox.dismountView(viewId);
        this.emitSignal(desktopId, 'dom_mutation');
    }

    getSnapshotFragments(desktopId: DesktopID): SnapshotFragment[] {
        const state = this.desktopStates.get(desktopId);
        if (!state) return [];

        const fragments: SnapshotFragment[] = [];
        for (const [appId, worker] of state.workers) {
            const fragment = worker.getSnapshotFragment();
            if (fragment) {
                fragments.push({
                    appId,
                    markup: fragment.markup,
                    indexMap: fragment.indexMap,
                });
            }
        }
        return fragments;
    }

    getAppInfo(desktopId: DesktopID, appId: AppID): { name?: string } | undefined {
        const sandbox = this.getWorkerSandbox(desktopId, appId);
        if (!sandbox) return undefined;
        return { name: sandbox.name };
    }

    hasApp(desktopId: DesktopID, appId: AppID): boolean {
        const state = this.desktopStates.get(desktopId);
        return state?.workers.has(appId) ?? false;
    }

    async pauseAll(desktopId: DesktopID): Promise<void> {
        const state = this.desktopStates.get(desktopId);
        if (!state) return;

        for (const [, worker] of state.workers) {
            if (worker.status === 'running') {
                await worker.pause();
            }
        }
    }

    async resumeAll(desktopId: DesktopID): Promise<void> {
        const state = this.desktopStates.get(desktopId);
        if (!state) return;

        for (const [, worker] of state.workers) {
            if (worker.status === 'paused') {
                await worker.resume();
            }
        }
    }

    async closeAll(desktopId: DesktopID): Promise<void> {
        const state = this.desktopStates.get(desktopId);
        if (!state) return;

        for (const [, worker] of state.workers) {
            await worker.close();
            worker.dispose();
        }
        state.workers.clear();

        // 清理 Desktop 状态
        this.desktopStates.delete(desktopId);
    }

    // ─────────────────────────────────────────────────────────────
    //  Additional Query Methods (for compatibility)
    // ─────────────────────────────────────────────────────────────

    /**
     * 获取指定 Desktop 的所有 Worker
     * 
     * 用于 Desktop 的 getSnapshotFragments 等方法的向后兼容
     */
    getAllWorkers(desktopId: DesktopID): Map<AppID, WorkerSandbox> {
        const state = this.desktopStates.get(desktopId);
        return state?.workers ?? new Map();
    }

    /**
     * 获取 WorkerSandbox
     */
    getWorkerSandbox(desktopId: DesktopID, appId: AppID): WorkerSandbox | undefined {
        const state = this.desktopStates.get(desktopId);
        return state?.workers.get(appId);
    }

    // ─────────────────────────────────────────────────────────────
    //  Private Helpers
    // ─────────────────────────────────────────────────────────────

    private getOrCreateState(desktopId: DesktopID): DesktopAppState {
        let state = this.desktopStates.get(desktopId);
        if (!state) {
            state = {
                workers: new Map(),
                appIdCounter: 0,
            };
            this.desktopStates.set(desktopId, state);
        }
        return state;
    }

    private emitSignal(desktopId: DesktopID, reason: string): void {
        if (this.signalEmitter) {
            this.signalEmitter(desktopId, reason);
        }
    }
}

