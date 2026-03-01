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
import { SkillDrivenSource } from '../skills/skill-driven-source.js';
import type { Session, SessionManagerConfig, GuiUpdateEvent } from '../types/session.js';
import { Logger } from '../utils/logger.js';
import type { DesktopManager } from './desktop-manager.js';
import * as db from '../db/index.js';
import { projectService } from './project-service.js';
import { toLLMConfig } from '../types/llm-config.js';
import { isMcpServerItemKey, parseMcpServerItemKey } from './source-control-keys.js';
import { Config } from '../config/config.js';

type AOTUIControllableSource = {
    setEnabled(enabled: boolean): void;
    setAppEnabled(appName: string, enabled: boolean): void;
};

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
    private compactionGlobalPolicyCache: {
        loadedAt: number;
        value: {
            enabled?: boolean;
            minMessages?: number;
            keepRecentMessages?: number;
            hardFallbackThresholdTokens?: number;
        };
    } | null = null;
    private sourceControlsByTopic: Map<string, {
        apps: { enabled: boolean; disabledItems: Set<string> };
        mcp: { enabled: boolean; disabledItems: Set<string> };
        skill: { enabled: boolean; disabledItems: Set<string> };
    }> = new Map();
    private asAOTUIControllableSource(source: AOTUIDrivenSource): AOTUIControllableSource | null {
        const candidate = source as unknown as Partial<AOTUIControllableSource>;
        if (typeof candidate.setEnabled !== 'function' || typeof candidate.setAppEnabled !== 'function') {
            return null;
        }

        return candidate as AOTUIControllableSource;
    }

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

        // 2. 获取 LLM 配置（支持 topic-level override）
        const llmConfig = await this.llmConfigService.getActiveLLMConfig();
        if (!llmConfig) {
            throw new Error('No active LLM config found. Please configure an LLM provider first.');
        }

        // [Agent Customization] Apply Agent Snapshot if agentId is present
        const topicModelOverride = topic?.modelOverride?.trim();
        let effectiveModelOverride = topicModelOverride;
        let effectivePromptOverride = topic?.promptOverride?.trim();
        let effectiveSourceControls = topic?.sourceControls;

        if (topic?.agentId) {
            const config = await Config.get();
            const agents = (config as any).agents || { list: [] };
            const agent = agents.list.find((a: any) => a.id === topic.agentId);
            if (agent) {
                // Topic-level model override must win over agent snapshot model.
                // This allows users to switch models per topic (e.g. vision model) without being overridden by agent defaults.
                if (!effectiveModelOverride && agent.modelId) {
                    effectiveModelOverride = agent.modelId;
                } else if (effectiveModelOverride && agent.modelId && effectiveModelOverride !== agent.modelId) {
                    this.logger.info('Topic model override takes precedence over agent model snapshot', {
                        topicId,
                        topicModelOverride: effectiveModelOverride,
                        agentModelId: agent.modelId,
                    });
                }
                if (agent.prompt) effectivePromptOverride = agent.prompt;
                
                // Merge agent tools into effectiveSourceControls
                const mergedControls: any = { ...effectiveSourceControls };
                
                // 1. Apps
                if (agent.enabledApps && Array.isArray(agent.enabledApps)) {
                    // We don't have direct access to app registry here, so we'll just enable the category
                    // and let the source handle it if possible, or just enable all for now
                    mergedControls.apps = {
                        enabled: true,
                        disabledItems: []
                    };
                }
                
                // 2. Skills
                if (agent.enabledSkills && Object.keys(agent.enabledSkills).length > 0) {
                    mergedControls.skill = {
                        enabled: true,
                        disabledItems: []
                    };
                }
                
                // 3. MCPs
                if (agent.enabledMCPs && Array.isArray(agent.enabledMCPs)) {
                    mergedControls.mcp = {
                        enabled: true,
                        disabledItems: []
                    };
                }
                
                effectiveSourceControls = mergedControls;
            }
        }

        const modelOverride = effectiveModelOverride;
        const effectiveLLMConfig = await (async () => {
            if (!modelOverride) return llmConfig;

            // Custom provider IDs are "custom:XXX", so the full model string is
            // "custom:XXX:model-name". We must split at the SECOND colon, not the first.
            let overrideProviderId: string | undefined;
            let overrideModelId: string;

            if (modelOverride.startsWith('custom:')) {
                const secondColon = modelOverride.indexOf(':', 'custom:'.length);
                if (secondColon > 0) {
                    overrideProviderId = modelOverride.slice(0, secondColon);
                    overrideModelId   = modelOverride.slice(secondColon + 1);
                } else {
                    // e.g. "custom:my-provider" with no model — treat whole thing as provider
                    overrideProviderId = modelOverride;
                    overrideModelId   = '';
                }
            } else {
                const colonIndex = modelOverride.indexOf(':');
                overrideProviderId = colonIndex > 0 ? modelOverride.slice(0, colonIndex) : llmConfig.provider?.id;
                overrideModelId   = colonIndex > 0 ? modelOverride.slice(colonIndex + 1) : modelOverride;
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

            // Custom provider records (providerId = "custom:xxx") must be converted to
            // runtime protocol providers (openai/anthropic). Otherwise AI SDK registry
            // splits at the first colon and looks up "custom" instead of "custom:xxx".
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

                    return {
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
                }
            }

            const providerResolvedConfig = providerConfigRecord ? toLLMConfig(providerConfigRecord) : null;

            return {
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
        })();

        const effectiveSystemPrompt = effectivePromptOverride || this.getSystemPrompt();

        // 3. 创建 DrivenSources
        const systemPromptSource = new SystemPromptDrivenSource({
            systemPrompt: effectiveSystemPrompt,
        });

        const aotuiSource = new AOTUIDrivenSource(desktop, this.kernel, {
            includeInstruction: true, // 注入 AOTUI System Instruction
        });

        const hostSource = new HostDrivenSourceV2(
            this.messageService,
            topicId
        );

        const mcpDrivenSource = new McpDrivenSource();
        const skillDrivenSource = new SkillDrivenSource({ projectPath });
        this.applySourceControls(topicId, aotuiSource, mcpDrivenSource, skillDrivenSource);

        // 4. 创建 AgentDriver
        const { providerId, modelId, modelLabel } = (() => {
            const rawModel = effectiveLLMConfig.model;
            const inferredProvider = effectiveLLMConfig.provider?.id;
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
                skillDrivenSource,
                mcpDrivenSource as any,    // Custom MCP Tools
            ],
            llm: effectiveLLMConfig,
            onAssistantMessage: (message) => {
                this.handleMessage(topicId, 'assistant', message);
            },
            onToolResult: (message) => {
                this.handleMessage(topicId, 'tool', message);
            },
            onTextDelta: (delta) => {
                const event: GuiUpdateEvent = {
                    topicId,
                    type: 'text_delta',
                    delta,
                };
                this.emit('message', event);
            },
            onReasoningDelta: (delta) => {
                const event: GuiUpdateEvent = {
                    topicId,
                    type: 'reasoning_delta',
                    delta,
                };
                this.emit('message', event);
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
            onRunError: (error) => {
                this.handleAgentRunError(topicId, error);
            },
        });

        const controls = this.getOrInitSourceControls(topicId);
        agentDriver.setSourceEnabled(aotuiSource.name, controls.apps.enabled);
        agentDriver.setSourceEnabled(skillDrivenSource.name, controls.skill.enabled);
        agentDriver.setSourceEnabled(mcpDrivenSource.name, controls.mcp.enabled);

        // 5. 启动 AgentDriver
        agentDriver.start();

        // 向 GUI 发消息：会话创建完成，Agent 进入 idle
        // 这样 ChatBridge 能知道该 Topic 已有活跃 Session（不再显示 sleeping）
        const initEvent: GuiUpdateEvent = {
            topicId,
            type: 'agent_state',
            state: 'idle',
        };
        this.emit('message', initEvent);

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
                skill: skillDrivenSource,
                mcp: mcpDrivenSource,
            },
            state: 'active',
            createdAt: Date.now(),
            lastAccessTime: Date.now(),
        };
    }

    private getOrInitSourceControls(topicId: string) {
        let existing = this.sourceControlsByTopic.get(topicId);
        if (existing) {
            return existing;
        }

        const topic = db.getTopic(topicId);
        if (topic?.sourceControls) {
            existing = {
                apps: {
                    enabled: topic.sourceControls.apps?.enabled ?? true,
                    disabledItems: new Set<string>(topic.sourceControls.apps?.disabledItems ?? []),
                },
                mcp: {
                    enabled: topic.sourceControls.mcp?.enabled ?? true,
                    disabledItems: new Set<string>(topic.sourceControls.mcp?.disabledItems ?? []),
                },
                skill: {
                    enabled: topic.sourceControls.skill?.enabled ?? true,
                    disabledItems: new Set<string>(topic.sourceControls.skill?.disabledItems ?? []),
                },
            };
            this.sourceControlsByTopic.set(topicId, existing);
            return existing;
        }

        existing = {
            apps: { enabled: true, disabledItems: new Set<string>() },
            mcp: { enabled: true, disabledItems: new Set<string>() },
            skill: { enabled: true, disabledItems: new Set<string>() },
        };
        this.sourceControlsByTopic.set(topicId, existing);
        return existing;
    }

    private applySourceControls(topicId: string, aotuiSource?: AOTUIDrivenSource, mcpSource?: McpDrivenSource, skillSource?: SkillDrivenSource): void {
        const controls = this.getOrInitSourceControls(topicId);
        if (aotuiSource) {
            const controllableSource = this.asAOTUIControllableSource(aotuiSource);
            if (controllableSource) {
                controllableSource.setEnabled(controls.apps.enabled);
                controls.apps.disabledItems.forEach((item) => controllableSource.setAppEnabled(item, false));
            }
        }
        if (mcpSource) {
            mcpSource.setEnabled(controls.mcp.enabled);
            controls.mcp.disabledItems.forEach((item) => {
                if (isMcpServerItemKey(item)) {
                    const serverName = parseMcpServerItemKey(item);
                    if (serverName) {
                        mcpSource.setServerEnabled(serverName, false);
                    }
                    return;
                }
                mcpSource.setToolEnabled(item, false);
            });
        }
        if (skillSource) {
            skillSource.setEnabled(controls.skill.enabled);
            controls.skill.disabledItems.forEach((item) => skillSource.setSkillEnabled(item, false));
        }
    }

    private normalizeCompactionPolicy(input?: {
        enabled?: boolean;
        minMessages?: number;
        keepRecentMessages?: number;
        hardFallbackThresholdTokens?: number;
    }): {
        enabled?: boolean;
        minMessages?: number;
        keepRecentMessages?: number;
        hardFallbackThresholdTokens?: number;
    } {
        if (!input) return {};

        const next: {
            enabled?: boolean;
            minMessages?: number;
            keepRecentMessages?: number;
            hardFallbackThresholdTokens?: number;
        } = {};

        if (typeof input.enabled === 'boolean') {
            next.enabled = input.enabled;
        }
        if (Number.isInteger(input.minMessages) && (input.minMessages as number) > 0) {
            next.minMessages = input.minMessages;
        }
        if (Number.isInteger(input.keepRecentMessages) && (input.keepRecentMessages as number) > 0) {
            next.keepRecentMessages = input.keepRecentMessages;
        }
        if (Number.isInteger(input.hardFallbackThresholdTokens) && (input.hardFallbackThresholdTokens as number) > 0) {
            next.hardFallbackThresholdTokens = input.hardFallbackThresholdTokens;
        }

        return next;
    }

    private async getGlobalCompactionPolicy(): Promise<{
        enabled?: boolean;
        minMessages?: number;
        keepRecentMessages?: number;
        hardFallbackThresholdTokens?: number;
    }> {
        const now = Date.now();
        if (this.compactionGlobalPolicyCache && now - this.compactionGlobalPolicyCache.loadedAt < 15_000) {
            return this.compactionGlobalPolicyCache.value;
        }

        try {
            const config = await Config.get();
            const rawExperimental = (config as { experimental?: unknown }).experimental;
            const rawCompaction = rawExperimental && typeof rawExperimental === 'object'
                ? (rawExperimental as Record<string, unknown>).contextCompaction
                : undefined;
            const value = this.normalizeCompactionPolicy(
                rawCompaction && typeof rawCompaction === 'object'
                    ? (rawCompaction as {
                        enabled?: boolean;
                        minMessages?: number;
                        keepRecentMessages?: number;
                        hardFallbackThresholdTokens?: number;
                    })
                    : undefined,
            );

            this.compactionGlobalPolicyCache = {
                loadedAt: now,
                value,
            };
            return value;
        } catch (error) {
            this.logger.warn('Failed to load global context compaction policy, using defaults', { error });
            return {};
        }
    }

    private async resolveCompactionPolicy(topicId: string): Promise<{
        enabled: boolean;
        minMessages: number;
        keepRecentMessages: number;
        hardFallbackThresholdTokens: number;
    }> {
        const defaults = {
            enabled: false,
            minMessages: 14,
            keepRecentMessages: 8,
            hardFallbackThresholdTokens: 4_500,
        };

        const globalPolicy = await this.getGlobalCompactionPolicy();
        const topicPolicy = this.normalizeCompactionPolicy(db.getTopic(topicId)?.contextCompaction);

        return {
            enabled: topicPolicy.enabled ?? globalPolicy.enabled ?? defaults.enabled,
            minMessages: topicPolicy.minMessages ?? globalPolicy.minMessages ?? defaults.minMessages,
            keepRecentMessages: topicPolicy.keepRecentMessages ?? globalPolicy.keepRecentMessages ?? defaults.keepRecentMessages,
            hardFallbackThresholdTokens:
                topicPolicy.hardFallbackThresholdTokens
                ?? globalPolicy.hardFallbackThresholdTokens
                ?? defaults.hardFallbackThresholdTokens,
        };
    }

    getSourceControlState(topicId: string): {
        apps: { enabled: boolean; disabledItems: string[] };
        mcp: { enabled: boolean; disabledItems: string[] };
        skill: { enabled: boolean; disabledItems: string[] };
    } {
        const controls = this.getOrInitSourceControls(topicId);
        return {
            apps: {
                enabled: controls.apps.enabled,
                disabledItems: Array.from(controls.apps.disabledItems).sort((a, b) => a.localeCompare(b)),
            },
            mcp: {
                enabled: controls.mcp.enabled,
                disabledItems: Array.from(controls.mcp.disabledItems).sort((a, b) => a.localeCompare(b)),
            },
            skill: {
                enabled: controls.skill.enabled,
                disabledItems: Array.from(controls.skill.disabledItems).sort((a, b) => a.localeCompare(b)),
            },
        };
    }

    setSourceEnabled(topicId: string, source: 'apps' | 'mcp' | 'skill', enabled: boolean): void {
        const controls = this.getOrInitSourceControls(topicId);
        controls[source].enabled = enabled;
        db.updateTopic(topicId, { sourceControls: this.getSourceControlState(topicId), updatedAt: Date.now() });

        const session = this.sessions.get(topicId);
        if (session) {
            if (source === 'apps') {
                session.agentDriver.setSourceEnabled(session.sources.aotui.name, enabled);
                const controllableSource = this.asAOTUIControllableSource(session.sources.aotui);
                controllableSource?.setEnabled(enabled);
            } else if (source === 'mcp') {
                session.agentDriver.setSourceEnabled(session.sources.mcp.name, enabled);
                session.sources.mcp.setEnabled(enabled);
            } else {
                session.agentDriver.setSourceEnabled(session.sources.skill.name, enabled);
                session.sources.skill.setEnabled(enabled);
            }
        }
    }

    setSourceItemEnabled(topicId: string, source: 'apps' | 'mcp' | 'skill', itemName: string, enabled: boolean): void {
        const controls = this.getOrInitSourceControls(topicId);
        if (enabled) {
            controls[source].disabledItems.delete(itemName);
        } else {
            controls[source].disabledItems.add(itemName);
        }
        db.updateTopic(topicId, { sourceControls: this.getSourceControlState(topicId), updatedAt: Date.now() });

        const session = this.sessions.get(topicId);
        if (session) {
            if (source === 'apps') {
                const controllableSource = this.asAOTUIControllableSource(session.sources.aotui);
                controllableSource?.setAppEnabled(itemName, enabled);
            } else if (source === 'mcp') {
                if (isMcpServerItemKey(itemName)) {
                    const serverName = parseMcpServerItemKey(itemName);
                    if (serverName) {
                        session.sources.mcp.setServerEnabled(serverName, enabled);
                    }
                } else {
                    session.sources.mcp.setToolEnabled(itemName, enabled);
                }
            } else {
                session.sources.skill.setSkillEnabled(itemName, enabled);
            }
        }
    }

    syncTopicPromptOverride(topicId: string): void {
        const session = this.sessions.get(topicId);
        if (!session) {
            return;
        }

        const topic = db.getTopic(topicId);
        const effectiveSystemPrompt = topic?.promptOverride?.trim() || this.getSystemPrompt();
        session.sources.systemPrompt.setSystemPrompt(effectiveSystemPrompt);

        this.logger.info('Synced topic prompt override to active session', {
            topicId,
            overridden: Boolean(topic?.promptOverride?.trim()),
        });
    }

    /**
     * 发送用户消息
     * 
     * @param topicId - Topic ID
     * @param content - 消息内容
     */
    async sendMessage(
        topicId: string,
        content: string,
        messageId?: string,
        attachments: Array<{ id: string; mime: string; url: string; filename?: string }> = []
    ): Promise<void> {
        const session = await this.ensureSession(topicId);

        const compactionPolicy = await this.resolveCompactionPolicy(topicId);
        const topicModelHint = db.getTopic(topicId)?.modelOverride;

        const fallbackCompaction = session.sources.host.maybeCompactByThreshold({
            enabled: compactionPolicy.enabled,
            maxContextTokens: compactionPolicy.hardFallbackThresholdTokens,
            minMessages: compactionPolicy.minMessages,
            keepRecentMessages: compactionPolicy.keepRecentMessages,
            modelHint: topicModelHint,
        });
        if (fallbackCompaction.compacted) {
            for (const syntheticMessage of fallbackCompaction.syntheticMessages) {
                const eventType = syntheticMessage.role === 'tool' ? 'tool' : 'assistant';
                const event: GuiUpdateEvent = {
                    topicId,
                    type: eventType,
                    message: syntheticMessage as ModelMessage,
                };
                this.emit('message', event);
            }

            this.logger.info('Hard fallback context compaction applied before user message', {
                topicId,
                thresholdTokens: fallbackCompaction.thresholdTokens,
                currentTokens: fallbackCompaction.currentTokens,
                compactedMessageCount: fallbackCompaction.compactedMessageCount,
                cleanedToolResultCount: fallbackCompaction.cleanedToolResultCount,
            });
        }

        // 1. 保存到数据库
        const activityTimestamp = Date.now();
        const hasAttachments = attachments.length > 0;
        const text = content.trim();
        const parts: any[] = [];
        if (text.length > 0) {
            parts.push({ type: 'text', text });
        }
        if (hasAttachments) {
            for (const attachment of attachments) {
                let data: string = attachment.url;
                if (attachment.url.startsWith('data:')) {
                    const match = attachment.url.match(/^data:[^;]+;base64,(.*)$/);
                    data = match?.[1] || '';
                }
                parts.push({
                    type: 'file',
                    data,
                    mediaType: attachment.mime,
                    filename: attachment.filename,
                });
            }
        }

        const userMessage: ModelMessage = {
            role: 'user',
            content: hasAttachments ? parts : content,
        } as ModelMessage & { id?: string; timestamp?: number };
        if (messageId) {
            (userMessage as any).id = messageId;
        }
        (userMessage as any).timestamp = activityTimestamp;
        this.messageService.addMessage(topicId, userMessage);

        // 1.1 更新 Topic 活跃时间（用于会话列表排序与「x m ago」展示）
        db.updateTopic(topicId, { updatedAt: activityTimestamp });

        // 2. 通知 HostDrivenSource
        session.sources.host.notifyNewMessage();

        // 3. 触发 GUI 更新事件
        const event: GuiUpdateEvent = {
            topicId,
            type: 'user',
            message: userMessage,
        };
        this.emit('message', event);

        this.logger.debug('User message sent', {
            topicId,
            contentLength: content.length,
            attachmentCount: attachments.length,
        });
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
            this.sourceControlsByTopic.delete(topicId);

            this.logger.info('Session destroyed', {
                topicId,
                remainingSessions: this.sessions.size,
            });
        } catch (error) {
            this.logger.error('Failed to destroy session', { topicId, error });
            // 即使失败也要清理引用
            this.sessions.delete(topicId);
            this.inFlightSessions.delete(topicId);
            this.sourceControlsByTopic.delete(topicId);
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
            this.sourceControlsByTopic.delete(topicId);

            this.logger.info('Session gracefully shutdown', {
                topicId,
                remainingSessions: this.sessions.size,
            });
        } catch (error) {
            this.logger.error('Failed to shutdown session', { topicId, error });
            this.sessions.delete(topicId);
            this.inFlightSessions.delete(topicId);
            this.sourceControlsByTopic.delete(topicId);
        }
    }

    /**
     * 暂停 Session的 AgentDriver
     */
    pauseSession(topicId: string): void {
        const session = this.sessions.get(topicId);
        if (!session) {
            this.logger.warn('pauseSession: session not found', { topicId });
            return;
        }
        session.agentDriver.pause();
        session.state = 'paused';
        this.logger.info('Session paused', { topicId });
        this.emit('message', { topicId, type: 'agent_paused' } as GuiUpdateEvent);
    }

    /**
     * 恢复 Session的 AgentDriver
     */
    resumeSession(topicId: string): void {
        const session = this.sessions.get(topicId);
        if (!session) {
            this.logger.warn('resumeSession: session not found', { topicId });
            return;
        }
        session.agentDriver.resume();
        session.state = 'active';
        this.logger.info('Session resumed', { topicId });
        this.emit('message', { topicId, type: 'agent_resumed' } as GuiUpdateEvent);
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
        const saved = this.messageService.addMessage(topicId, message);

        const session = this.sessions.get(topicId);
        if (session && type === 'tool' && Array.isArray((saved as any).content)) {
            const toolResultPart = (saved as any).content.find((part: any) => part?.type === 'tool-result');
            if (toolResultPart?.toolName === session.sources.host.getCompactionToolName()) {
                const resultPayload = toolResultPart.result ?? toolResultPart.output;
                const success = resultPayload && typeof resultPayload === 'object'
                    ? (resultPayload as { success?: unknown }).success
                    : undefined;
                if (success === true) {
                    const summary = resultPayload && typeof resultPayload === 'object'
                        ? (resultPayload as { summary?: unknown }).summary
                        : undefined;
                    const summaryText = typeof summary === 'string' ? summary : undefined;
                    session.sources.host.markToolCompactionAnchor(saved.id, summaryText);
                }
            }
        }

        // 2. 触发 GUI 更新（通过事件总线）
        const event: GuiUpdateEvent = {
            topicId,
            type,
            message: saved as unknown as ModelMessage,
        };
        this.emit('message', event);

        this.logger.debug('Message handled', {
            topicId,
            type,
            role: message.role,
        });
    }

    private handleAgentRunError(topicId: string, error: Error): void {
        const { category, userFacingMessage } = this.classifyAgentError(error);

        this.logger.warn('Agent run failed; emitting user-visible error message', {
            topicId,
            category,
            error: error.message,
        });

        const assistantErrorMessage = {
            role: 'assistant',
            content: userFacingMessage,
            metadata: {
                isAgentError: true,
                errorCategory: category,
                rawError: error.message,
            },
        } as unknown as ModelMessage;

        this.handleMessage(topicId, 'assistant', assistantErrorMessage);
    }

    private classifyAgentError(error: Error): {
        category: 'provider' | 'network' | 'rate_limit' | 'unknown';
        userFacingMessage: string;
    } {
        const raw = error.message || 'Unknown error';
        const normalized = raw.toLowerCase();

        if (
            normalized.includes('api key') ||
            normalized.includes('unauthorized') ||
            normalized.includes('invalid_api_key') ||
            normalized.includes('authentication') ||
            normalized.includes('forbidden') ||
            normalized.includes('401') ||
            normalized.includes('403')
        ) {
            return {
                category: 'provider',
                userFacingMessage: `LLM 调用失败：Provider 认证异常（API Key 或模型配置不可用）。\n请打开 Settings 检查 Provider、Model 与 API Key 后重试。\n\n技术详情：${raw}`,
            };
        }

        if (
            normalized.includes('network') ||
            normalized.includes('fetch failed') ||
            normalized.includes('enotfound') ||
            normalized.includes('econnrefused') ||
            normalized.includes('etimedout') ||
            normalized.includes('socket hang up') ||
            normalized.includes('internet')
        ) {
            return {
                category: 'network',
                userFacingMessage: `LLM 调用失败：网络不可用或请求超时。\n请检查网络连接、代理配置或稍后重试。\n\n技术详情：${raw}`,
            };
        }

        if (
            normalized.includes('rate limit') ||
            normalized.includes('too many requests') ||
            normalized.includes('quota') ||
            normalized.includes('429')
        ) {
            return {
                category: 'rate_limit',
                userFacingMessage: `LLM 调用失败：请求频率/额度受限。\n请稍后重试，或切换到其他可用模型。\n\n技术详情：${raw}`,
            };
        }

        return {
            category: 'unknown',
            userFacingMessage: `LLM 调用失败：${raw}\n请检查当前 Provider 配置或稍后重试。`,
        };
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
