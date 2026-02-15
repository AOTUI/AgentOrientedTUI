/**
 * System-Chat Core Module
 * 
 * Core 负责：
 * - 业务逻辑收口 (消息存储、LLM 调用)
 * - 数据读写
 * - 双向推送 (TUI App + GUI App)
 * - Desktop 生命周期管理 (通过 Kernel)
 * 
 * 这是 Checkpoint 1 的空入口文件，后续会逐步添加功能。
 */

export { MessageServiceV2 } from './message-service-v2.js';
export { projectService } from './project-service.js';
export { desktopManager, desktopManagerReady } from './desktop-manager.js';
export { pushService } from './push-service.js';
export * from './topic-service.js';
