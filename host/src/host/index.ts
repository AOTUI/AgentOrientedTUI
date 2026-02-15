/**
 * Host Layer Module Entry - V2
 * 
 * V2 架构不再导出 V1 组件
 * 直接使用 core/ 下的 SessionManagerV2 和 LLMConfigService
 */

// Types
export type {
    SessionStatus,
    SessionOptions,
    WSMessage,
    CreateSessionMessage,
    SendMessageMessage,
    SubscribeSessionMessage,
    UnsubscribeSessionMessage,
    PauseAgentMessage,
    ResumeAgentMessage,
    DestroySessionMessage,
    GetSnapshotMessage
} from './types.js';

// Schemas
export { ClientMessageSchema } from './schemas.js';
