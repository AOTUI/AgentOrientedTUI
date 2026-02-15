/**
 * @aotui/host - WebSocketHandlerV2
 * 
 * 纯粹的 WebSocket 管理器
 * 
 * 职责:
 * - 管理 WebSocket 连接
 * - 解析客户端消息
 * - 调用 HostManager V2
 * - 广播事件到 GUI
 * 
 * 不再依赖:
 * - ❌ SessionManager
 * - ❌ SignalRouter
 * - ❌ AgentSession
 */

import type { WebSocket } from 'ws';
import type { HostManagerV2 } from '../core/host-manager-v2.js';
import type { GUIBridge, GUIMessageEvent } from './gui-bridge.js';
import type { ModelMessage } from 'ai';
import { Logger } from '../utils/logger.js';

/**
 * WebSocket 消息类型
 */
interface WSMessage {
    type: string;
    [key: string]: any;
}

/**
 * WebSocketHandlerV2
 */
export class WebSocketHandlerV2 {
    private hostManager: HostManagerV2;
    private guiBridge: GUIBridge;
    private logger: Logger;

    /** WebSocket 客户端订阅关系: topicId → Set<WebSocket> */
    private topicSubscribers: Map<string, Set<WebSocket>> = new Map();

    /** 客户端订阅的 topics: WebSocket → Set<topicId> */
    private clientTopics: Map<WebSocket, Set<string>> = new Map();

    constructor(hostManager: HostManagerV2, guiBridge: GUIBridge) {
        this.hostManager = hostManager;
        this.guiBridge = guiBridge;
        this.logger = new Logger('WebSocketHandlerV2');

        // 监听 GUIBridge 事件，转发到 WebSocket
        this.guiBridge.on('message:new', (event: GUIMessageEvent) => {
            this.broadcastToTopic(event.topicId, {
                type: 'new_message',
                topicId: event.topicId,
                desktopId: event.topicId, // 兼容旧 GUI
                message: this.convertToGUIMessage(event.message, event.type),
            });
        });
    }

    /**
     * 处理 WebSocket 连接
     */
    handleConnection(ws: WebSocket): void {
        this.logger.info('Client connected');

        this.clientTopics.set(ws, new Set());

        // 发送初始化消息
        this.sendToClient(ws, {
            type: 'init',
            timestamp: Date.now(),
        });

        // 监听消息
        ws.on('message', async (data: Buffer) => {
            try {
                const msg = JSON.parse(data.toString()) as WSMessage;
                await this.handleMessage(ws, msg);
            } catch (error) {
                this.logger.error('Error handling message:', error);
                this.sendToClient(ws, {
                    type: 'error',
                    message: (error as Error).message,
                });
            }
        });

        // 监听断开
        ws.on('close', () => {
            this.handleDisconnect(ws);
        });

        ws.on('error', (error) => {
            this.logger.error('WebSocket error:', error);
        });
    }

    /**
     * 处理客户端消息
     */
    private async handleMessage(ws: WebSocket, msg: WSMessage): Promise<void> {
        this.logger.debug('Received message:', msg.type);

        switch (msg.type) {
            case 'subscribe':
            case 'subscribe_session':
                this.handleSubscribe(ws, msg.topicId || msg.sessionId);
                break;

            case 'unsubscribe':
            case 'unsubscribe_session':
                this.handleUnsubscribe(ws, msg.topicId || msg.sessionId);
                break;

            case 'message':
            case 'send_message':
                await this.handleUserMessage(ws, msg);
                break;

            case 'switch_topic':
                this.handleSwitchTopic(ws, msg.topicId);
                break;

            case 'create_session':
            case 'create_desktop':
                await this.handleCreateSession(ws, msg);
                break;

            default:
                this.logger.warn('Unknown message type:', msg.type);
        }
    }

    /**
     * 处理用户消息
     */
    private async handleUserMessage(ws: WebSocket, msg: WSMessage): Promise<void> {
        const topicId = msg.topicId || msg.sessionId || msg.desktopId;
        const content = msg.content;

        if (!topicId) {
            this.sendToClient(ws, {
                type: 'error',
                message: 'Missing topicId/sessionId/desktopId',
            });
            return;
        }

        if (!content || typeof content !== 'string') {
            this.sendToClient(ws, {
                type: 'error',
                message: 'Missing or invalid content',
            });
            return;
        }

        try {
            // 1. 确保客户端订阅了该 topic
            this.handleSubscribe(ws, topicId);

            // 2. 切换到该 topic
            this.hostManager.switchTopic(topicId);

            // 3. 确认收到
            this.sendToClient(ws, {
                type: 'message_received',
                topicId,
                sessionId: topicId,
                desktopId: topicId,
                messageId: msg.messageId || `msg_${Date.now()}`,
            });

            // 4. 调用 HostManager V2（传递 topicId）
            await this.hostManager.sendUserMessage(content, topicId, msg.messageId);

            this.logger.info('User message sent', { topicId, contentLength: content.length });
        } catch (error) {
            this.logger.error('Failed to send user message:', error);
            this.sendToClient(ws, {
                type: 'error',
                message: `Failed to send message: ${(error as Error).message}`,
            });
        }
    }

    /**
     * 订阅 topic
     */
    private handleSubscribe(ws: WebSocket, topicId: string): void {
        if (!topicId) {
            this.logger.warn('Subscribe called with empty topicId');
            return;
        }

        // 添加到 topicSubscribers
        if (!this.topicSubscribers.has(topicId)) {
            this.topicSubscribers.set(topicId, new Set());
        }
        this.topicSubscribers.get(topicId)!.add(ws);

        // 添加到 clientTopics
        this.clientTopics.get(ws)?.add(topicId);

        this.logger.debug('Client subscribed to topic', { topicId });
    }

    /**
     * 取消订阅 topic
     */
    private handleUnsubscribe(ws: WebSocket, topicId: string): void {
        this.topicSubscribers.get(topicId)?.delete(ws);
        this.clientTopics.get(ws)?.delete(topicId);

        this.logger.debug('Client unsubscribed from topic', { topicId });
    }

    /**
     * 处理客户端断开
     */
    private handleDisconnect(ws: WebSocket): void {
        const topics = this.clientTopics.get(ws);
        if (topics) {
            for (const topicId of topics) {
                this.topicSubscribers.get(topicId)?.delete(ws);
            }
        }
        this.clientTopics.delete(ws);

        this.logger.info('Client disconnected');
    }

    /**
     * 切换当前 topic
     */
    private handleSwitchTopic(ws: WebSocket, topicId: string): void {
        this.hostManager.switchTopic(topicId);
        this.handleSubscribe(ws, topicId);

        this.logger.info('Switched topic', { topicId });
    }

    /**
     * 处理创建 session/desktop
     */
    private async handleCreateSession(ws: WebSocket, msg: WSMessage): Promise<void> {
        const topicId = msg.sessionId || msg.desktopId;

        if (!topicId) {
            this.sendToClient(ws, {
                type: 'error',
                message: 'Missing sessionId/desktopId',
            });
            return;
        }

        try {
            // 自动订阅
            this.handleSubscribe(ws, topicId);

            // 显式创建 Session
            await this.hostManager.ensureSessionForTopic(topicId);

            this.sendToClient(ws, {
                type: 'session_created',
                sessionId: topicId,
                desktopId: topicId,
            });

            this.logger.info('Session created', { topicId });
        } catch (error) {
            this.logger.error('Failed to create session:', error);
            this.sendToClient(ws, {
                type: 'error',
                message: `Failed to create session: ${(error as Error).message}`,
            });
        }
    }

    /**
     * 广播消息到 topic 的所有订阅者
     */
    private broadcastToTopic(topicId: string, message: any): void {
        const subscribers = this.topicSubscribers.get(topicId);
        if (!subscribers || subscribers.size === 0) {
            this.logger.debug('No subscribers for topic', { topicId });
            return;
        }

        this.logger.debug('Broadcasting to topic', { topicId, subscriberCount: subscribers.size });

        for (const client of subscribers) {
            this.sendToClient(client, message);
        }
    }

    /**
     * 发送消息到客户端
     */
    private sendToClient(ws: WebSocket, data: any): void {
        if (ws.readyState === 1 /* WebSocket.OPEN */) {
            ws.send(JSON.stringify(data));
        }
    }

    /**
     * 转换 ModelMessage 为 GUI 消息格式
     */
    private convertToGUIMessage(message: ModelMessage, type: 'user' | 'assistant' | 'tool'): any {
        // 生成 message ID
        const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const timestamp = Date.now();

        return {
            id,
            role: message.role,
            content: typeof message.content === 'string'
                ? message.content
                : JSON.stringify(message.content),
            timestamp,
            messageType: type,
        };
    }

    /**
     * 清理资源
     */
    dispose(): void {
        this.topicSubscribers.clear();
        this.clientTopics.clear();
    }
}
