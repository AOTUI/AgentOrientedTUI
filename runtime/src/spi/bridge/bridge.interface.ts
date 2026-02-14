/**
 * IBridge - Agent 与 Runtime 的 I/O 边界
 * 
 * 这是 Agent（或 AgentDriver）与 AOTUI Runtime 交互的唯一接口。
 * 
 * 设计原则：
 * - 完全解耦：不暴露 Kernel 内部类型（如 SnapshotID）
 * - 可替换：支持 Mock、HTTP、WebSocket 等多种实现
 * - 简单：只提供 Agent 真正需要的能力
 * 
 * @example
 * ```typescript
 * // 获取快照
 * const snapshot = await bridge.getSnapshot();
 * console.log(snapshot.markup);
 * 
 * // 执行操作
 * const results = await bridge.execute(
 *     [{ name: 'send_message', args: { content: 'Hello' }, context: {} }],
 *     snapshot.id
 * );
 * 
 * // 订阅更新
 * const unsubscribe = bridge.subscribe(() => {
 *     console.log('Desktop updated');
 * });
 * ```
 * 
 * @module @aotui/runtime/spi/bridge
 */

import type { Operation, OperationResult } from '../core/operations.js';
import type { SnapshotID } from '../core/types.js';
import type { LLMOutputEventMeta } from '../core/llm-output.js';

// ============================================================================
// Bridge Snapshot
// ============================================================================

/**
 * Agent 可见的快照
 * 
 * 与内部的 CachedSnapshot 不同，这是面向外部消费者的简化视图。
 * 不暴露 Runtime 内部类型，只提供 Agent 需要的信息。
 */
export interface BridgeSnapshot {
    /** 快照唯一标识（用于 execute 时绑定操作） */
    readonly id: string;

    /** TUI Markdown 内容 */
    readonly markup: string;

    /** 快照生成时间戳 (ms) */
    readonly timestamp: number;
}

// ============================================================================
// Bridge Interface
// ============================================================================

/**
 * IBridge - Agent 与 Runtime 的 I/O 边界
 * 
 * 职责：
 * 1. 获取/释放 Snapshot（Agent 视图）
 * 2. 执行 Operations
 * 3. 订阅更新信号
 * 
 * 实现者：
 * - Bridge（标准实现，依赖 IKernel）
 * - MockBridge（测试用）
 * - HttpBridge（远程调用，未来扩展）
 */
export interface IBridge {
    /**
     * 获取当前 Desktop 的最新快照
     * 
     * 每次调用都会生成新的快照。调用者应在操作完成后
     * 调用 releaseSnapshot() 释放资源（可选）。
     * 
     * @returns 最新的 Desktop 快照
     */
    getSnapshot(): Promise<BridgeSnapshot>;

    /**
     * 释放快照资源
     * 
     * 可选方法。如果不调用，快照将在 TTL 后自动过期。
     * 显式释放可以更快回收内存。
     * 
     * @param snapshotId - 要释放的快照 ID
     */
    releaseSnapshot?(snapshotId: string): void;

    /**
     * 执行一批操作
     * 
     * 所有操作绑定到同一个 snapshotId，保证时间安全。
     * 当 Agent 执行操作时调用此方法。
     * 
     * @param operations - 要执行的操作列表
     * @param snapshotId - 基于哪个快照执行
     */
    executeOperations(operations: Operation[], snapshotId: SnapshotID): Promise<OperationResult[]>;

    /**
     * 推送 LLM 文本到 Runtime (RFC-011)
     * 
     * [RFC-020] 支持结构化格式，包含 reasoning 和 content
     * 用于将 LLM 的思考过程或回复文本实时推送到 Desktop。
     * 可选方法 - 老版本 Bridge 实现不受影响。
     * 
     * @param payload - 结构化内容 { reasoning?: 思考过程, content?: 最终回复 }
     * @param type - 事件类型 (complete=完整消息, chunk=流式片段预留)
     * @param meta - 可选元数据 (model, role)
     * @since RFC-011, RFC-020
     */
    pushLLMOutput?(
        payload: { reasoning?: string; content?: string },
        type: 'complete',
        meta?: LLMOutputEventMeta
    ): void;

    /**
     * 订阅 Desktop 状态变化
     * 
     * 当 Desktop 中的任何 App 触发 UpdateSignal 时，
     * 注册的 listener 会被调用。
     * 
     * 典型用法：收到更新后重新获取快照。
     * 
     * @param listener - 状态变化回调（无参数，调用者应自行获取新快照）
     * @returns 取消订阅函数
     */
    subscribe(listener: () => void): () => void;
}
