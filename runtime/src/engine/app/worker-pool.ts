/**
 * Worker Pool Manager
 * 
 * 管理 Worker 进程池，提供 Worker 复用能力。
 * 
 * 职责:
 * 1. 维护空闲 Worker 队列
 * 2. 提供 acquire/release 接口
 * 3. 自动扩缩容 (Warmup / Idle Timeout)
 * 
 * @module @aotui/runtime/engine/worker-pool
 */

import { Worker } from 'worker_threads';
import { resolve } from 'path';
import { AOTUIError } from '../../spi/core/errors.js';
import { WORKER_DEFAULTS, type WorkerPoolConfig as SPIWorkerPoolConfig } from '../../spi/config/index.js';

export interface WorkerPoolConfig extends Partial<SPIWorkerPoolConfig> {
    /** Worker 脚本路径 */
    workerScript: string;
}

export class WorkerPool {
    private config: Required<WorkerPoolConfig>;
    private idleWorkers: Worker[] = [];
    private activeWorkerCount = 0;
    private destroying = false;

    constructor(config: WorkerPoolConfig) {
        this.config = { ...WORKER_DEFAULTS.pool, ...config } as Required<WorkerPoolConfig>;
    }

    /**
     * 预热 Worker 池
     */
    public async warmup(): Promise<void> {
        if (this.destroying) return;

        const targetSize = this.config.initialSize;
        const currentSize = this.idleWorkers.length + this.activeWorkerCount;

        if (currentSize < targetSize) {
            const needed = targetSize - currentSize;
            console.log(`[WorkerPool] Warming up ${needed} workers...`);
            for (let i = 0; i < needed; i++) {
                const worker = this.createWorker();
                this.idleWorkers.push(worker);
            }
        }
    }

    /**
     * 获取一个 Worker
     */
    public async acquire(): Promise<Worker> {
        if (this.destroying) {
            throw new AOTUIError('WORKER_TERMINATED', { reason: 'Pool is being destroyed' });
        }

        // 1. 优先复用空闲 Worker
        const worker = this.idleWorkers.pop();
        if (worker) {
            // 验证 Worker 是否存活 (简单检查 exitCode)
            if (worker.threadId < 0) { // 已退出
                return this.acquire(); // 递归重试
            }
            this.activeWorkerCount++;
            return worker;
        }

        // 2. 如果没达到最大限制，创建新 Worker
        if (this.activeWorkerCount < this.config.maxSize) {
            this.activeWorkerCount++;
            return this.createWorker();
        }

        // 3. TODO: 如果达到最大限制，等待 (暂未实现，直接创建但警告)
        console.warn('[WorkerPool] Pool exhausted, creating overflow worker');
        this.activeWorkerCount++;
        return this.createWorker();
    }

    /**
     * 归还 Worker 到池中
     * 
     * @param worker 要归还的 Worker
     * @param isValid 是否仍然有效 (如果发生致命错误，应设为 false)
     */
    public release(worker: Worker, isValid: boolean = true): void {
        this.activeWorkerCount--;

        if (this.destroying || !isValid) {
            worker.terminate();
            return;
        }

        // 如果池已满，直接销毁
        // 注意: 这里简单判断 idle + active 是否超过 max? 
        // 实际上应该判断 idle 是否过多。
        if (this.idleWorkers.length >= this.config.maxSize) {
            worker.terminate();
            return;
        }

        this.idleWorkers.push(worker);
    }

    /**
     * 销毁池
     */
    public async destroy(): Promise<void> {
        this.destroying = true;
        await Promise.all(this.idleWorkers.map(w => w.terminate()));
        this.idleWorkers = [];
    }

    private createWorker(): Worker {
        const worker = new Worker(this.config.workerScript, {
            workerData: {
                // 可以在这里传递通用配置
            }
        });

        // 监听错误，防止僵尸进程
        worker.on('error', (err) => {
            console.error('[WorkerPool] Worker error:', err);
            // 移除引用
            const idx = this.idleWorkers.indexOf(worker);
            if (idx >= 0) {
                this.idleWorkers.splice(idx, 1);
            }
        });

        worker.on('exit', (code) => {
            // 移除引用
            const idx = this.idleWorkers.indexOf(worker);
            if (idx >= 0) {
                this.idleWorkers.splice(idx, 1);
            }
        });

        return worker;
    }
}
