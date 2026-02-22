/**
 * @aotui/host - Session Types
 * 
 * SessionManagerV3 的核心类型定义
 * 
 * 设计原则:
 * - **Topic-Desktop 一一对应**: 每个 Topic 对应一个 Desktop
 * - **完整生命周期**: 创建、活跃、空闲、销毁
 * - **资源管理**: 自动清理空闲 Session
 */

import type { IDesktop } from '@aotui/runtime';
import type { AgentDriverV2 } from '@aotui/agent-driver-v2';
import type { SystemPromptDrivenSource } from '../adapters/system-prompt-source.js';
import type { AOTUIDrivenSource } from '@aotui/runtime/adapters';
import type { HostDrivenSourceV2 } from '../adapters/host-driven-source.js';
import type { McpDrivenSource } from '../mcp/source.js';
import type { ModelMessage } from 'ai';

/**
 * Session 状态
 */
export type SessionState = 'active' | 'paused' | 'destroyed';

/**
 * Session 数据结构
 * 
 * 每个 Session 包含:
 * - Desktop (AOTUI Runtime)
 * - AgentDriver (LLM Orchestrator)
 * - DrivenSources (SystemPrompt + AOTUI + Host)
 * - 生命周期状态
 */
export interface Session {
    /** Topic ID (同时也是 Desktop ID) */
    topicId: string;

    /** AOTUI Desktop 实例 */
    desktop: IDesktop;

    /** AgentDriver 实例 */
    agentDriver: AgentDriverV2;

    /** DrivenSources */
    sources: {
        systemPrompt: SystemPromptDrivenSource;
        aotui: AOTUIDrivenSource;
        host: HostDrivenSourceV2;
        mcp: McpDrivenSource;
    };

    /** Session 状态 */
    state: SessionState;

    /** 创建时间 (Unix timestamp ms) */
    createdAt: number;

    /** 最后访问时间 (Unix timestamp ms) */
    lastAccessTime: number;
}

/**
 * SessionManager 配置
 */
export interface SessionManagerConfig {
    /** 最大并发会话数，默认 10 */
    maxSessions?: number;

    /** 空闲超时时间 (ms)，默认 30 分钟 */
    idleTimeoutMs?: number;

    /** 清理任务间隔 (ms)，默认 5 分钟 */
    cleanupIntervalMs?: number;
}

/**
 * GUI 更新事件
 */
export interface GuiUpdateEvent {
    /** Topic ID */
    topicId: string;

    /** 事件类型 */
    type: 'assistant' | 'tool' | 'user' | 'agent_state';

    /** 消息内容 (AI SDK v6 ModelMessage) */
    message?: ModelMessage;

    /** Agent 状态 (thinking/executing/idle) */
    state?: string;
}
