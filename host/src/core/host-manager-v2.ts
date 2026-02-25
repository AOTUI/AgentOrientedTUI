/**
 * @aotui/host - HostManager V2 (Refactored)
 * 
 * 简化为委托模式，核心逻辑移到 SessionManagerV3
 * 
 * 职责:
 * - 委托给 SessionManagerV3
 * - 转发 GUI 事件
 * - 提供向后兼容的 API
 * - 管理当前 Topic 状态
 * 
 * 设计变更:
 * - ❌ 移除 AgentDriver 创建逻辑
 * - ❌ 移除 HostDrivenSource 创建逻辑
 * - ✅ 委托给 SessionManagerV3
 * - ✅ 保留向后兼容 API
 */

import type { ModelMessage } from 'ai';
import type { LLMConfig } from '@aotui/agent-driver-v2';
import type { IDesktop, IKernel } from '@aotui/runtime/spi';
import { MessageServiceV2 } from './message-service-v2.js';
import { Logger } from '../utils/logger.js';
import { EventEmitter } from 'events';
import { LLMConfigService } from './llm-config-service.js';
import { SessionManagerV3 } from './session-manager-v3.js';
import type { ModelRegistry } from '../services/model-registry.js';
import type { GuiUpdateEvent } from '../types/session.js';

/**
 * Re-export GuiUpdateEvent for backward compatibility
 */
export type { GuiUpdateEvent };

/**
 * HostManager V2 (Simplified)
 */
export class HostManagerV2 {
    private sessionManager: SessionManagerV3 | null = null;
    private messageService: MessageServiceV2;
    private currentTopicId: string;
    private logger: Logger;
    private guiEventEmitter: EventEmitter;
    private llmConfigService: LLMConfigService;
    private kernel: IKernel | null = null;

    private desktopManager: import('./desktop-manager.js').DesktopManager | null = null;

    constructor(defaultTopicId: string, modelRegistry: ModelRegistry) {
        this.currentTopicId = defaultTopicId;
        this.messageService = new MessageServiceV2();
        this.logger = new Logger('HostManagerV2');
        this.guiEventEmitter = new EventEmitter();
        this.llmConfigService = new LLMConfigService(modelRegistry);
    }

    /**
     * 初始化 AgentDriver
     * 
     * 使用 SessionManagerV3 替代直接创建 AgentDriver
     */
    async initAgentDriver(
        aotuiDesktop: IDesktop,
        kernel: IKernel,
        desktopManager: import('./desktop-manager.js').DesktopManager,
        llmConfigOverride?: LLMConfig
    ): Promise<void> {
        this.kernel = kernel;
        this.desktopManager = desktopManager;
        
        // 创建 SessionManagerV3
        this.sessionManager = new SessionManagerV3(
            kernel,
            desktopManager,
            this.llmConfigService,
            this.messageService
        );
        
        // 监听 SessionManager 事件
        this.sessionManager.on('message', (event: GuiUpdateEvent) => {
            console.log(`[HostManagerV2] Forward message: topic=${event.topicId}, type=${event.type}, listeners=${this.guiEventEmitter.listenerCount('gui-update')}`);
            
            // ✅ 不过滤 topicId，tRPC 订阅层已按 topicId 过滤
            // 否则当 GUI 订阅了某个 topic 但 currentTopicId 还没切换时，事件会丢失
            this.guiEventEmitter.emit('gui-update', {
                type: event.type,
                message: event.message,
                topicId: event.topicId,
                state: (event as { state?: string }).state,
            });
        });
        
        // ✅ 修复: 不再提前创建 Session，等 GUI 连接时按需创建
        // 这样避免创建用户不会使用的 default_topic Session
        
        this.logger.info('AgentDriver initialized via SessionManagerV3 (lazy session creation)');
    }

    /**
     * 用户发送消息
     * 
     * @param content - 消息内容
     * @param topicId - Topic ID（可选，默认使用 currentTopicId）
     */
    async sendUserMessage(content: string, topicId?: string, messageId?: string): Promise<void> {
        if (!this.sessionManager) {
            throw new Error('SessionManager not initialized. Call initAgentDriver first.');
        }
        
        const targetTopicId = topicId || this.currentTopicId;
        await this.sessionManager.sendMessage(targetTopicId, content, messageId);
    }

    /**
     * 切换主题
     */
    async switchTopic(topicId: string): Promise<void> {
        if (!this.sessionManager) {
            throw new Error('SessionManager not initialized. Call initAgentDriver first.');
        }
        
        this.currentTopicId = topicId;
        this.logger.info('Switched topic', { topicId });
    }

    /**
     * 为指定 Topic 创建或获取 Session
     * 
     * 用于 REST API 创建 Topic 时初始化 Session
     */
    async ensureSessionForTopic(topicId: string): Promise<void> {
        if (!this.sessionManager) {
            throw new Error('SessionManager not initialized. Call initAgentDriver first.');
        }
        
        await this.sessionManager.ensureSession(topicId);
        this.logger.info('Session initialized for topic', { topicId });
    }

    /**
     * 暂停指定 Topic 的 AgentDriver
     */
    pauseAgent(topicId: string): void {
        if (!this.sessionManager) return;
        this.sessionManager.pauseSession(topicId);
    }

    /**
     * 恢复指定 Topic 的 AgentDriver
     */
    resumeAgent(topicId: string): void {
        if (!this.sessionManager) return;
        this.sessionManager.resumeSession(topicId);
    }

    /**
     * Gracefully shutdown a Session without deleting data
     */
    async shutdownSession(topicId: string): Promise<void> {
        if (!this.sessionManager) {
            throw new Error('SessionManager not initialized. Call initAgentDriver first.');
        }

        await this.sessionManager.shutdownSession(topicId);
        this.logger.info('Session shutdown', { topicId });
    }

    /**
     * 监听 GUI 更新事件
     */
    onGuiUpdate(callback: (event: any) => void): () => void {
        this.guiEventEmitter.on('gui-update', callback);
        return () => this.guiEventEmitter.off('gui-update', callback);
    }

    /**
     * 获取消息
     */
    getMessages(topicId?: string): ModelMessage[] {
        return this.messageService.getMessages(topicId || this.currentTopicId);
    }

    /**
     * 获取指定 Topic 的最新 Snapshot（用于 GUI TUI View）
     */
    async getSnapshot(topicId: string): Promise<{ markup: string | null; structured?: unknown } | null> {
        if (!this.sessionManager || !this.kernel) {
            throw new Error('SessionManager not initialized. Call initAgentDriver first.');
        }

        await this.sessionManager.ensureSession(topicId);

        const snapshot = await this.kernel.acquireSnapshot(topicId as any);
        try {
            return {
                markup: snapshot.markup ?? null,
                structured: snapshot.structured,
            };
        } finally {
            this.kernel.releaseSnapshot(snapshot.id);
        }
    }

    /**
     * 获取 LLM 配置服务
     * 
     * 允许外部访问配置管理
     */
    getLLMConfigService(): LLMConfigService {
        return this.llmConfigService;
    }
    
    /**
     * 获取 SessionManager (用于高级功能)
     */
    getSessionManager(): SessionManagerV3 | null {
        return this.sessionManager;
    }

    getSourceControlState(topicId: string): {
        apps: { enabled: boolean; disabledItems: string[] };
        mcp: { enabled: boolean; disabledItems: string[] };
        skill: { enabled: boolean; disabledItems: string[] };
    } {
        if (!this.sessionManager) {
            throw new Error('SessionManager not initialized. Call initAgentDriver first.');
        }

        return this.sessionManager.getSourceControlState(topicId);
    }

    syncTopicPromptOverride(topicId: string): void {
        if (!this.sessionManager) return;
        this.sessionManager.syncTopicPromptOverride(topicId);
    }

    setSourceEnabled(topicId: string, source: 'apps' | 'mcp' | 'skill', enabled: boolean): void {
        if (!this.sessionManager) {
            throw new Error('SessionManager not initialized. Call initAgentDriver first.');
        }

        this.sessionManager.setSourceEnabled(topicId, source, enabled);
    }

    setSourceItemEnabled(topicId: string, source: 'apps' | 'mcp' | 'skill', itemName: string, enabled: boolean): void {
        if (!this.sessionManager) {
            throw new Error('SessionManager not initialized. Call initAgentDriver first.');
        }

        this.sessionManager.setSourceItemEnabled(topicId, source, itemName, enabled);
    }

    /**
     * 清理资源
     */
    async dispose(): Promise<void> {
        if (this.sessionManager) {
            await this.sessionManager.cleanup();
        }
        this.guiEventEmitter.removeAllListeners();
        this.logger.info('HostManagerV2 disposed');
    }
}

