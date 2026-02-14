/**
 * AppWorkerHost - 主线程端 Worker 管理器
 * 
 * 管理一个 App 的 Worker Thread，处理：
 * - Worker 启动/终止
 * - 消息发送/接收
 * - 请求-响应匹配
 * 
 * @module @aotui/runtime/engine/app-worker
 */

import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import type { AppID, DesktopID, ViewID, OperationID, OperationResult, SnapshotID } from '../../spi/index.js';
import { WORKER_DEFAULTS, type WorkerConfig } from '../../spi/config/index.js';

import {
    generateRequestId,
    type RequestID,
    type MainToWorkerMessage,
    type WorkerToMainMessage,
    type ResponseBase,
    type SnapshotFragmentPush,
    type DataPayload,
    isResponse,
    isRequest,
    isSnapshotFragment,
} from '../../spi/worker-protocol/index.js';

// Compute default worker script path relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_WORKER_SCRIPT = resolve(__dirname, '../../worker-runtime/index.js');

/**
 * 待处理请求
 */
interface PendingRequest {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
}

/**
 * AppWorkerHost 配置
 */
/**
 * AppWorkerHost 配置
 */
export interface AppWorkerHostConfig {
    appId: AppID;
    desktopId: DesktopID;
    name?: string;  // App name for TUI output
    appModulePath: string;
    /** 
     * Worker 脚本路径 (可选，默认使用 Runtime 内置 worker-runtime)
     * [C1 Fix] 不再强制要求传入 SDK 内部路径
     */
    workerScriptPath?: string;
    timeout?: number;  // 请求超时 (ms)
    existingWorker?: Worker; // [WorkerPool] 复用的 Worker 实例
    config?: import('../../spi/app/app-config.interface.js').AppLaunchConfig; // Configuration Injection
    runtimeConfig?: { worker: WorkerConfig }; // [RFC-005] Runtime Config
}

/**
 * Worker 状态
 */
export type WorkerStatus = 'starting' | 'ready' | 'running' | 'paused' | 'closed' | 'error';

/**
 * AppWorkerHost - 主线程端 Worker 管理
 */
export class AppWorkerHost {
    readonly appId: AppID;
    readonly desktopId: DesktopID;
    readonly name?: string;
    private readonly config?: import('../../spi/app/app-config.interface.js').AppLaunchConfig;

    private worker: Worker | null = null;
    private status: WorkerStatus = 'starting';
    private pendingRequests = new Map<RequestID, PendingRequest>();
    private readonly timeout: number;
    private readonly appModulePath: string;
    private readonly workerScriptPath: string;

    // 回调: Worker 请求 notifyUpdate
    onUpdateRequest?: () => void;
    // 回调: Worker 请求 mount 子 View
    onMountChildRequest?: (viewId: ViewID) => Promise<void>;
    // 回调: Worker 请求 dismount 子 View
    onDismountChildRequest?: (viewId: ViewID) => Promise<void>;

    private lastDomTimestamp: number = 0;

    // [RFC-001] Snapshot Fragment Cache
    // [RFC-007] Added viewTree field
    private snapshotFragment: {
        markup: string;
        indexMap: Record<string, DataPayload>;
        viewTree?: string;  // [RFC-007]
        timestamp: number;
    } | null = null;

    constructor(config: AppWorkerHostConfig) {
        this.appId = config.appId;
        this.desktopId = config.desktopId;
        this.name = config.name;
        this.appModulePath = config.appModulePath;
        // [C1 Fix] Default to Runtime's built-in worker-runtime
        this.workerScriptPath = config.workerScriptPath ?? DEFAULT_WORKER_SCRIPT;

        // [RFC-005] Use Runtime Config
        const workerConfig = config.runtimeConfig?.worker ?? WORKER_DEFAULTS;
        this.timeout = config.timeout ?? workerConfig.timeoutMs;

        this.config = config.config; // ✨ Store config

        if (config.existingWorker) {
            this.worker = config.existingWorker;
            // 重新绑定 listeners (因为 Pool 可能移除过)
            this.bindWorkerListeners();
        }
    }

    /**
     * 启动 Worker 并初始化 App
     */
    async start(): Promise<void> {
        if (!this.worker) {
            // 创建新 Worker
            this.worker = new Worker(this.workerScriptPath, {
                workerData: {
                    appId: this.appId,
                    desktopId: this.desktopId,
                    appModulePath: this.appModulePath,
                },
            });
            this.bindWorkerListeners();
        }

        // 发送初始化消息
        // 注意: 即使是复用的 Worker，也需要发送 INIT 消息来加载 App 模块
        await this.sendRequest<void>({
            type: 'INIT',
            requestId: generateRequestId(),
            appId: this.appId,
            desktopId: this.desktopId,
            appModulePath: this.appModulePath,
            config: this.config, // ✨ Send config to Worker
        });

        this.status = 'ready';
    }

    private bindWorkerListeners(): void {
        if (!this.worker) return;
        // 先移除旧的 (防止重复绑定)
        this.worker.removeAllListeners('message');
        this.worker.removeAllListeners('error');
        this.worker.removeAllListeners('exit');

        this.worker.on('message', this.handleMessage.bind(this));
        this.worker.on('error', this.handleError.bind(this));
        this.worker.on('exit', this.handleExit.bind(this));
    }

    /**
     * 释放 Worker (用于归还给 Pool)
     * 
     * 会先发送 RESET 消息，成功后解绑监听器并返回 Worker 实例。
     */
    async releaseWorker(): Promise<Worker | null> {
        if (!this.worker || this.status === 'closed') return null;

        try {
            // 1. 发送 RESET
            await this.sendRequest<void>({
                type: 'RESET',
                requestId: generateRequestId(),
            });

            const worker = this.worker;

            // 2. 解绑监听器
            worker.removeAllListeners('message');
            worker.removeAllListeners('error');
            worker.removeAllListeners('exit');

            this.worker = null;
            this.status = 'closed'; // Host 标记为关闭，但 Worker 存活

            // 清理待处理请求
            this.cleanupPendingRequests();

            return worker;
        } catch (error) {
            console.error(`[AppWorkerHost] Failed to reset worker:`, error);
            // 如果重置失败，直接终止
            this.terminate();
            return null;
        }
    }

    private cleanupPendingRequests(): void {
        for (const [, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Worker released/terminated'));
        }
        this.pendingRequests.clear();
    }

    /**
     * 获取 Worker 状态
     */
    getStatus(): WorkerStatus {
        return this.status;
    }



    /**
     * [RFC-001] 获取缓存的 Snapshot Fragment
     * 
     * 返回 Worker 最新推送的 Markdown + IndexMap + ViewTree，
     * 供 Desktop 聚合为 Desktop-level Snapshot。
     * 
     * [RFC-007] Added viewTree for Application View Tree section
     */
    getSnapshotFragment(): { markup: string; indexMap: Record<string, DataPayload>; viewTree?: string; timestamp?: number } | null {
        if (!this.snapshotFragment) return null;
        return {
            markup: this.snapshotFragment.markup,
            indexMap: this.snapshotFragment.indexMap,
            viewTree: this.snapshotFragment.viewTree,  // [RFC-007]
            timestamp: (this.snapshotFragment as any).timestamp, // propagate fragment recency
        };
    }

    // ════════════════════════════════════════════════════════════════
    //  App 生命周期
    // ════════════════════════════════════════════════════════════════

    async open(): Promise<void> {
        await this.sendRequest<void>({
            type: 'APP_OPEN',
            requestId: generateRequestId(),
        });
        this.status = 'running';
    }

    async pause(): Promise<void> {
        await this.sendRequest<void>({
            type: 'APP_PAUSE',
            requestId: generateRequestId(),
        });
        this.status = 'paused';
    }

    async resume(): Promise<void> {
        await this.sendRequest<void>({
            type: 'APP_RESUME',
            requestId: generateRequestId(),
        });
        this.status = 'running';
    }

    async close(): Promise<void> {
        // 发送 APP_SHUTDOWN 信号给SDK，触发持久化flush
        await this.sendRequest<void>({
            type: 'APP_SHUTDOWN',
            requestId: generateRequestId(),
        });

        // 发送 APP_CLOSE 关闭App
        await this.sendRequest<void>({
            type: 'APP_CLOSE',
            requestId: generateRequestId(),
        });
        this.status = 'closed';
    }

    /**
     * [RFC-015] Delete App (Data Cleanup)
     * 
     * Triggers app.onDelete() in worker to clean up persisted data.
     * Note: This does NOT close the worker, you must call close() after delete().
     */
    async delete(): Promise<void> {
        await this.sendRequest<void>({
            type: 'APP_DELETE',
            requestId: generateRequestId(),
        });
    }

    // ════════════════════════════════════════════════════════════════
    //  View 生命周期
    // ════════════════════════════════════════════════════════════════

    async dismountView(viewId: ViewID): Promise<void> {
        await this.sendRequest<void>({
            type: 'VIEW_DISMOUNT',
            requestId: generateRequestId(),
            viewId,
        });
    }



    /**
     * [RFC-006] Mount view via ViewLink
     */
    async mountViewByLink(parentViewId: ViewID, linkId: string): Promise<void> {
        await this.sendRequest<void>({
            type: 'VIEW_MOUNT_BY_LINK',
            requestId: generateRequestId(),
            parentViewId,
            linkId,
        } as MainToWorkerMessage);
    }

    // ════════════════════════════════════════════════════════════════
    //  Operation
    // ════════════════════════════════════════════════════════════════

    async executeOperation(
        operation: OperationID,
        args: Record<string, unknown>,
        snapshotId: SnapshotID,
        viewId?: ViewID
    ): Promise<OperationResult> {
        return this.sendRequest<OperationResult>({
            type: viewId ? 'VIEW_OPERATION' : 'APP_OPERATION',
            requestId: generateRequestId(),
            viewId,
            operation,
            args,
            snapshotId,
        });
    }

    // ════════════════════════════════════════════════════════════════
    //  External Event
    // ════════════════════════════════════════════════════════════════

    async sendExternalEvent(
        viewId: ViewID,
        eventType: string,
        data: Record<string, unknown>
    ): Promise<void> {
        await this.sendRequest<void>({
            type: 'EXTERNAL_EVENT',
            requestId: generateRequestId(),
            viewId,
            eventType,
            data,
        });
    }

    // ════════════════════════════════════════════════════════════════
    //  Render
    // ════════════════════════════════════════════════════════════════


    // ════════════════════════════════════════════════════════════════
    //  [RFC-011] LLM Output Channel
    // ════════════════════════════════════════════════════════════════

    /**
     * [RFC-011] Push LLM text to Worker for SDK's useLLMOutputChannel
     * [RFC-020] Now accepts structured payload { reasoning?, content? }
     * 
     * Fire-and-forget: no response expected from Worker
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
        if (!this.worker) {
            console.warn('[AppWorkerHost] Cannot push LLM text: Worker not started');
            return;
        }

        const totalLength = (payload.reasoning?.length ?? 0) + (payload.content?.length ?? 0);
        console.log(`[AppWorkerHost] Pushing LLM text to Worker ${this.appId}, total length: ${totalLength}`);

        this.worker.postMessage({
            type: 'LLM_OUTPUT_PUSH',
            reasoning: payload.reasoning,
            content: payload.content,
            eventType: type,
            timestamp: Date.now(),
            meta,
        } as MainToWorkerMessage);
    }


    // ════════════════════════════════════════════════════════════════
    //  Terminate
    // ════════════════════════════════════════════════════════════════

    terminate(): void {
        if (this.worker) {
            this.worker.postMessage({ type: 'TERMINATE' } as MainToWorkerMessage);
            this.worker.terminate();
            this.worker = null;
        }
        this.status = 'closed';

        // 清理所有待处理请求
        this.cleanupPendingRequests();


    }

    // ════════════════════════════════════════════════════════════════
    //  Internal
    // ════════════════════════════════════════════════════════════════

    private sendRequest<T>(message: MainToWorkerMessage): Promise<T> {
        return new Promise((resolve, reject) => {
            if (!this.worker) {
                reject(new Error('Worker not started'));
                return;
            }

            const requestId = (message as any).requestId;
            if (!requestId) {
                reject(new Error('Message missing requestId'));
                return;
            }

            // 设置超时
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Request ${requestId} timed out after ${this.timeout}ms`));
            }, this.timeout);

            // 注册待处理请求
            this.pendingRequests.set(requestId, { resolve, reject, timeout });

            // 发送消息
            this.worker.postMessage(message);
        });
    }

    private handleMessage(msg: WorkerToMainMessage): void {
        // 处理响应消息
        if (isResponse(msg)) {
            const pending = this.pendingRequests.get(msg.requestId);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(msg.requestId);

                if (msg.success) {
                    // 根据响应类型提取结果
                    if (msg.type === 'OPERATION_RESPONSE') {
                        pending.resolve((msg as any).result);
                    } else {
                        pending.resolve(undefined);
                    }
                } else {
                    pending.reject(new Error((msg as any).error?.message || 'Unknown error'));
                }
            }
            return;
        }

        // 处理 Worker 主动请求
        if (isRequest(msg)) {
            switch (msg.type) {
                case 'REQUEST_UPDATE':
                    this.onUpdateRequest?.();
                    break;
                case 'REQUEST_MOUNT_CHILD':
                    this.onMountChildRequest?.((msg as any).viewId);
                    break;
                case 'REQUEST_DISMOUNT_CHILD':
                    this.onDismountChildRequest?.((msg as any).viewId);
                    break;
            }
            return;
        }

        // [RFC-001] 处理 Snapshot Fragment 推送 (新协议)
        if (isSnapshotFragment(msg)) {
            const fragment = msg as SnapshotFragmentPush;
            // console.log(`[AppWorkerHost] Received SNAPSHOT_FRAGMENT, markup length: ${fragment.markup?.length || 0}`);
            if (fragment.timestamp > this.lastDomTimestamp) {
                this.lastDomTimestamp = fragment.timestamp;
                this.snapshotFragment = {
                    markup: fragment.markup,
                    indexMap: fragment.indexMap,
                    viewTree: fragment.viewTree,  // [RFC-007]
                    timestamp: fragment.timestamp,
                };

                // [RFC-012] 仅当不抑制信号时才触发 UpdateSignal
                // suppressSignal 由 Worker 根据 signalPolicy 设置
                if (!fragment.suppressSignal) {
                    this.onUpdateRequest?.();
                }
            }
            return;
        }


    }

    private handleError(error: Error): void {
        console.error(`[AppWorkerHost] Worker ${this.appId} error:`, error);
        this.status = 'error';
    }

    private handleExit(code: number): void {
        if (code !== 0) {
            console.error(`[AppWorkerHost] Worker ${this.appId} exited with code ${code}`);
        }
        this.worker = null;
        if (this.status !== 'closed') {
            this.status = 'error';
        }
    }
}
