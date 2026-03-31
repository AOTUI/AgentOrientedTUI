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
import { AgentDriverV2, type LLMConfig } from '@aotui/agent-driver-v2';
import type { AppConfigEntry } from '@aotui/runtime';
import type { IDesktop, IKernel } from '@aotui/runtime/spi';
import { AOTUIDrivenSource } from '@aotui/runtime/adapters';
import { MessageServiceV2 } from './message-service-v2.js';
import { Logger } from '../utils/logger.js';
import { EventEmitter } from 'events';
import { LLMConfigService } from './llm-config-service.js';
import { SessionManagerV3 } from './session-manager-v3.js';
import type { ModelRegistry } from '../services/model-registry.js';
import type { GuiUpdateEvent } from '../types/session.js';
import type {
    CatalogSearchResponse,
    CatalogSearchEntry,
    InstallAppOptions,
    InstallAppResult
} from './desktop-manager.js';
import { SystemPromptDrivenSource } from '../adapters/system-prompt-source.js';
import { SkillDrivenSource } from '../skills/skill-driven-source.js';
import { McpDrivenSource } from '../mcp/source.js';
import { IMSessionManager } from '../im/im-session-manager.js';
import { IMDrivenSource } from '../im/im-driven-source.js';
import type { IMInboundMessage } from '../im/types.js';
import { appendIMMessage, listIMMessages, replaceIMMessages } from '../im/message-store.js';
import { deleteIMSession, getIMSession, listIMSessions, upsertIMSession, type IMPersistedSession } from '../im/session-store.js';
import { Config } from '../config/config.js';
import { toLLMConfig } from '../types/llm-config.js';
import {
    applySourceControlsToSources,
    createSourceControlsFromAgent,
    type SourceControlsSnapshot,
} from './source-controls.js';

/**
 * Re-export GuiUpdateEvent for backward compatibility
 */
export type { GuiUpdateEvent };

/**
 * HostManager V2 (Simplified)
 */
export class HostManagerV2 {
    private sessionManager: SessionManagerV3 | null = null;
    private imSessionManager: IMSessionManager | null = null;
    private messageService: MessageServiceV2;
    private currentTopicId: string;
    private logger: Logger;
    private guiEventEmitter: EventEmitter;
    private llmConfigService: LLMConfigService;
    private kernel: IKernel | null = null;
    private imRuntimeProvider: (() => unknown) | null = null;

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
            this.emitGuiUpdate(event);
        });

        this.imSessionManager = new IMSessionManager({
            createDesktop: async ({ sessionKey, workspaceDirPath }) => {
                const manager = this.requireDesktopManager();
                const runtimeKernel = this.requireKernel();
                const info = await manager.createDesktop(sessionKey as any, {
                    workspaceDirPath,
                });
                const desktop = runtimeKernel.getDesktop(info.desktopId);
                if (!desktop) {
                    throw new Error(`Desktop not found for IM session: ${sessionKey}`);
                }

                const desktopWithDestroy = desktop as IDesktop & { destroy?: () => Promise<void> };
                desktopWithDestroy.destroy = async () => {
                    await manager.deleteDesktop(info.desktopId);
                };
                return desktopWithDestroy;
            },
            createSource: ({ sessionKey }) => new IMDrivenSource({
                sessionKey,
                loadHistory: async (key) => listIMMessages(key),
                persistMessage: async (key, message) => appendIMMessage(key, message),
                replaceHistory: async (key, messages) => replaceIMMessages(key, messages),
            }),
            persistSession: async (session) => {
                upsertIMSession(session);
            },
            deletePersistedSession: async (sessionKey) => {
                deleteIMSession(sessionKey);
            },
            createAgentDriver: async ({ sessionKey, agentId, desktop, source }) => {
                return this.createIMAgentDriver({
                    sessionKey,
                    agentId,
                    desktop: desktop as IDesktop,
                    source,
                });
            },
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
    async sendUserMessage(
        content: string,
        topicId?: string,
        messageId?: string,
        attachments?: Array<{ id: string; mime: string; url: string; filename?: string }>
    ): Promise<void> {
        if (!this.sessionManager) {
            throw new Error('SessionManager not initialized. Call initAgentDriver first.');
        }
        
        const targetTopicId = topicId || this.currentTopicId;
        await this.sessionManager.sendMessage(targetTopicId, content, messageId, attachments);
    }

    async sendIMMessage(message: IMInboundMessage): Promise<void> {
        if (!this.imSessionManager) {
            throw new Error('IMSessionManager not initialized. Call initAgentDriver first.');
        }

        const session = await this.imSessionManager.ensureSession(message.sessionKey, message.agentId);
        const compactionPolicy = await this.resolveIMCompactionPolicy(message.agentId);
        const fallbackCompaction = session.source.maybeCompactByThreshold
            ? await session.source.maybeCompactByThreshold({
                enabled: compactionPolicy.enabled,
                maxContextTokens: compactionPolicy.hardFallbackThresholdTokens,
                minMessages: compactionPolicy.minMessages,
                keepRecentMessages: compactionPolicy.keepRecentMessages,
                modelHint: compactionPolicy.modelHint,
            })
            : {
                compacted: false,
                syntheticMessages: [],
                summary: '',
                compactedMessageCount: 0,
                cleanedToolResultCount: 0,
                currentTokens: 0,
                thresholdTokens: compactionPolicy.hardFallbackThresholdTokens,
            };
        if (fallbackCompaction.compacted) {
            for (const syntheticMessage of fallbackCompaction.syntheticMessages) {
                this.emitGuiUpdate({
                    topicId: message.sessionKey,
                    type: syntheticMessage.role === 'tool' ? 'tool' : 'assistant',
                    message: syntheticMessage as ModelMessage,
                });
            }

            this.logger.info('Hard fallback IM context compaction applied before inbound user message', {
                sessionKey: message.sessionKey,
                thresholdTokens: fallbackCompaction.thresholdTokens,
                currentTokens: fallbackCompaction.currentTokens,
                compactedMessageCount: fallbackCompaction.compactedMessageCount,
                cleanedToolResultCount: fallbackCompaction.cleanedToolResultCount,
            });
        }

        await this.imSessionManager.dispatch(message);

        this.emitGuiUpdate({
            topicId: message.sessionKey,
            type: 'user',
            message: {
                role: 'user',
                content: message.body,
            } as ModelMessage,
        });
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

    getIMSessions(): IMPersistedSession[] {
        return listIMSessions();
    }

    getIMSession(sessionKey: string): IMPersistedSession | null {
        return getIMSession(sessionKey);
    }

    getIMMessages(sessionKey: string): Array<{ role: string; content: unknown; timestamp: number }> {
        return listIMMessages(sessionKey);
    }

    setIMRuntimeProvider(provider: (() => unknown) | null): void {
        this.imRuntimeProvider = provider;
    }

    getIMRuntime(): unknown {
        return this.imRuntimeProvider ? this.imRuntimeProvider() : {};
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

    async getAppsConfig(): Promise<Record<string, AppConfigEntry>> {
        return this.requireDesktopManager().getAppsConfig();
    }

    async getAppDetail(name: string): Promise<AppConfigEntry> {
        return this.requireDesktopManager().getAppDetail(name);
    }

    async searchAppsCatalog(query?: string): Promise<CatalogSearchResponse> {
        return this.requireDesktopManager().searchAppsCatalog(query);
    }

    async installApp(source: string, options?: InstallAppOptions): Promise<InstallAppResult> {
        return this.requireDesktopManager().installApp(source, options);
    }

    async updateApp(name: string): Promise<InstallAppResult> {
        return this.requireDesktopManager().updateApp(name);
    }

    async removeApp(name: string): Promise<void> {
        await this.requireDesktopManager().removeApp(name);
    }

    async setAppEnabled(name: string, enabled: boolean): Promise<void> {
        await this.requireDesktopManager().setAppEnabled(name, enabled);
    }

    private requireDesktopManager(): import('./desktop-manager.js').DesktopManager {
        if (!this.desktopManager) {
            throw new Error('DesktopManager not initialized. Call initAgentDriver first.');
        }
        return this.desktopManager;
    }

    private requireKernel(): IKernel {
        if (!this.kernel) {
            throw new Error('Kernel not initialized. Call initAgentDriver first.');
        }
        return this.kernel;
    }

    private emitGuiUpdate(event: GuiUpdateEvent): void {
        console.log(`[HostManagerV2] Forward message: topic=${event.topicId}, type=${event.type}, listeners=${this.guiEventEmitter.listenerCount('gui-update')}`);
        this.guiEventEmitter.emit('gui-update', {
            type: event.type,
            message: event.message,
            topicId: event.topicId,
            state: (event as { state?: string }).state,
            delta: (event as { delta?: string }).delta,
        });
    }

    private async createIMAgentDriver(input: {
        sessionKey: string;
        agentId: string;
        desktop: IDesktop;
        source: IMDrivenSource;
    }): Promise<{ agentDriver: AgentDriverV2; sourceControls: SourceControlsSnapshot }> {
        const { llmConfig, systemPrompt, sourceControls } = await this.resolveIMAgentConfig(input.agentId);
        const systemPromptSource = new SystemPromptDrivenSource({
            systemPrompt,
        });
        const aotuiSource = new AOTUIDrivenSource(input.desktop, this.requireKernel(), {
            includeInstruction: true,
        });
        const skillDrivenSource = new SkillDrivenSource();
        const mcpDrivenSource = new McpDrivenSource();
        applySourceControlsToSources(sourceControls, {
            aotuiSource,
            mcpSource: mcpDrivenSource,
            skillSource: skillDrivenSource,
        });

        const agentDriver = new AgentDriverV2({
            sources: [
                systemPromptSource,
                aotuiSource,
                input.source,
                skillDrivenSource,
                mcpDrivenSource as any,
            ],
            llm: llmConfig,
            onAssistantMessage: (message) => {
                input.source.addMessage(message);
                this.emitGuiUpdate({
                    topicId: input.sessionKey,
                    type: 'assistant',
                    message,
                });
            },
            onToolResult: (message) => {
                input.source.addMessage(message);
                this.emitGuiUpdate({
                    topicId: input.sessionKey,
                    type: 'tool',
                    message,
                });
            },
            onTextDelta: (delta) => {
                this.emitGuiUpdate({
                    topicId: input.sessionKey,
                    type: 'text_delta',
                    delta,
                });
            },
            onReasoningDelta: (delta) => {
                this.emitGuiUpdate({
                    topicId: input.sessionKey,
                    type: 'reasoning_delta',
                    delta,
                });
            },
            onStateChange: (_oldState, newState) => {
                this.emitGuiUpdate({
                    topicId: input.sessionKey,
                    type: 'agent_state',
                    state: newState,
                });
            },
            onRunError: (error) => {
                this.handleIMAgentRunError(input.sessionKey, input.source, error);
            },
        });

        agentDriver.start();
        return {
            agentDriver,
            sourceControls,
        };
    }

    private async resolveIMAgentConfig(agentId: string): Promise<{
        llmConfig: LLMConfig;
        systemPrompt: string;
        sourceControls: SourceControlsSnapshot;
    }> {
        const llmConfig = await this.llmConfigService.getActiveLLMConfig();
        if (!llmConfig) {
            throw new Error('No active LLM config found. Please configure an LLM provider first.');
        }

        let effectiveLLMConfig = llmConfig;
        let systemPrompt = this.getDefaultSystemPrompt();

        const config = await Config.get();
        const agents = (config as any).agents || { list: [] };
        const agent = agents.list.find((item: any) => item.id === agentId);
        const sourceControls = createSourceControlsFromAgent(agent || {}, config as any);

        if (agent?.prompt) {
            systemPrompt = agent.prompt;
        }

        const modelOverride = typeof agent?.modelId === 'string' ? agent.modelId.trim() : '';
        if (!modelOverride) {
            return { llmConfig: effectiveLLMConfig, systemPrompt, sourceControls };
        }

        let overrideProviderId: string | undefined;
        let overrideModelId: string;

        if (modelOverride.startsWith('custom:')) {
            const secondColon = modelOverride.indexOf(':', 'custom:'.length);
            if (secondColon > 0) {
                overrideProviderId = modelOverride.slice(0, secondColon);
                overrideModelId = modelOverride.slice(secondColon + 1);
            } else {
                overrideProviderId = modelOverride;
                overrideModelId = '';
            }
        } else {
            const colonIndex = modelOverride.indexOf(':');
            overrideProviderId = colonIndex > 0 ? modelOverride.slice(0, colonIndex) : llmConfig.provider?.id;
            overrideModelId = colonIndex > 0 ? modelOverride.slice(colonIndex + 1) : modelOverride;
        }

        const allConfigs = this.llmConfigService.getAllConfigs();
        const providerConfigs = allConfigs.filter((record) => record.providerId === overrideProviderId);
        const exactProviderModelConfig = providerConfigs.find((record) => {
            const recordModel = (record.model || '').trim();
            if (!recordModel) return false;
            const normalizedRecordModel = recordModel.startsWith(`${overrideProviderId}/`)
                ? recordModel.slice((overrideProviderId || '').length + 1)
                : recordModel;
            return normalizedRecordModel === overrideModelId;
        });
        const providerConfigRecord = exactProviderModelConfig || providerConfigs[0];

        if (overrideProviderId?.startsWith('custom:') && providerConfigRecord) {
            const customProviders = await this.llmConfigService.listCustomProviders();
            const customProvider = customProviders.find((provider) => provider.id === overrideProviderId);

            if (customProvider) {
                const recordModel = (providerConfigRecord.model || '').trim();
                let normalizedRecordModel = recordModel;

                const slashPrefix = `${overrideProviderId}/`;
                const colonPrefix = `${overrideProviderId}:`;
                if (normalizedRecordModel.startsWith(slashPrefix)) {
                    normalizedRecordModel = normalizedRecordModel.slice(slashPrefix.length);
                } else if (normalizedRecordModel.startsWith(colonPrefix)) {
                    normalizedRecordModel = normalizedRecordModel.slice(colonPrefix.length);
                }

                const protocolPrefix = `${customProvider.protocol}:`;
                if (normalizedRecordModel.startsWith(protocolPrefix)) {
                    normalizedRecordModel = normalizedRecordModel.slice(protocolPrefix.length);
                }

                const resolvedModelName = (overrideModelId || normalizedRecordModel).trim();
                effectiveLLMConfig = {
                    ...llmConfig,
                    model: `${customProvider.protocol}:${resolvedModelName}`,
                    provider: {
                        id: customProvider.protocol,
                        baseURL: providerConfigRecord.baseUrl || customProvider.baseUrl,
                    },
                    apiKey: providerConfigRecord.apiKey || customProvider.apiKey || llmConfig.apiKey,
                    temperature: providerConfigRecord.temperature,
                    maxSteps: providerConfigRecord.maxSteps,
                };
                return { llmConfig: effectiveLLMConfig, systemPrompt, sourceControls };
            }
        }

        const providerResolvedConfig = providerConfigRecord ? toLLMConfig(providerConfigRecord) : null;
        effectiveLLMConfig = {
            ...llmConfig,
            model: overrideProviderId ? `${overrideProviderId}:${overrideModelId}` : overrideModelId,
            provider: providerResolvedConfig?.provider
                ? {
                    ...providerResolvedConfig.provider,
                    id: overrideProviderId || providerResolvedConfig.provider.id,
                }
                : (overrideProviderId ? { id: overrideProviderId } : llmConfig.provider),
            apiKey: providerResolvedConfig?.apiKey ?? llmConfig.apiKey,
        };

        return { llmConfig: effectiveLLMConfig, systemPrompt, sourceControls };
    }

    private async resolveIMCompactionPolicy(agentId: string): Promise<{
        enabled: boolean;
        minMessages: number;
        keepRecentMessages: number;
        hardFallbackThresholdTokens: number;
        modelHint: string;
    }> {
        const defaults = {
            enabled: true,
            minMessages: 14,
            keepRecentMessages: 8,
            hardFallbackThresholdTokens: 4_500,
            modelHint: '',
        };

        const config = await Config.get();
        const experimental = (config as any)?.experimental;
        const globalCompaction = experimental && typeof experimental === 'object'
            ? (experimental as Record<string, any>).contextCompaction
            : undefined;
        const agents = Array.isArray((config as any)?.agents?.list) ? (config as any).agents.list : [];
        const agent = agents.find((item: any) => item?.id === agentId);
        const modelHint = typeof agent?.modelId === 'string' ? agent.modelId.trim() : '';

        return {
            enabled: globalCompaction?.enabled !== false,
            minMessages: Number.isInteger(globalCompaction?.minMessages) && globalCompaction.minMessages > 0
                ? globalCompaction.minMessages
                : defaults.minMessages,
            keepRecentMessages: Number.isInteger(globalCompaction?.keepRecentMessages) && globalCompaction.keepRecentMessages > 0
                ? globalCompaction.keepRecentMessages
                : defaults.keepRecentMessages,
            hardFallbackThresholdTokens: Number.isInteger(globalCompaction?.hardFallbackThresholdTokens) && globalCompaction.hardFallbackThresholdTokens > 0
                ? globalCompaction.hardFallbackThresholdTokens
                : defaults.hardFallbackThresholdTokens,
            modelHint,
        };
    }

    private handleIMAgentRunError(sessionKey: string, source: IMDrivenSource, error: Error): void {
        const normalized = (error.message || 'Unknown error').toLowerCase();
        let userFacingMessage = `LLM 调用失败：${error.message || 'Unknown error'}\n请检查当前 Provider 配置或稍后重试。`;

        if (
            normalized.includes('api key') ||
            normalized.includes('unauthorized') ||
            normalized.includes('invalid_api_key') ||
            normalized.includes('authentication') ||
            normalized.includes('forbidden') ||
            normalized.includes('401') ||
            normalized.includes('403')
        ) {
            userFacingMessage = `LLM 调用失败：Provider 认证异常（API Key 或模型配置不可用）。\n请打开 Settings 检查 Provider、Model 与 API Key 后重试。\n\n技术详情：${error.message}`;
        } else if (
            normalized.includes('network') ||
            normalized.includes('fetch failed') ||
            normalized.includes('enotfound') ||
            normalized.includes('econnrefused') ||
            normalized.includes('etimedout') ||
            normalized.includes('socket hang up') ||
            normalized.includes('internet')
        ) {
            userFacingMessage = `LLM 调用失败：网络不可用或请求超时。\n请检查网络连接、代理配置或稍后重试。\n\n技术详情：${error.message}`;
        } else if (
            normalized.includes('rate limit') ||
            normalized.includes('too many requests') ||
            normalized.includes('quota') ||
            normalized.includes('429')
        ) {
            userFacingMessage = `LLM 调用失败：触发了 Provider 的速率限制或额度限制。\n请稍后重试，或切换模型/Provider。\n\n技术详情：${error.message}`;
        }

        const assistantErrorMessage = {
            role: 'assistant',
            content: userFacingMessage,
            metadata: {
                isAgentError: true,
                rawError: error.message,
            },
        } as unknown as ModelMessage;

        source.addMessage(assistantErrorMessage);
        this.emitGuiUpdate({
            topicId: sessionKey,
            type: 'assistant',
            message: assistantErrorMessage,
        });
    }

    private getDefaultSystemPrompt(): string {
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
     * 清理资源
     */
    async dispose(): Promise<void> {
        if (this.sessionManager) {
            await this.sessionManager.cleanup();
        }
        if (this.imSessionManager) {
            await this.imSessionManager.destroyAllSessions();
        }
        this.guiEventEmitter.removeAllListeners();
        this.logger.info('HostManagerV2 disposed');
    }
}
