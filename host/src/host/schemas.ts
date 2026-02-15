import { z } from 'zod';

/**
 * RFC-024: WebSocket 客户端消息 Schema
 * 
 * 定义从 GUI 发送到 Host 的所有合法消息格式
 */
export const ClientMessageSchema = z.discriminatedUnion('type', [
    // 订阅会话信号
    z.object({
        type: z.literal('subscribe'),
        sessionId: z.string()
    }),
    
    // 取消订阅
    z.object({
        type: z.literal('unsubscribe'),
        sessionId: z.string()
    }),

    // 发送用户消息
    z.object({
        type: z.literal('message'),
        sessionId: z.string(),
        content: z.string(),
        messageId: z.string().optional()
    }),

    // Agent 控制指令
    z.object({
        type: z.literal('control'),
        sessionId: z.string(),
        action: z.enum(['pause', 'resume'])
    })
]);

/** 客户端消息类型推断 */
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/**
 * 响应消息 Schema (可选，用于内部校验)
 */
export const HostResponseSchema = z.object({
    type: z.string(),
    sessionId: z.string().optional(),
    success: z.boolean().optional(),
    error: z.string().optional(),
    data: z.any().optional()
});
