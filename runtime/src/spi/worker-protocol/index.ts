/**
 * Worker Protocol - SPI Entry Point
 * 
 * 统一的 Worker IPC 协议定义。
 * 
 * 这是 AppWorkerHost (主线程) 和 Worker Runtime (工作线程) 之间的契约。
 * 
 * ## 职责边界
 * 
 * - **Runtime (AppWorkerHost)**: 发送命令消息，接收响应/推送
 * - **Worker Runtime**: 接收命令消息，发送响应/推送
 * 
 * ## 使用方式
 * 
 * ```typescript
 * // Runtime 端 (AppWorkerHost)
 * import type { MainToWorkerMessage, WorkerToMainMessage } from '@aotui/runtime/spi';
 * 
 * // Worker 端 (worker-runtime)
 * import type { MainToWorkerMessage, WorkerToMainMessage } from '../spi/worker-protocol/index.js';
 * ```
 * 
 * @module @aotui/runtime/spi/worker-protocol
 */

// Type definitions
export * from './types.js';

// Message definitions
export * from './messages.js';
