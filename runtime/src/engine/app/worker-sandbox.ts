/**
 * WorkerSandbox - Worker-based App 隔离沙箱
 * 
 * 与 AppSandbox 相同接口，但 App 运行在独立的 Worker Thread 中。
 * 所有 App 交互通过 IPC 进行。
 * 
 * 优点:
 * - 真正的 DOM 隔离 (每个 Worker 有独立 globalThis.document)
 * - 进程级错误隔离
 * - 支持任意 UI 框架
 * 
 * @module @aotui/runtime/engine/app-sandbox
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import type { AppID, DesktopID, DataPayload, ViewID, OperationID, SnapshotID } from '../../spi/index.js';
import { AOTUIError } from '../../spi/core/errors.js';
import { AppWorkerHost, type WorkerStatus } from './worker-host.js';
import { WorkerPool } from './worker-pool.js';

// [C1 Fix] Default worker script path from Runtime package
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_WORKER_SCRIPT = resolve(__dirname, '../../worker-runtime/index.js');

// 复用 AppSandbox 的状态类型
/**
 * Sandbox 状态机
 * 
 * 状态转换:
 * created → running (installDynamic)
 * running ↔ paused
 * running/paused → closed
 */
export type SandboxStatus = 'created' | 'running' | 'paused' | 'closed';

// [WorkerPool] Global singleton pool
// Assume all worker apps use the same runtime script
let globalWorkerPool: WorkerPool | null = null;

function getWorkerPool(scriptPath: string): WorkerPool {
    if (!globalWorkerPool) {
        console.log(`[WorkerSandbox] Initializing global WorkerPool with script: ${scriptPath}`);
        globalWorkerPool = new WorkerPool({
            workerScript: scriptPath,
            initialSize: 2,
            maxSize: 8,
            idleTimeoutMs: 60000,
        });
        globalWorkerPool.warmup().catch(err => {
            console.error('[WorkerSandbox] Failed to warmup worker pool:', err);
        });
    }
    return globalWorkerPool;
}

/**
 * WorkerSandbox 配置
 */
export interface WorkerSandboxConfig {
    /** App ID */
    appId: AppID;
    /** Desktop ID */
    desktopId: DesktopID;
    /** App 名称 */
    name?: string;
    /** App 模块路径 (用于动态 import) */
    appModulePath: string;
    /** 
     * Worker runtime 脚本路径 (可选)
     * [C1 Fix] 默认使用 Runtime 内置的 worker-runtime
     */
    workerScriptPath?: string;
    /** 应用启动配置 (环境变量、初始状态等) */
    config?: import('../../spi/app/app-config.interface.js').AppLaunchConfig;
    /** [RFC-005] Runtime Config */
    runtimeConfig?: import('../../spi/config/index.js').RuntimeConfig;
}

/**
 * WorkerSandbox - Worker-based App 隔离
 * 
 * 实现与 AppSandbox 兼容的接口，但使用 Worker 执行 App
 */
export class WorkerSandbox {
    readonly appId: AppID;
    readonly desktopId: DesktopID;
    readonly name?: string;
    readonly createdAt: number;

    private workerHost: AppWorkerHost | null = null;
    private _status: SandboxStatus = 'created';
    private _disposed = false;


    // 回调
    onUpdateRequest?: () => void;

    constructor(private readonly config: WorkerSandboxConfig) {
        this.appId = config.appId;
        this.desktopId = config.desktopId;
        this.name = config.name;
        this.createdAt = Date.now();
    }

    // ════════════════════════════════════════════════════════════════
    //  Public Getters (兼容 AppSandbox 接口)
    // ════════════════════════════════════════════════════════════════

    get status(): SandboxStatus {
        return this._status;
    }

    get disposed(): boolean {
        return this._disposed;
    }

    /**
     * 获取 Worker 状态
     */
    getWorkerStatus(): WorkerStatus | null {
        return this.workerHost?.getStatus() ?? null;
    }



    /**
     * [RFC-001] 获取 Snapshot Fragment
     * 
     * 返回 Worker 最新推送的 Markdown + IndexMap + ViewTree。
     * 当 USE_WORKER_TRANSFORM 启用时，Worker 直接执行 Transformer，
     * 此方法返回缓存的结果。
     * 
     * [RFC-007] Added viewTree for Application View Tree section
     */
    getSnapshotFragment(): { markup: string; indexMap: Record<string, DataPayload>; viewTree?: string; timestamp?: number } | null {
        return this.workerHost?.getSnapshotFragment() ?? null;
    }



    // ════════════════════════════════════════════════════════════════
    //  Lifecycle Methods
    // ════════════════════════════════════════════════════════════════

    /**
     * 安装动态 App (启动 Worker)
     * 
     * [WorkerPool] 从池中获取 Worker
     */
    async installDynamic(): Promise<void> {
        this.ensureNotDisposed();

        if (this._status !== 'created') {
            throw new AOTUIError('CONFIG_INVALID', {
                reason: `Cannot install, sandbox is already '${this._status}'`,
                appId: this.appId
            });
        }

        // 1. 获取 Worker (可能来自 Pool)
        // [C1 Fix] Use default script path if not specified
        // [Fix] Also treat empty string as undefined (config may have workerScript: "")
        const scriptPath = this.config.workerScriptPath || DEFAULT_WORKER_SCRIPT;
        const pool = getWorkerPool(scriptPath);
        const worker = await pool.acquire();

        // 2. 创建 WorkerHost
        this.workerHost = new AppWorkerHost({
            ...this.config, // Pass all config properties
            existingWorker: worker, // 注入 Worker
            runtimeConfig: this.config.runtimeConfig, // [RFC-005] Pass Runtime Config
        });

        // 设置回调
        this.workerHost.onUpdateRequest = () => {
            this.onUpdateRequest?.();
        };

        // 3. 启动 Host (初始化 App)
        try {
            await this.workerHost.start();
            // 打开 App
            await this.workerHost.open();
        } catch (error) {
            // 如果启动失败，尝试归还 worker (如果是 Reset 失败，release 会处理)
            const w = await this.workerHost.releaseWorker();
            if (w) pool.release(w, false); // 标记无效
            throw error;
        }

        this._status = 'running';
    }

    /**
     * 暂停 App
     */
    async pause(): Promise<void> {
        this.ensureNotDisposed();

        if (this._status !== 'running') {
            return;
        }

        if (this.workerHost) {
            await this.workerHost.pause();
        }
        this._status = 'paused';
    }

    /**
     * 恢复 App
     */
    async resume(): Promise<void> {
        this.ensureNotDisposed();

        if (this._status !== 'paused') {
            return;
        }

        if (this.workerHost) {
            await this.workerHost.resume();
        }
        this._status = 'running';
    }

    /**
     * 关闭 App
     */
    async close(): Promise<void> {
        this.ensureNotDisposed();

        if (this._status === 'closed') {
            return;
        }

        if (this.workerHost) {
            await this.workerHost.close();
            // [WorkerPool] 归还 Worker
            // [C1 Fix] Use default script path if not specified
            // [Fix] Also treat empty string as undefined
            const scriptPath = this.config.workerScriptPath || DEFAULT_WORKER_SCRIPT;
            const pool = getWorkerPool(scriptPath);
            const worker = await this.workerHost.releaseWorker();
            if (worker) {
                console.log(`[WorkerSandbox] Releasing worker for ${this.appId} to pool`);
                pool.release(worker, true);
            }
        }
        this._status = 'closed';
    }

    /**
     * [RFC-015] 删除 App
     * 
     * 1. 调用 Worker delete() 清理数据
     * 2. 调用 close() 关闭 Worker
     */
    async delete(): Promise<void> {
        this.ensureNotDisposed();

        if (this.workerHost) {
            await this.workerHost.delete();
            await this.close();
        }
    }

    /**
     * 销毁 Sandbox (终止 Worker)
     */
    dispose(): void {
        if (this._disposed) return;

        this._disposed = true;

        // 尝试归还 Worker (如果还没 close)
        if (this.workerHost) {
            // [C1 Fix] Use default script path if not specified
            // [Fix] Also treat empty string as undefined
            const scriptPath = this.config.workerScriptPath || DEFAULT_WORKER_SCRIPT;
            const pool = getWorkerPool(scriptPath);
            // 这里我们不能异步等待，所以如果是 dispose，可能只能 terminate 或者 fire-and-forget release
            // 为了安全，我们还是尝试 release
            this.workerHost.releaseWorker().then(worker => {
                if (worker) {
                    pool.release(worker, true);
                }
            }).catch(err => {
                console.error('[WorkerSandbox] Error releasing worker during dispose:', err);
            });
            this.workerHost = null;
        }
    }



    // ════════════════════════════════════════════════════════════════
    //  Operations (通过 IPC)
    // ════════════════════════════════════════════════════════════════

    /**
     * 执行 Operation
     */
    async executeOperation(
        operation: OperationID,
        args: Record<string, unknown>,
        snapshotId: SnapshotID,
        viewId?: ViewID
    ) {
        if (!this.workerHost) {
            throw new AOTUIError('WORKER_NOT_STARTED', { appId: this.appId });
        }
        return this.workerHost.executeOperation(operation, args, snapshotId, viewId);
    }

    /**
     * 发送外部事件
     */
    async sendExternalEvent(
        viewId: ViewID,
        eventType: string,
        data: Record<string, unknown>
    ): Promise<void> {
        if (!this.workerHost) {
            throw new AOTUIError('WORKER_NOT_STARTED', { appId: this.appId });
        }
        await this.workerHost.sendExternalEvent(viewId, eventType, data);
    }

    // ════════════════════════════════════════════════════════════════
    //  View Lifecycle (通过 IPC)
    // ════════════════════════════════════════════════════════════════



    /**
     * 卸载 View (通过 IPC 发送到 Worker)
     */
    async dismountView(viewId: ViewID): Promise<void> {
        if (!this.workerHost) {
            throw new AOTUIError('WORKER_NOT_STARTED', { appId: this.appId });
        }
        await this.workerHost.dismountView(viewId);
    }

    /**
     * [RFC-006] 通过 ViewLink 挂载 View (通过 IPC 发送到 Worker)
     */
    async mountViewByLink(parentViewId: ViewID, linkId: string): Promise<void> {
        if (!this.workerHost) {
            throw new AOTUIError('WORKER_NOT_STARTED', { appId: this.appId });
        }
        await this.workerHost.mountViewByLink(parentViewId, linkId);
    }

    // ════════════════════════════════════════════════════════════════
    //  [RFC-011] LLM Output Channel
    // ════════════════════════════════════════════════════════════════

    /**
     * [RFC-011] Push LLM text to Worker
     * [RFC-020] Now accepts structured payload { reasoning?, content? }
     */
    pushLLMOutput(
        payload: { reasoning?: string; content?: string },
        type: 'complete',
        meta?: {
            model?: string;
            usage?: {
                promptTokens: number;
                completionTokens: number;
                totalTokens: number;
            };
        }
    ): void {
        if (!this.workerHost) {
            console.warn(`[WorkerSandbox] Cannot push LLM text: Worker not started for ${this.appId}`);
            return;
        }
        this.workerHost.pushLLMOutput(payload, type, meta);
    }



    // ════════════════════════════════════════════════════════════════
    //  Internal
    // ════════════════════════════════════════════════════════════════

    private ensureNotDisposed(): void {
        if (this._disposed) {
            throw new AOTUIError('DESKTOP_DISPOSED', { desktopId: this.desktopId, appId: this.appId });
        }
    }
}
