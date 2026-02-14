import { IKernel, Operation, OperationResult, SnapshotID, DesktopID, UpdateSignal, CachedSnapshot, IBridge, BridgeSnapshot } from '../../spi/index.js';
import { BRIDGE_DEFAULTS } from '../../spi/config/index.js';

/**
 * Bridge - Runtime 与外部的 I/O 边界
 * 
 * 实现 IBridge 接口，作为 Agent（或 AgentDriver）与 Runtime 交互的标准实现。
 * 
 * 职责:
 * 1. 获取/释放 Snapshot
 * 2. 执行 Operations
 * 3. 订阅 UpdateSignal
 * 
 * [Phase 6] 增强以支持 @aotui/agent-driver 集成
 * [M2 FIX] 实现 IBridge 接口，支持 Mock 和替换
 */
export class Bridge implements IBridge {
    private activeSnapshotId: SnapshotID | null = null;
    private signalListeners = new Set<() => void>();
    private debounceTimer: NodeJS.Timeout | null = null;
    private pendingSignal: UpdateSignal | null = null;
    private debounceMs: number;

    constructor(
        private kernel: IKernel,
        private desktopId: DesktopID,
        private ownerId: string,
        options?: { debounceMs?: number }
    ) {
        this.debounceMs = options?.debounceMs ?? BRIDGE_DEFAULTS.debounceMs;
    }


    // ═══════════════════════════════════════════════════════════════
    //  Snapshot Management (IBridge 兼容)
    // ═══════════════════════════════════════════════════════════════

    /**
     * 获取 Desktop 快照
     * 
     * @alias getSnapshot (保持向后兼容)
     */
    async acquireSnapshot(): Promise<CachedSnapshot> {
        const newSnap = await this.kernel.acquireSnapshot(this.desktopId);

        if (this.activeSnapshotId && this.activeSnapshotId !== newSnap.id) {
            this.kernel.releaseSnapshot(this.activeSnapshotId);
        }

        this.activeSnapshotId = newSnap.id;
        return newSnap;
    }

    /**
     * [IBridge] 获取 Desktop 快照
     * 
     * 适配 IBridge 接口，返回简化的 BridgeSnapshot。
     */
    async getSnapshot(): Promise<BridgeSnapshot> {
        const cached = await this.acquireSnapshot();
        return {
            id: cached.id,
            markup: cached.markup,
            timestamp: Date.now()
        };
    }

    /**
     * 释放快照
     */
    releaseSnapshot(snapshotId: string): void {
        if (this.activeSnapshotId === snapshotId) {
            this.activeSnapshotId = null;
        }
        this.kernel.releaseSnapshot(snapshotId as SnapshotID);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Operation Execution
    // ═══════════════════════════════════════════════════════════════

    /**
     * 批量执行 Operations (IBridge 兼容)
     * 
     * 调用者提供完整的 Operation[] 和 snapshotId
     */
    /**
     * [IBridge] 执行一批操作
     * 
     * 适配 IBridge 接口。
     */
    async execute(
        operations: Operation[],
        snapshotId: string
    ): Promise<OperationResult[]> {
        return this.executeOperations(operations, snapshotId as SnapshotID);
    }

    /**
     * 批量执行 Operations (内部实现)
     * 
     * 调用者提供完整的 Operation[] 和 snapshotId
     */
    async executeOperations(
        operations: Operation[],
        snapshotId: SnapshotID
    ): Promise<OperationResult[]> {
        const results: OperationResult[] = [];

        // [Fix] Auto-acquire lock for the operations batch
        // This ensures the Agent (or Bridge owner) has permission to execute.
        this.kernel.acquireLock(this.desktopId, this.ownerId);

        try {
            for (const op of operations) {
                // 确保 snapshotId 一致
                const operation: Operation = {
                    ...op,
                    context: {
                        ...op.context,
                        snapshotId
                    }
                };

                try {
                    const result = await this.kernel.execute(this.desktopId, operation, this.ownerId);
                    results.push(result);
                } catch (err) {
                    results.push({
                        success: false,
                        error: {
                            code: 'E_EXECUTION',
                            message: err instanceof Error ? err.message : String(err)
                        }
                    });
                }
            }
        } finally {
            // [Fix] Always release lock after batch execution
            this.kernel.releaseLock(this.desktopId, this.ownerId);
        }

        return results;
    }



    // ═══════════════════════════════════════════════════════════════
    //  Signal Handling
    // ═══════════════════════════════════════════════════════════════

    /**
     * [IBridge] 订阅 Desktop 状态变化
     * 
     * 适配 IBridge 接口。
     */
    subscribe(listener: () => void): () => void {
        return this.onUpdate(listener);
    }

    /**
     * 订阅 Desktop 更新信号
     * 
     * @returns 取消订阅函数
     */
    onUpdate(listener: () => void): () => void {
        this.signalListeners.add(listener);
        return () => {
            this.signalListeners.delete(listener);
        };
    }

    /**
     * 处理来自 Desktop 的信号 (带防抖)
     */
    handleSignal(signal: UpdateSignal): void {
        this.pendingSignal = signal;

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.emitSignal();
        }, this.debounceMs);
    }

    private emitSignal(): void {
        if (this.pendingSignal) {
            this.signalListeners.forEach(l => l());
            this.pendingSignal = null;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  [RFC-011] LLM Output Channel
    // ═══════════════════════════════════════════════════════════════

    /**
     * [RFC-011] Push LLM text to Runtime's LLMOutputChannelService
     * [RFC-020] Now accepts structured payload with reasoning and content
     * 
     * Routes through Kernel to Desktop's llmOutputChannel.
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
        console.log('[Bridge] pushLLMOutput called:', {
            reasoningLength: payload.reasoning?.length ?? 0,
            contentLength: payload.content?.length ?? 0,
            type,
            model: meta?.model
        });

        // Access Desktop via Kernel
        const desktop = this.kernel.getDesktop(this.desktopId);
        if (!desktop) {
            console.warn('[Bridge] Desktop not found');
            return;
        }

        // 1. Push to LLMOutputChannel (for local subscribers)
        if ((desktop as any).getLLMOutputChannel) {
            const channel = (desktop as any).getLLMOutputChannel();
            channel.push(this.desktopId, payload, { ...meta, type });
        }

        // 2. Broadcast to all Workers via IPC
        if ((desktop as any).broadcastLLMOutput) {
            (desktop as any).broadcastLLMOutput(payload, type, meta);
        }

        console.log('[Bridge] LLM text pushed and broadcasted');
    }
}

