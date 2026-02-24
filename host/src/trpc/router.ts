
import { initTRPC } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import superjson from 'superjson';
import { z } from 'zod';
import { dialog } from 'electron';
import * as db from '../db/index.js';
import { projectService } from '../core/project-service.js';
// ✅ V2: Use HostManagerV2
import type { HostManagerV2 } from '../core/host-manager-v2.js';
import type { LLMConfigService } from '../core/llm-config-service.js';
import type { ModelRegistry } from '../services/model-registry.js';
import { MessageServiceV2 } from '../core/message-service-v2.js';
import { Config } from '../config/config.js';
import { SkillCatalogService } from '../skills/skill-catalog-service.js';
import { getGlobalSkillsDir, getProjectSkillsDir } from '../skills/skill-config.js';
import { importSkillZipToDirectory } from '../skills/skill-importer.js';

import type { GuiUpdateEvent } from '../core/host-manager-v2.js';

// ✅ V2: 使用 HostManager V2 的 GuiUpdateEvent 类型

export type Context = {
    hostManager: HostManagerV2;
    llmConfigService: LLMConfigService;
    modelRegistry: ModelRegistry;
    messageService: MessageServiceV2;
    // ✅ V2: signalRouter 已删除，事件由 HostManagerV2 直接发出
};

const t = initTRPC.context<Context>().create({
    transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const dbRouter = router({
    getTopics: publicProcedure
        .query(async () => {
            return db.getAllTopics();
        }),
    getMessages: publicProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => {
            // ✅ 修复: 使用 MessageServiceV2 从 messages_v2 表读取
            console.log('[TRPC] getMessages called for topic:', input.id);
            const messages = ctx.messageService.getMessages(input.id);
            console.log('[TRPC] getMessages returned:', messages.length, 'messages');
            return messages;
        }),
    // [RFC-026] New endpoint for complete message data with parts
    // ✅ 修复: 使用 MessageServiceV2 从 messages_v2 表读取（返回 AI SDK v6 ModelMessage 格式）
    getMessagesWithParts: publicProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => {
            console.log('[TRPC] getMessagesWithParts called for topic:', input.id);
            const messages = ctx.messageService.getMessages(input.id);
            console.log('[TRPC] getMessagesWithParts returned:', messages.length, 'messages');
            return messages;
        }),
    createTopic: publicProcedure
        .input(z.object({
            title: z.string(),
            projectId: z.string().optional()
        }))
        .mutation(async ({ input }) => {
            console.log('[TRPC] createTopic called:', input.title);
            const id = `topic_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const topic = {
                id,
                title: input.title,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                status: 'hot' as const,
                projectId: input.projectId
            };
            try {
                db.createTopic(topic);
                console.log('[TRPC] createTopic success:', id);
                return topic;
            } catch (e) {
                console.error('[TRPC] createTopic failed:', e);
                throw e;
            }
        }),
    deleteTopic: publicProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            db.deleteTopic(input.id);
        }),
    renameTopic: publicProcedure
        .input(z.object({ id: z.string(), title: z.string().min(1).max(200) }))
        .mutation(async ({ input }) => {
            db.updateTopic(input.id, { title: input.title, updatedAt: Date.now() });
            return { success: true };
        }),
});

const chatRouter = router({
    send: publicProcedure
        .input(z.object({
            id: z.string(),
            content: z.string(),
            messageId: z.string().optional()
        }))
        .mutation(async ({ input, ctx }) => {
            console.log('[TRPC] chat.send called:', input.id, input.content.slice(0, 20));
            try {
                // ✅ V2: 直接使用 HostManagerV2（传递 topicId）
                await ctx.hostManager.sendUserMessage(input.content, input.id, input.messageId);
                console.log('[TRPC] chat.send success');
                return;
            } catch (e) {
                console.error('[TRPC] chat.send failed:', e);
                throw e;
            }
        }),
    pause: publicProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            console.log('[TRPC] chat.pause called:', input.id);
            ctx.hostManager.pauseAgent(input.id);
        }),
    resume: publicProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            console.log('[TRPC] chat.resume called:', input.id);
            ctx.hostManager.resumeAgent(input.id);
        }),
});

const sessionRouter = router({
    create: publicProcedure
        .input(z.object({
            id: z.string(),
            lazy: z.boolean().optional()
        }))
        .mutation(async ({ input, ctx }) => {
            // ✅ V2: 确保 Session 已创建
            await ctx.hostManager.ensureSessionForTopic(input.id);

            // ✅ V2: Return minimal DTO
            return {
                id: input.id,
                status: 'active',
                createdAt: Date.now()
            };
        }),

    events: publicProcedure
        .input(z.object({ id: z.string() }))
        .subscription(({ input, ctx }) => {
            // ✅ V2: 订阅 HostManagerV2 的 gui-update 事件 (返回 AI SDK v6 ModelMessage)
            return observable<GuiUpdateEvent>((emit) => {
                const handler = (event: GuiUpdateEvent) => {
                    if (event.topicId === input.id) {
                        emit.next(event);
                    }
                };

                ctx.hostManager.onGuiUpdate(handler);

                return () => {
                    // TODO: 实现 unsubscribe
                };
            });
        }),

    snapshot: publicProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ input, ctx }) => {
            return ctx.hostManager.getSnapshot(input.id);
        }),

    destroy: publicProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            // ✅ V2: 暂时不实现 destroy
            console.log('[TRPC] session.destroy called:', input.id);
        }),

    shutdown: publicProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            await ctx.hostManager.shutdownSession(input.id);
        }),
});

const projectRouter = router({
    list: publicProcedure.query(async () => {
        return projectService.getAllProjects();
    }),
    create: publicProcedure
        .input(z.object({ path: z.string(), name: z.string().optional() }))
        .mutation(async ({ input }) => {
            return projectService.createProject(input.path, input.name);
        }),
    delete: publicProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            projectService.deleteProject(input.id);
        }),
    open: publicProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input }) => {
            return projectService.openProject(input.id);
        }),
    pickFolder: publicProcedure
        .mutation(async () => {
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory', 'createDirectory']
            });
            if (result.canceled || result.filePaths.length === 0) {
                return null;
            }
            return result.filePaths[0];
        }),
});

const llmConfigRouter = router({
    getAll: publicProcedure
        .query(async ({ ctx }) => {
            return ctx.llmConfigService.getAllConfigs();
        }),
    getActive: publicProcedure
        .query(async ({ ctx }) => {
            return ctx.llmConfigService.getActiveLLMConfigRecord();
        }),
    create: publicProcedure
        .input(z.object({
            name: z.string(),
            model: z.string(),
            providerId: z.string(),
            baseUrl: z.string().optional(),
            apiKey: z.string().optional(),
            temperature: z.number(),
            maxSteps: z.number(),
        }))
        .mutation(async ({ input, ctx }) => {
            return ctx.llmConfigService.createConfig(input);
        }),
    update: publicProcedure
        .input(z.object({
            id: z.number(),
            data: z.object({
                name: z.string().optional(),
                model: z.string().optional(),
                providerId: z.string().optional(),
                baseUrl: z.string().optional(),
                apiKey: z.string().optional(),
                temperature: z.number().optional(),
                maxSteps: z.number().optional(),
            }),
        }))
        .mutation(async ({ input, ctx }) => {
            await ctx.llmConfigService.updateConfig(input.id, input.data);
        }),
    delete: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input, ctx }) => {
            ctx.llmConfigService.deleteConfig(input.id);
        }),
    setActive: publicProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ input, ctx }) => {
            ctx.llmConfigService.setActiveConfig(input.id);
        }),
});

const modelRegistryRouter = router({
    getProviders: publicProcedure
        .query(async ({ ctx }) => {
            return ctx.modelRegistry.getProviders();
        }),
    getProviderConfig: publicProcedure
        .input(z.object({
            providerId: z.string()
        }))
        .query(async ({ input, ctx }) => {
            return ctx.modelRegistry.getProviderConfig(input.providerId);
        }),
    getModels: publicProcedure
        .input(z.object({
            providerId: z.string().optional(),
            capability: z.enum(['tool_call', 'reasoning', 'vision']).optional(),
            maxInputCost: z.number().optional(),
        }))
        .query(async ({ input, ctx }) => {
            return ctx.modelRegistry.getModels(input);
        }),
    refresh: publicProcedure
        .mutation(async ({ ctx }) => {
            await ctx.modelRegistry.refresh();
        }),
    getCacheStatus: publicProcedure
        .query(async ({ ctx }) => {
            return ctx.modelRegistry.getCacheStatus();
        }),
});

const appsRouter = router({
    getConfig: publicProcedure
        .query(async () => {
            return Config.getAppsConfig();
        }),

    setEnabled: publicProcedure
        .input(z.object({
            name: z.string(),
            enabled: z.boolean(),
        }))
        .mutation(async ({ input }) => {
            await Config.setGlobalAppEnabled(input.name, input.enabled);
            return { success: true };
        }),

    getDetail: publicProcedure
        .input(z.object({
            name: z.string(),
        }))
        .query(async ({ input }) => {
            const apps = await Config.getAppsConfig();
            const app = apps[input.name];
            if (!app) {
                throw new Error(`App \"${input.name}\" not found`);
            }

            return {
                source: app.source,
                installedAt: app.installedAt,
            };
        }),
});

function normalizeMcpServerEntry(entry: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = { ...entry };

    if (normalized.enabled === undefined && typeof normalized.disabled === 'boolean') {
        normalized.enabled = !normalized.disabled;
    }

    if (typeof normalized.command === 'string') {
        const args = Array.isArray(normalized.args)
            ? normalized.args.filter((arg: unknown): arg is string => typeof arg === 'string')
            : [];
        normalized.command = [normalized.command, ...args];
    }

    if (!normalized.type) {
        if (typeof normalized.url === 'string') {
            normalized.type = 'remote';
        } else if (Array.isArray(normalized.command)) {
            normalized.type = 'local';
        }
    }

    if (!normalized.environment && normalized.env && typeof normalized.env === 'object') {
        normalized.environment = normalized.env;
    }

    return normalized;
}

function normalizeSkillsConfig(rawSkills: unknown): {
    enabled: boolean;
    disabledSkills: string[];
} {
    const raw = rawSkills && typeof rawSkills === 'object' ? (rawSkills as Record<string, unknown>) : {};
    const disabledSkills = Array.isArray(raw.disabledSkills)
        ? raw.disabledSkills.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        : [];

    return {
        enabled: raw.enabled !== false,
        disabledSkills: Array.from(new Set(disabledSkills)).sort((a, b) => a.localeCompare(b)),
    };
}

function normalizeMcpConfig(rawMcp: unknown): Record<string, any> {
    const raw = rawMcp && typeof rawMcp === 'object' ? (rawMcp as Record<string, any>) : {};
    const container = raw.mcpServers && typeof raw.mcpServers === 'object'
        ? (raw.mcpServers as Record<string, any>)
        : raw;

    const entries = Object.entries(container)
        .filter(([, value]) => value && typeof value === 'object')
        .map(([serverName, value]) => [serverName, normalizeMcpServerEntry(value as Record<string, any>)]);

    return Object.fromEntries(entries);
}

const mcpRouter = router({
    getConfig: publicProcedure
        .query(async () => {
            const config = await Config.getGlobal();
            return normalizeMcpConfig(config.mcp ?? (config as Record<string, any>).mcpServers ?? {});
        }),
    updateConfig: publicProcedure
        .input(z.object({
            mcp: z.record(z.string(), z.any())
        }))
        .mutation(async ({ input }) => {
            await Config.replaceGlobalMcp(normalizeMcpConfig(input.mcp));
            return { success: true };
        }),

    /**
     * getRuntime: 返回所有已配置 MCP Server 的运行时状态和工具列表
     * 为每个 server 合并：连接状态 + 工具列表 + 每个工具的 enabled 状态
     */
    getRuntime: publicProcedure
        .query(async () => {
            const { MCP } = await import('../mcp/index.js');
            const config = await Config.getGlobal();
            const mcpConfig: Record<string, any> = normalizeMcpConfig(config.mcp ?? (config as Record<string, any>).mcpServers ?? {});

            // 获取运行时 status（包含所有已配置的 server）
            const statusMap = await MCP.status();
            // 获取已连接的 clients，以便查询工具列表
            const clientsMap = await MCP.clients();

            const result: Record<string, {
                status: string;
                error?: string;
                tools: Array<{ name: string; description: string; enabled: boolean }>;
            }> = {};

            const serverNames = new Set<string>([
                ...Object.keys(mcpConfig),
                ...Object.keys(statusMap),
            ]);

            for (const serverName of serverNames) {
                const serverStatus = (statusMap as Record<string, { status: string; error?: string }>)[serverName]
                    ?? { status: mcpConfig[serverName]?.enabled === false ? 'disabled' : 'failed', error: 'Runtime status unavailable' };
                const serverConfig = mcpConfig[serverName] || {};
                const disabledTools: string[] = serverConfig.disabledTools || [];
                let tools: Array<{ name: string; description: string; enabled: boolean }> = [];

                // 仅对已连接的 server 查询工具列表
                if (serverStatus.status === 'connected') {
                    const client = clientsMap[serverName];
                    if (client) {
                        try {
                            const toolsResult = await client.listTools();
                            tools = toolsResult.tools.map((t: any) => ({
                                name: t.name,
                                description: t.description || '',
                                enabled: !disabledTools.includes(t.name),
                            }));
                        } catch (e) {
                            console.error(`[MCP.getRuntime] Failed to list tools for ${serverName}:`, e);
                        }
                    }
                }

                result[serverName] = {
                    status: serverStatus.status,
                    error: serverStatus.error,
                    tools,
                };
            }

            return result;
        }),

    /**
     * setServerEnabled: Enable / Disable 一个 MCP Server
     * 1. 更新 config 并持久化
     * 2. enabled=true → MCP.connect()；enabled=false → MCP.disconnect()
     */
    setServerEnabled: publicProcedure
        .input(z.object({
            name: z.string(),
            enabled: z.boolean(),
        }))
        .mutation(async ({ input }) => {
            const { MCP } = await import('../mcp/index.js');
            const config = await Config.getGlobal();
            const mcpConfig: Record<string, any> = { ...normalizeMcpConfig(config.mcp ?? (config as Record<string, any>).mcpServers ?? {}) };

            if (!mcpConfig[input.name]) {
                throw new Error(`MCP server "${input.name}" not found in config`);
            }

            mcpConfig[input.name] = { ...mcpConfig[input.name], enabled: input.enabled };
            await Config.replaceGlobalMcp(mcpConfig);

            if (input.enabled) {
                await MCP.connect(input.name);
            } else {
                await MCP.disconnect(input.name);
            }

            return { success: true };
        }),

    /**
     * setToolEnabled: Enable / Disable 某个 MCP Server 下的特定工具
     * 通过维护 config 中该 server 的 disabledTools 数组实现。
     */
    setToolEnabled: publicProcedure
        .input(z.object({
            serverName: z.string(),
            toolName: z.string(),
            enabled: z.boolean(),
        }))
        .mutation(async ({ input }) => {
            const config = await Config.getGlobal();
            const mcpConfig: Record<string, any> = { ...normalizeMcpConfig(config.mcp ?? (config as Record<string, any>).mcpServers ?? {}) };

            if (!mcpConfig[input.serverName]) {
                throw new Error(`MCP server "${input.serverName}" not found in config`);
            }

            const serverConfig = { ...mcpConfig[input.serverName] };
            const disabledTools: string[] = [...(serverConfig.disabledTools || [])];

            if (input.enabled) {
                const idx = disabledTools.indexOf(input.toolName);
                if (idx !== -1) disabledTools.splice(idx, 1);
            } else {
                if (!disabledTools.includes(input.toolName)) {
                    disabledTools.push(input.toolName);
                }
            }

            serverConfig.disabledTools = disabledTools;
            mcpConfig[input.serverName] = serverConfig;
            await Config.replaceGlobalMcp(mcpConfig);

            return { success: true };
        }),
});

const skillsRouter = router({
    getLocations: publicProcedure
        .input(z.object({ projectPath: z.string().optional() }).optional())
        .query(async ({ input }) => {
            return {
                globalPath: getGlobalSkillsDir(),
                projectPath: input?.projectPath ? getProjectSkillsDir(input.projectPath) : null,
            };
        }),

    getConfig: publicProcedure
        .query(async () => {
            const config = await Config.getGlobal();
            return normalizeSkillsConfig(config.skills ?? {});
        }),

    updateConfig: publicProcedure
        .input(z.object({
            skills: z.object({
                enabled: z.boolean(),
                disabledSkills: z.array(z.string()),
            }),
        }))
        .mutation(async ({ input }) => {
            const normalized = normalizeSkillsConfig(input.skills);
            await Config.updateGlobal({
                skills: {
                    enabled: normalized.enabled,
                    disabledSkills: normalized.disabledSkills,
                },
            });
            return { success: true };
        }),

    importZip: publicProcedure
        .input(z.object({
            scope: z.enum(['global', 'project']),
            projectPath: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
            const targetDirectory = input.scope === 'global'
                ? getGlobalSkillsDir()
                : (input.projectPath ? getProjectSkillsDir(input.projectPath) : null);

            if (!targetDirectory) {
                throw new Error('Project path is required for project-scoped skill import');
            }

            const result = await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [{ name: 'ZIP files', extensions: ['zip'] }],
            });

            if (result.canceled || result.filePaths.length === 0) {
                return { success: false, canceled: true };
            }

            const zipPath = result.filePaths[0];
            const importResult = await importSkillZipToDirectory(zipPath, targetDirectory);

            return {
                success: true,
                canceled: false,
                targetDirectory,
                zipPath,
                writtenFiles: importResult.writtenFiles,
            };
        }),

    getRuntime: publicProcedure
        .input(z.object({ projectPath: z.string().optional() }).optional())
        .query(async ({ input }) => {
            const config = await Config.getGlobal();
            const normalized = normalizeSkillsConfig(config.skills ?? {});
            const service = new SkillCatalogService({ projectPath: input?.projectPath });
            const skills = await service.listSkills();

            return {
                enabled: normalized.enabled,
                skills: skills.map((skill) => ({
                    name: skill.name,
                    description: skill.description,
                    scope: skill.scope,
                    enabled: !normalized.disabledSkills.includes(skill.name),
                })),
            };
        }),

    setSkillsEnabled: publicProcedure
        .input(z.object({ enabled: z.boolean() }))
        .mutation(async ({ input }) => {
            const config = await Config.getGlobal();
            const normalized = normalizeSkillsConfig(config.skills ?? {});
            await Config.updateGlobal({
                skills: {
                    ...normalized,
                    enabled: input.enabled,
                },
            });
            return { success: true };
        }),

    setSkillEnabled: publicProcedure
        .input(z.object({ name: z.string(), enabled: z.boolean() }))
        .mutation(async ({ input }) => {
            const config = await Config.getGlobal();
            const normalized = normalizeSkillsConfig(config.skills ?? {});
            const disabled = new Set(normalized.disabledSkills);

            if (input.enabled) {
                disabled.delete(input.name);
            } else {
                disabled.add(input.name);
            }

            await Config.updateGlobal({
                skills: {
                    ...normalized,
                    disabledSkills: Array.from(disabled).sort((a, b) => a.localeCompare(b)),
                },
            });

            return { success: true };
        }),
});

const sourceControlRouter = router({
    getTopic: publicProcedure
        .input(z.object({ id: z.string(), projectPath: z.string().optional() }))
        .query(async ({ input, ctx }) => {
            const sourceState = ctx.hostManager.getSourceControlState(input.id);

            const { MCP } = await import('../mcp/index.js');
            const config = await Config.getGlobal();
            const mcpConfig: Record<string, any> = normalizeMcpConfig(config.mcp ?? (config as Record<string, any>).mcpServers ?? {});
            const statusMap = await MCP.status();
            const clientsMap = await MCP.clients();

            const buildMcpItemKey = (serverName: string, toolName: string) => {
                const sanitizedServer = serverName.replace(/[^a-zA-Z0-9_-]/g, '_');
                const sanitizedTool = toolName.replace(/[^a-zA-Z0-9_-]/g, '_');
                return `mcp-${sanitizedServer}-${sanitizedTool}`;
            };

            const serverNames = Array.from(new Set<string>([
                ...Object.keys(mcpConfig),
                ...Object.keys(statusMap),
            ])).sort((a, b) => a.localeCompare(b));

            const mcpGroups: Array<{
                key: string;
                serverName: string;
                enabled: boolean;
                connected: boolean;
                items: Array<{ key: string; name: string; enabled: boolean }>;
            }> = [];

            for (const serverName of serverNames) {
                const serverKey = `server:${serverName}`;
                // Combine global config enabled state with topic-level override
                const isGloballyEnabled = mcpConfig[serverName]?.enabled !== false;
                const isTopicOverrideDisabled = sourceState.mcp.disabledItems.includes(serverKey);
                const serverEnabled = isGloballyEnabled && !isTopicOverrideDisabled;

                const serverStatus = (statusMap as Record<string, { status: string; error?: string }>)[serverName]
                    ?? { status: mcpConfig[serverName]?.enabled === false ? 'disabled' : 'failed' };
                const connected = serverStatus.status === 'connected';
                const client = clientsMap[serverName];
                const serverItems: Array<{ key: string; name: string; enabled: boolean }> = [];

                if (connected && client) {
                    try {
                        const toolsResult = await client.listTools();
                        for (const tool of toolsResult.tools) {
                            const key = buildMcpItemKey(serverName, tool.name);
                            serverItems.push({
                                key,
                                name: tool.name,
                                enabled: !sourceState.mcp.disabledItems.includes(key),
                            });
                        }
                    } catch {
                    }
                }

                mcpGroups.push({
                    key: serverKey,
                    serverName,
                    enabled: serverEnabled,
                    connected,
                    items: serverItems.sort((a, b) => a.name.localeCompare(b.name)),
                });
            }

            const skillService = new SkillCatalogService({ projectPath: input.projectPath });
            const skillEntries = await skillService.listSkills();
            const appsConfig = await Config.getAppsConfig();
            const appItems = Object.entries(appsConfig)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, entry]) => {
                    const globalEnabled = (entry as any).enabled !== false;
                    const topicEnabled = !sourceState.apps.disabledItems.includes(name);
                    return { name, enabled: globalEnabled && topicEnabled };
                });

            return {
                apps: {
                    enabled: sourceState.apps.enabled,
                    items: appItems,
                },
                mcp: {
                    enabled: sourceState.mcp.enabled,
                    groups: mcpGroups,
                },
                skill: {
                    enabled: sourceState.skill.enabled,
                    items: skillEntries.map((skill) => ({
                        name: skill.name,
                        enabled: !sourceState.skill.disabledItems.includes(skill.name),
                    })),
                },
            };
        }),

    setSourceEnabled: publicProcedure
        .input(z.object({
            id: z.string(),
            source: z.enum(['apps', 'mcp', 'skill']),
            enabled: z.boolean(),
        }))
        .mutation(async ({ input, ctx }) => {
            ctx.hostManager.setSourceEnabled(input.id, input.source, input.enabled);
            return { success: true };
        }),

    setItemEnabled: publicProcedure
        .input(z.object({
            id: z.string(),
            source: z.enum(['apps', 'mcp', 'skill']),
            itemName: z.string(),
            enabled: z.boolean(),
        }))
        .mutation(async ({ input, ctx }) => {
            ctx.hostManager.setSourceItemEnabled(input.id, input.source, input.itemName, input.enabled);
            return { success: true };
        }),
});

export const appRouter = router({
    db: dbRouter,
    chat: chatRouter,
    session: sessionRouter,
    project: projectRouter,
    llmConfig: llmConfigRouter,
    modelRegistry: modelRegistryRouter,
    apps: appsRouter,
    mcp: mcpRouter,
    skills: skillsRouter,
    sourceControl: sourceControlRouter,
});

export type AppRouter = typeof appRouter;
