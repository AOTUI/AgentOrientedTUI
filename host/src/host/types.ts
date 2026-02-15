/**
 * Host Layer Types - V2
 * 
 * 仅保留必要的类型定义，所有 V1 接口已删除
 */

import type { IDesktop, Bridge } from '@aotui/runtime';
// ✅ AI SDK v6 types (CoreMessage 在 ai 包中)

// ═══════════════════════════════════════════════════════════════
//  Session Types (Minimal - 用于兼容性)
// ═══════════════════════════════════════════════════════════════

export type SessionStatus = 'active' | 'paused' | 'destroyed';

/** 会话配置 */
export interface SessionOptions {
    /** 是否延迟创建 Desktop（首次消息时创建）*/
    lazyDesktop?: boolean;
}

// ═══════════════════════════════════════════════════════════════
//  WebSocket Message Types (用于 tRPC)
// ═══════════════════════════════════════════════════════════════

export interface WSMessage {
    type: string;
    [key: string]: unknown;
}

export interface CreateSessionMessage extends WSMessage {
    type: 'create_session';
    sessionId: string;
    options?: SessionOptions;
}

export interface SendMessageMessage extends WSMessage {
    type: 'send_message';
    sessionId: string;
    content: string;
    messageId?: string;
}

export interface SubscribeSessionMessage extends WSMessage {
    type: 'subscribe_session';
    sessionId: string;
}

export interface UnsubscribeSessionMessage extends WSMessage {
    type: 'unsubscribe_session';
    sessionId: string;
}

export interface PauseAgentMessage extends WSMessage {
    type: 'pause_agent';
    sessionId: string;
}

export interface ResumeAgentMessage extends WSMessage {
    type: 'resume_agent';
    sessionId: string;
}

export interface DestroySessionMessage extends WSMessage {
    type: 'destroy_session';
    sessionId: string;
}

export interface GetSnapshotMessage extends WSMessage {
    type: 'get_snapshot';
    sessionId: string;
}
