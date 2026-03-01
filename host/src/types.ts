/**
 * AOTUI System Chat - Type Definitions
 * 
 * Core data models for the chat application
 */

/**
 * Message role - who sent the message
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Message type - what kind of message this is
 */
export type MessageType = 'text' | 'reasoning' | 'tool_call' | 'tool_result' | 'snapshot';

export interface ImageAttachment {
    id: string;
    /** MIME type, e.g. image/png or application/pdf */
    mime: string;
    /** data: URL (preferred) or external URL */
    url: string;
    filename?: string;
}

/**
 * A single chat message
 */
export interface Message {
    /** Unique message ID */
    id: string;
    /** Who sent this message */
    role: MessageRole;
    /** Message content (plain text) */
    content: string;
    /** Unix timestamp when message was sent */
    timestamp: number;
    /** Message type - distinguishes text, reasoning, tool calls, etc. */
    messageType?: MessageType;
    /** Additional metadata for special message types */
    metadata?: {
        /** For reasoning messages */
        reasoning?: string;
        /** For tool call messages */
        toolName?: string;
        toolCallId?: string;
        args?: any;
        /** For tool result messages */
        result?: any;
        isError?: boolean;
        /** For snapshot messages */
        appId?: string;
        /** Generic metadata */
        attachments?: ImageAttachment[];
        [key: string]: any;
    };
}

/**
 * Chat session state
 */
export interface ChatState {
    /** List of messages in chronological order */
    messages: Message[];
    /** Current session ID (maps to Desktop ID) */
    sessionId?: string;
}

/**
 * Topic (conversation topic = Desktop)
 */
export interface Topic {
    /** Unique topic ID (maps to Desktop ID) */
    id: string;
    /** Topic title */
    title: string;
    /** Creation timestamp */
    createdAt: number;
    /** Last update timestamp */
    updatedAt: number;
    /** Desktop lifecycle status */
    status: 'hot' | 'warm' | 'cold';

    // ─────────────────────────────────────────────────────────────
    //  Chat App Enhancement Fields
    // ─────────────────────────────────────────────────────────────

    /** Agent-defined topic summary (set via update_topic operation) */
    summary?: string;
    /** Agent-defined conversation stage (e.g., "需求澄清", "任务执行", "交付确认") */
    stage?: string;
    /** Timestamp of last Agent snapshot pull (for unread tracking) */
    lastSnapshotTime?: number;
    // [RFC-025] Project Association
    projectId?: string;
    /** Topic-level model override (e.g. provider:model) */
    modelOverride?: string;
    /** Topic-level prompt override (stored as plain text snapshot) */
    promptOverride?: string;
    /** Topic-level agent override */
    agentId?: string;
    /** Topic-level capability/source control override snapshot */
    sourceControls?: {
        apps: { enabled: boolean; disabledItems: string[] };
        mcp: { enabled: boolean; disabledItems: string[] };
        skill: { enabled: boolean; disabledItems: string[] };
    };
    /** Topic-level context compaction policy override */
    contextCompaction?: {
        enabled?: boolean;
        minMessages?: number;
        keepRecentMessages?: number;
        hardFallbackThresholdTokens?: number;
    };
}

export interface Project {
    id: string;
    path: string;
    name: string;
    lastOpenedAt?: number;
    createdAt: number;
}

/**
 * External event types from Product Layer
 */
export interface UserMessageEvent {
    /** Event type identifier */
    type: 'user_message';
    /** Message data */
    message: Omit<Message, 'id'> & { id?: string };
}

/**
 * Operation parameter types
 */
export interface SendMessageArgs {
    /** Message content to send */
    content: string;
}

/**
 * Helper to create a new message
 */
export function createMessage(role: MessageRole, content: string): Message {
    return {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role,
        content,
        timestamp: Date.now()
    };
}

/**
 * Helper to ensure message has an ID
 */
export function ensureMessageId(msg: Omit<Message, 'id'> & { id?: string }): Message {
    return {
        ...msg,
        id: msg.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    };
}

// ============================================================================
// Message Parts - Structured Content Storage
// ============================================================================

/**
 * Message Part Type
 */
export type MessagePartType =
    | 'text'           // 纯文本内容
    | 'reasoning'      // LLM推理过程
    | 'tool-call'      // 工具调用
    | 'tool-result';   // 工具执行结果

/**
 * Base Message Part
 */
export interface MessagePartBase {
    id: string;
    messageId: string;
    partType: MessagePartType;
    partOrder: number;
    createdAt: number;
}

/**
 * Text Part
 */
export interface TextMessagePart extends MessagePartBase {
    partType: 'text';
    textContent: string;
}

/**
 * Reasoning Part
 */
export interface ReasoningMessagePart extends MessagePartBase {
    partType: 'reasoning';
    textContent: string;
}

/**
 * Tool Call Part
 */
export interface ToolCallMessagePart extends MessagePartBase {
    partType: 'tool-call';
    toolCallId: string;
    toolName: string;
    input: Record<string, unknown>;
}

/**
 * Tool Result Part
 */
export interface ToolResultMessagePart extends MessagePartBase {
    partType: 'tool-result';
    toolCallId: string;
    toolName: string;
    output: {
        type: 'json' | 'text' | 'execution-denied';
        value?: unknown;
        reason?: string;
    };
    isError: boolean;
}

/**
 * Union type for all parts
 */
export type MessagePart =
    | TextMessagePart
    | ReasoningMessagePart
    | ToolCallMessagePart
    | ToolResultMessagePart;

/**
 * Extended Message with parts
 */
export interface MessageWithParts extends Message {
    parts?: MessagePart[];
}
