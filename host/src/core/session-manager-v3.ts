/**
 * @aotui/host - SessionManagerV3
 * 
 * Topic-Desktop-AgentDriver 生命周期管理器
 * 
 * 职责:
 * - 管理 Topic 和 Desktop 的一一对应关系
 * - 按需创建 Session (Desktop + AgentDriver + DrivenSources)
 * - 自动清理空闲 Session
 * - 并发限制和资源管理
 * 
 * 设计原则:
 * - **DIP**: 依赖 IKernel 接口，不依赖具体实现
 * - **SRP**: 只负责 Session 生命周期，不负责业务逻辑
 * - **资源管理**: 空闲清理 + 并发限制，防止内存泄漏
 */

import type { IKernel, IDesktop } from '@aotui/runtime';
import { AOTUIDrivenSource } from '@aotui/runtime/adapters';
import { AgentDriverV2 } from '@aotui/agent-driver-v2';
import type { ModelMessage } from 'ai';
import { EventEmitter } from 'events';
import type { LLMConfigService } from './llm-config-service.js';
import type { MessageServiceV2 } from './message-service-v2.js';
import { HostDrivenSourceV2 } from '../adapters/host-driven-source.js';
import { SystemPromptDrivenSource } from '../adapters/system-prompt-source.js';
import { McpDrivenSource } from '../mcp/source.js';
import type { Session, SessionManagerConfig, GuiUpdateEvent } from '../types/session.js';
import { Logger } from '../utils/logger.js';
import type { DesktopManager } from './desktop-manager.js';
import * as db from '../db/index.js';
import { projectService } from './project-service.js';

/**
 * SessionManagerV3
 * 
 * 管理 Topic-Desktop-AgentDriver 的完整生命周期
 */
export class SessionManagerV3 extends EventEmitter {
    private sessions: Map<string, Session> = new Map();
    private inFlightSessions: Map<string, Promise<Session>> = new Map();
    private kernel: IKernel;
    private desktopManager: DesktopManager;
    private llmConfigService: LLMConfigService;
    private messageService: MessageServiceV2;
    private logger: Logger;
    private cleanupTimer: NodeJS.Timeout | null = null;

    // 配置
    private config: Required<SessionManagerConfig>;

    constructor(
        kernel: IKernel,
        desktopManager: DesktopManager,
        llmConfigService: LLMConfigService,
        messageService: MessageServiceV2,
        config?: SessionManagerConfig
    ) {
        super();
        this.kernel = kernel;
        this.desktopManager = desktopManager;
        this.llmConfigService = llmConfigService;
        this.messageService = messageService;
        this.logger = new Logger('SessionManagerV3');

        // 合并默认配置
        this.config = {
            maxSessions: config?.maxSessions ?? 10,
            idleTimeoutMs: config?.idleTimeoutMs ?? 30 * 60 * 1000, // 30分钟
            cleanupIntervalMs: config?.cleanupIntervalMs ?? 5 * 60 * 1000, // 5分钟
        };

        // 启动定期清理任务
        this.startCleanupTask();

        this.logger.info('SessionManagerV3 initialized', {
            maxSessions: this.config.maxSessions,
            idleTimeoutMs: this.config.idleTimeoutMs,
        });
    }

    /**
     * 获取 Session (不创建)
     */
    getSession(topicId: string): Session | undefined {
        const session = this.sessions.get(topicId);
        if (session) {
            session.lastAccessTime = Date.now();
            this.logger.debug('Session reused', { topicId });
        }
        return session;
    }

    /**
     * 确保 Session 存在（幂等 + 并发去重）
     */
    async ensureSession(topicId: string): Promise<Session> {
        const existing = this.getSession(topicId);
        if (existing) {
            return existing;
        }

        const inFlight = this.inFlightSessions.get(topicId);
        if (inFlight) {
            return inFlight;
        }

        if (this.sessions.size >= this.config.maxSessions) {
            this.logger.warn('Max sessions reached, evicting oldest', {
                maxSessions: this.config.maxSessions,
                currentSessions: this.sessions.size,
            });
            await this.evictOldestSession();
        }

        const createPromise = this.createSession(topicId)
            .then((session) => {
                this.sessions.set(topicId, session);

                this.logger.info('Session created', {
                    topicId,
                    totalSessions: this.sessions.size,
                });

                return session;
            })
            .finally(() => {
                this.inFlightSessions.delete(topicId);
            });

        this.inFlightSessions.set(topicId, createPromise);
        return createPromise;
    }

    /**
     * 创建 Session
     * 
     * @param topicId - Topic ID
     * @returns Session 实例
     */
    private async createSession(topicId: string): Promise<Session> {
        // 1. 创建 Desktop（通过 DesktopManager，确保 Apps 被安装）
        const desktopId = topicId as any; // Topic ID = Desktop ID

        const topic = db.getTopic(topicId);
        const projectPath = topic?.projectId
            ? projectService.getProject(topic.projectId)?.path
            : undefined;
        const appConfig = projectPath
            ? { projectPath, workspace_dir_path: projectPath }
            : undefined;

        let desktop: IDesktop;
        try {
            // ✅ 使用 DesktopManager.createDesktop() 而非直接调用 kernel
            // 这样可以自动安装 AppRegistry 中的所有 Apps
            const info = await this.desktopManager.createDesktop(desktopId, appConfig);
            desktop = this.kernel.getDesktop(info.desktopId)!;

            this.logger.debug('Desktop created with apps', {
                desktopId: info.desktopId,
                thirdPartyAppCount: info.thirdPartyAppCount,
                projectPath,
            });
        } catch (error) {
            this.logger.error('Failed to create desktop', { topicId, error });
            throw new Error(`Failed to create desktop for topic: ${topicId}`);
        }

        // 2. 获取 LLM 配置
        const llmConfig = await this.llmConfigService.getActiveLLMConfig();
        if (!llmConfig) {
            throw new Error('No active LLM config found. Please configure an LLM provider first.');
        }

        // 3. 创建 DrivenSources
        const systemPromptSource = new SystemPromptDrivenSource({
            systemPrompt: this.getSystemPrompt(),
        });

        const aotuiSource = new AOTUIDrivenSource(desktop, this.kernel, {
            includeInstruction: true, // 注入 AOTUI System Instruction
        });

        const hostSource = new HostDrivenSourceV2(
            this.messageService,
            topicId
        );

        const mcpDrivenSource = new McpDrivenSource();

        // 4. 创建 AgentDriver
        const { providerId, modelId, modelLabel } = (() => {
            const rawModel = llmConfig.model;
            const inferredProvider = llmConfig.provider?.id;
            const colonIndex = rawModel.indexOf(':');
            if (colonIndex > 0) {
                const provider = rawModel.slice(0, colonIndex);
                const model = rawModel.slice(colonIndex + 1);
                return {
                    providerId: inferredProvider ?? provider,
                    modelId: model,
                    modelLabel: model,
                };
            }
            if (rawModel.includes('@')) {
                const [model, provider] = rawModel.split('@');
                return {
                    providerId: inferredProvider ?? provider,
                    modelId: model,
                    modelLabel: model,
                };
            }
            return {
                providerId: inferredProvider,
                modelId: rawModel,
                modelLabel: rawModel,
            };
        })();

        const agentDriver = new AgentDriverV2({
            sources: [
                systemPromptSource, // timestamp=0
                aotuiSource,        // timestamp=1 (instruction) + dynamic (state)
                hostSource,         // timestamp=now (user/assistant messages)
                mcpDrivenSource as any,    // Custom MCP Tools
            ],
            llm: llmConfig,
            onAssistantMessage: (message) => {
                this.handleMessage(topicId, 'assistant', message);
            },
            onToolResult: (message) => {
                this.handleMessage(topicId, 'tool', message);
            },
            onLLMUsage: (usage) => {
                const payload = { content: undefined, reasoning: undefined };
                const meta = {
                    usage,
                    model: modelLabel,
                    providerId,
                    modelId,
                };

                if ((desktop as any).getLLMOutputChannel) {
                    const channel = (desktop as any).getLLMOutputChannel();
                    channel.push(desktop.id, payload, meta);
                }

                if ((desktop as any).broadcastLLMOutput) {
                    (desktop as any).broadcastLLMOutput(payload, 'complete', meta);
                }
            },
            onStateChange: (oldState, newState) => {
                this.logger.debug('AgentDriver state changed', {
                    topicId,
                    oldState,
                    newState,
                });

                const event: GuiUpdateEvent = {
                    topicId,
                    type: 'agent_state',
                    state: newState,
                };
                this.emit('message', event);
            },
        });

        // 5. 启动 AgentDriver
        agentDriver.start();

        this.logger.info('Session components initialized', {
            topicId,
            desktopId,
            agentDriverId: agentDriver.getId(),
            sources: ['SystemPrompt', 'AOTUI', 'Host'],
        });

        return {
            topicId,
            desktop,
            agentDriver,
            sources: {
                systemPrompt: systemPromptSource,
                aotui: aotuiSource,
                host: hostSource,
                mcp: mcpDrivenSource,
            },
            state: 'active',
            createdAt: Date.now(),
            lastAccessTime: Date.now(),
        };
    }

    /**
     * 发送用户消息
     * 
     * @param topicId - Topic ID
     * @param content - 消息内容
     */
    async sendMessage(topicId: string, content: string, messageId?: string): Promise<void> {
        const session = await this.ensureSession(topicId);

        // 1. 保存到数据库
        const userMessage: ModelMessage = {
            role: 'user',
            content,
        } as ModelMessage & { id?: string; timestamp?: number };
        if (messageId) {
            (userMessage as any).id = messageId;
        }
        (userMessage as any).timestamp = Date.now();
        this.messageService.addMessage(topicId, userMessage);

        // 2. 通知 HostDrivenSource
        session.sources.host.notifyNewMessage();

        // 3. 触发 GUI 更新事件
        const event: GuiUpdateEvent = {
            topicId,
            type: 'user',
            message: userMessage,
        };
        this.emit('message', event);

        this.logger.debug('User message sent', { topicId, contentLength: content.length });
    }

    /**
     * 切换 Topic
     * 
     * @param topicId - Topic ID
     * @returns Session 实例
     */
    async switchTopic(topicId: string): Promise<Session | null> {
        return this.getSession(topicId) || null;
    }

    /**
     * 销毁 Session
     * 
     * @param topicId - Topic ID
     */
    async destroySession(topicId: string): Promise<void> {
        const session = this.sessions.get(topicId);
        if (!session) {
            this.logger.warn('Attempted to destroy non-existent session', { topicId });
            return;
        }

        try {
            // 1. 停止 AgentDriver
            session.agentDriver.stop();

            // 2. 销毁 Desktop
            await this.kernel.destroyDesktop(session.desktop.id);

            // 3. 更新状态
            session.state = 'destroyed';

            // 4. 清理引用
            this.sessions.delete(topicId);
            this.inFlightSessions.delete(topicId);

            this.logger.info('Session destroyed', {
                topicId,
                remainingSessions: this.sessions.size,
            });
        } catch (error) {
            this.logger.error('Failed to destroy session', { topicId, error });
            // 即使失败也要清理引用
            this.sessions.delete(topicId);
            this.inFlightSessions.delete(topicId);
        }
    }

    /**
     * Gracefully shutdown a Session
     * 
     * Uses kernel.gracefulShutdown to allow apps to flush state
     * without deleting persistent data.
     */
    async shutdownSession(topicId: string): Promise<void> {
        const session = this.sessions.get(topicId);
        if (!session) {
            this.logger.warn('Attempted to shutdown non-existent session', { topicId });
            return;
        }

        try {
            session.agentDriver.stop();
            await this.kernel.gracefulShutdown(session.desktop.id, { timeoutMs: 5000 });
            session.state = 'destroyed';
            this.sessions.delete(topicId);
            this.inFlightSessions.delete(topicId);

            this.logger.info('Session gracefully shutdown', {
                topicId,
                remainingSessions: this.sessions.size,
            });
        } catch (error) {
            this.logger.error('Failed to shutdown session', { topicId, error });
            this.sessions.delete(topicId);
            this.inFlightSessions.delete(topicId);
        }
    }

    /**
     * 驱逐最旧的 Session
     */
    private async evictOldestSession(): Promise<void> {
        let oldestTopicId: string | null = null;
        let oldestTime = Infinity;

        for (const [topicId, session] of this.sessions.entries()) {
            if (session.lastAccessTime < oldestTime) {
                oldestTime = session.lastAccessTime;
                oldestTopicId = topicId;
            }
        }

        if (oldestTopicId) {
            const idleTime = Date.now() - oldestTime;
            this.logger.warn('Evicting oldest session', {
                topicId: oldestTopicId,
                idleTimeMs: idleTime,
            });
            await this.destroySession(oldestTopicId);
        }
    }

    /**
     * 定期清理空闲 Session
     */
    private startCleanupTask(): void {
        this.cleanupTimer = setInterval(async () => {
            const now = Date.now();
            const toDestroy: string[] = [];

            for (const [topicId, session] of this.sessions.entries()) {
                const idleTime = now - session.lastAccessTime;
                if (idleTime > this.config.idleTimeoutMs) {
                    toDestroy.push(topicId);
                }
            }

            if (toDestroy.length > 0) {
                this.logger.info('Cleaning up idle sessions', {
                    count: toDestroy.length,
                    topics: toDestroy,
                });

                for (const topicId of toDestroy) {
                    await this.destroySession(topicId);
                }
            }
        }, this.config.cleanupIntervalMs);

        // 避免阻止进程退出
        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
    }

    /**
     * 停止清理任务
     */
    stopCleanupTask(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    /**
     * 处理 AgentDriver 消息
     * 
     * @param topicId - Topic ID
     * @param type - 消息类型
     * @param message - 消息内容
     */
    private handleMessage(
        topicId: string,
        type: 'assistant' | 'tool',
        message: ModelMessage
    ): void {
        // 🔍 打印消息详情
        console.log('\n=== SessionManagerV3.handleMessage ===');
        console.log('Topic ID:', topicId);
        console.log('Type:', type);
        console.log('Role:', message?.role);
        console.log('Content type:', Array.isArray(message?.content) ? 'parts' : typeof message?.content);
        if (Array.isArray(message?.content)) {
            const partTypes = message.content.map((part: any) => part?.type).filter(Boolean);
            console.log('Part types:', partTypes.join(', '));
        }
        console.log('Message:', JSON.stringify(message, null, 2));
        console.log('Listeners count:', this.listenerCount('message'));
        console.log('=====================================\n');

        // 1. 保存到数据库
        this.messageService.addMessage(topicId, message);

        // 2. 触发 GUI 更新（通过事件总线）
        const event: GuiUpdateEvent = {
            topicId,
            type,
            message, // 直接传递 message，不要重新构造
        };
        this.emit('message', event);

        this.logger.debug('Message handled', {
            topicId,
            type,
            role: message.role,
        });
    }

    /**
     * 获取系统提示词
     * 
     * @returns 系统提示词内容
     */
    private getSystemPrompt(): string {
        return `You are an AI assistant with access to a TUI (Text User Interface) desktop.

Your capabilities:
- Access and interact with applications through text-based commands
- Execute tools to read, write, and manage files
- Use the AOTUI IDE for code editing and project management
- Maintain conversation context across multiple sessions

Guidelines:
- Always confirm before destructive operations
- Provide clear explanations of your actions
- Use appropriate tools for each task
- Respect user privacy and data security

Remember: You control the Desktop. The user communicates with you through applications.`;
    }

    /**
     * 获取 Session 信息（用于调试和监控）
     */
    getSessionInfo(): Array<{
        topicId: string;
        state: string;
        createdAt: number;
        lastAccessTime: number;
        idleTimeMs: number;
    }> {
        const now = Date.now();
        const info: Array<any> = [];

        for (const [topicId, session] of this.sessions.entries()) {
            info.push({
                topicId,
                state: session.state,
                createdAt: session.createdAt,
                lastAccessTime: session.lastAccessTime,
                idleTimeMs: now - session.lastAccessTime,
            });
        }

        return info;
    }

    /**
     * 检查 Session 是否存在
     */
    hasSession(topicId: string): boolean {
        return this.sessions.has(topicId);
    }

    /**
     * 获取 Session 数量
     */
    getSessionCount(): number {
        return this.sessions.size;
    }

    /**
     * 清理所有 Session（用于关闭应用）
     */
    async cleanup(): Promise<void> {
        this.logger.info('Cleaning up all sessions', {
            count: this.sessions.size,
        });

        // 停止清理任务
        this.stopCleanupTask();

        // 销毁所有 Session
        const topicIds = Array.from(this.sessions.keys());
        for (const topicId of topicIds) {
            await this.destroySession(topicId);
        }

        this.logger.info('All sessions cleaned up');
    }
}
