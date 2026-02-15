
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
            // ✅ V2: pause 功能暂未实现
            console.log('[TRPC] chat.pause called:', input.id);
        }),
    resume: publicProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ input, ctx }) => {
            // ✅ V2: resume 功能暂未实现
            console.log('[TRPC] chat.resume called:', input.id);
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

export const appRouter = router({
    db: dbRouter,
    chat: chatRouter,
    session: sessionRouter,
    project: projectRouter,
    llmConfig: llmConfigRouter,
    modelRegistry: modelRegistryRouter,
});

export type AppRouter = typeof appRouter;
