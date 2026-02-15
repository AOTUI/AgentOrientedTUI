/**
 * @aotui/host - GUIBridge
 * 
 * HostManager V2 → GUI 事件桥接
 * 
 * 职责:
 * - 监听 HostManager V2 的 GUI 更新事件
 * - 转换为 GUI 需要的格式
 * - 发射标准化事件
 */

import { EventEmitter } from 'events';
import type { HostManagerV2, GuiUpdateEvent } from '../core/host-manager-v2.js';
import type { ModelMessage } from 'ai';

/**
 * GUI 事件类型
 */
export interface GUIMessageEvent {
    topicId: string;
    type: 'user' | 'assistant' | 'tool';
    message: ModelMessage;
}

/**
 * GUIBridge - 事件桥接器
 */
export class GUIBridge extends EventEmitter {
    private hostManager: HostManagerV2;
    private unsubscribe: (() => void) | null = null;

    constructor(hostManager: HostManagerV2) {
        super();
        this.hostManager = hostManager;
        this.setupListeners();
    }

    /**
     * 设置监听器
     */
    private setupListeners(): void {
        // 监听 HostManager V2 的 GUI 更新事件
        this.unsubscribe = this.hostManager.onGuiUpdate((event: GuiUpdateEvent) => {
            if (event.type === 'agent_state' || !event.message) {
                return;
            }
            // 转换为 GUI 事件格式
            const guiEvent: GUIMessageEvent = {
                topicId: event.topicId,
                type: event.type,
                message: event.message,
            };

            // 发射事件
            this.emit('message:new', guiEvent);
        });
    }

    /**
     * 清理资源
     */
    dispose(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.removeAllListeners();
    }
}
