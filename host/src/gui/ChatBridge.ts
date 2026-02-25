/**
 * ChatBridge - Host Connection Client for GUI
 * 
 * - IPC (Electron tRPC): Topics/Messages/Snapshot/Agent 状态
 */
import type { Message, Topic, Project } from '../types.js';
import { createTRPCProxyClient } from '@trpc/client';
import type { Unsubscribable } from '@trpc/server/observable';
import { ipcLink } from 'electron-trpc/renderer';
import superjson from 'superjson';
import type { AppRouter } from '../trpc/router-types.js';

// Event types for subscribers
export interface ChatUpdateEvent {
    type: 'message' | 'topic' | 'snapshot' | 'agent_state' | 'agent_thought' | 'agent_reasoning' | 'agent_paused' | 'agent_resumed' | 'desktop_destroyed' | 'init' | 'message_update';
    topicId?: string;
    data?: unknown;
}

export type ChatSubscriber = (event: ChatUpdateEvent) => void;

// ============ ChatBridge ============

export class ChatBridge {
    private static instance: ChatBridge | null = null;

    // Connections
    private trpcClient: ReturnType<typeof createTRPCProxyClient<AppRouter>> | null = null;
    private trpcSubscriptions: Map<string, Unsubscribable> = new Map();

    // State
    private projects: Project[] = []; // [RFC-025]
    private topics: Map<string, Topic> = new Map();
    private messages: Map<string, Message[]> = new Map();
    private snapshots: Map<string, string> = new Map();
    private agentStates: Map<string, string> = new Map();
    private agentPaused: Map<string, boolean> = new Map();  // [RFC-014]
    private agentThoughts: Map<string, string> = new Map();
    private agentReasoning: Map<string, string> = new Map();
    private subscribers: Set<ChatSubscriber> = new Set();
    private activeTopicId: string | null = null;

    private constructor() {
        // Private constructor for singleton
    }

    static getInstance(): ChatBridge {
        if (!ChatBridge.instance) {
            ChatBridge.instance = new ChatBridge();
        }
        return ChatBridge.instance;
    }

    // ============ Connection ============

    async connect(): Promise<void> {
        if (!this.isIpcAvailable()) {
            console.error('[ChatBridge] Electron IPC not available. ChatBridge requires Electron environment.');
            return;
        }
        await this.loadInitialData();
    }

    private async loadInitialData(): Promise<void> {
        try {
            const topics = await this.getTrpcClient().db.getTopics.query();
            topics.forEach((t: Topic) => this.topics.set(t.id, t));

            // [RFC-025] Load projects
            this.projects = await this.getTrpcClient().project.list.query();

            this.notify({ type: 'init' });
        } catch (error) {
            console.error('[ChatBridge] Failed to load initial data:', error);
        }
    }

    private async loadMessagesForTopic(topicId: string): Promise<void> {
        try {
            // [RFC-026] Use getMessagesWithParts to retrieve complete structured data
            // Same data source as LLM (ConversationManager.getHistory)
            const messages = await this.getTrpcClient().db.getMessagesWithParts.query({ id: topicId });
            const normalized = this.normalizeMessages(messages);
            this.messages.set(topicId, normalized);
        } catch (error) {
            console.error(`[ChatBridge] Failed to load messages for topic ${topicId}:`, error);
        }
    }

    isConnected(): boolean {
        return this.isIpcAvailable();
    }

    // ============ Host Message Handling ============

    private handleHostMessage(msg: any): void {
        console.log('[ChatBridge] Host message:', msg.type);

        switch (msg.type) {
            case 'init':
                // Host sends available desktops
                console.log('[ChatBridge] Host desktops:', msg.desktops);
                break;

            case 'desktop_created':
                // Desktop created, store snapshot
                if (msg.snapshot) {
                    this.snapshots.set(msg.desktopId, msg.snapshot);
                }
                this.notify({ type: 'snapshot', topicId: msg.desktopId });
                break;

            case 'snapshot':
                this.snapshots.set(msg.desktopId, msg.markup);
                this.notify({ type: 'snapshot', topicId: msg.desktopId });
                break;

            case 'agent_state':
                this.agentStates.set(msg.desktopId, msg.state);
                if (msg.state === 'IDLE' || msg.state === 'EXECUTING') {
                    this.agentThoughts.set(msg.desktopId, '');
                    this.agentReasoning.set(msg.desktopId, '');
                }
                this.notify({ type: 'agent_state', topicId: msg.desktopId, data: msg.state });
                break;

            case 'agent_thought':
                const incomingThought = msg.content || '';
                const currentThought = this.agentThoughts.get(msg.desktopId) || '';

                // Hybrid Strategy:
                // 1. If incoming starts with current, Host is sending accumulated text -> Replace
                // 2. Otherwise, Host is sending chunks -> Append
                if (incomingThought.startsWith(currentThought)) {
                    this.agentThoughts.set(msg.desktopId, incomingThought);
                } else {
                    this.agentThoughts.set(msg.desktopId, currentThought + incomingThought);
                }

                this.notify({ type: 'agent_thought', topicId: msg.desktopId, data: this.agentThoughts.get(msg.desktopId) });
                break;

            case 'agent_reasoning':
                const incomingReasoning = msg.content || '';
                const currentReasoning = this.agentReasoning.get(msg.desktopId) || '';

                // Hybrid Strategy for Reasoning:
                // 1. If incoming starts with current, Host is sending accumulated text -> Replace
                // 2. Otherwise, Host is sending chunks -> Append
                if (currentReasoning && incomingReasoning.startsWith(currentReasoning)) {
                    this.agentReasoning.set(msg.desktopId, incomingReasoning);
                } else {
                    this.agentReasoning.set(msg.desktopId, currentReasoning + incomingReasoning);
                }

                this.notify({ type: 'agent_reasoning', topicId: msg.desktopId, data: this.agentReasoning.get(msg.desktopId) });
                break;

            // [RFC-021] Message events from dual-trigger architecture
            case 'message_received':
                // Acknowledgment that message was received by Host
                console.log('[ChatBridge] Message received by Host:', msg.messageId);
                break;

            case 'message_delta': {
                const topicId = msg.desktopId;
                const delta = msg.delta as string;
                const msgs = this.messages.get(topicId) || [];
                const lastMsg = msgs[msgs.length - 1];

                if (lastMsg && lastMsg.role === 'assistant' && lastMsg.messageType !== 'tool_call') {
                    // Append to existing message
                    lastMsg.content += delta;
                    // Trigger UI update
                    this.notify({ type: 'message', topicId, data: lastMsg });
                } else {
                    // Create new streaming message placeholder
                    const newMsg: Message = {
                        id: `msg_${Date.now()}_assistant`,
                        role: 'assistant',
                        content: delta,
                        timestamp: Date.now()
                    };
                    msgs.push(newMsg);
                    this.messages.set(topicId, msgs);
                    this.notify({ type: 'message', topicId, data: newMsg });
                }
                break;
            }

            case 'message_update':
                // Handle message updates (e.g. final reasoning content)
                const updatedMsg = msg.message as Message;
                const updateTopicId = msg.desktopId;
                const updateMsgs = this.messages.get(updateTopicId) || [];

                const updateIdx = updateMsgs.findIndex(m => m.id === updatedMsg.id);
                if (updateIdx !== -1) {
                    updateMsgs[updateIdx] = updatedMsg;
                    this.messages.set(updateTopicId, updateMsgs);
                    this.notify({ type: 'message', topicId: updateTopicId, data: updatedMsg });
                }
                break;

            case 'new_message':
                // New message broadcast (from Agent response or other sources)
                const newMsg = msg.message as Message;
                const topicId = msg.desktopId;
                this.touchTopic(topicId, newMsg.timestamp || Date.now());
                const msgs = this.messages.get(topicId) || [];

                // Dedup: check if message already exists (optimistic update may have added it)
                // [Fix] Also check if we have a streaming message that matches this one?
                // For now, simpler check: if ID matches, update content (final sync). 
                // If ID doesn't match but we have a partial last message, maybe replace it?
                // Let's stick to simple ID dedup for now.
                const existingIdx = msgs.findIndex(m => m.id === newMsg.id);
                if (existingIdx !== -1) {
                    // Update existing (e.g. confirmed timestamp or full content)
                    msgs[existingIdx] = newMsg;
                    this.messages.set(topicId, msgs);
                    this.notify({ type: 'message', topicId, data: newMsg });
                } else {
                    // Special Handling: If the last message was a "streaming placeholder" (generated in message_delta),
                    // and this new_message is the FINAL version of it, we might end up with duplicates if IDs differ.
                    // However, SignalRouter generates ID for final message.
                    // We should probably rely on the UI to handle this or replace the last "assistant" message if it was streaming.
                    // For safety in this fix: Just push it. The delta handler reuses the last message if assistant.
                    msgs.push(newMsg);
                    this.messages.set(topicId, msgs);
                    this.notify({ type: 'message', topicId, data: newMsg });
                }
                break;

            // [RFC-014] Agent Lifecycle Events
            case 'agent_paused':
                this.agentPaused.set(msg.desktopId, true);
                this.notify({ type: 'agent_paused', topicId: msg.desktopId, data: true });
                break;

            case 'agent_resumed':
                this.agentPaused.set(msg.desktopId, false);
                this.notify({ type: 'agent_resumed', topicId: msg.desktopId, data: false });
                break;

            case 'desktop_destroyed':
                this.snapshots.delete(msg.desktopId);
                this.agentStates.delete(msg.desktopId);
                this.agentPaused.delete(msg.desktopId);
                this.notify({ type: 'desktop_destroyed', topicId: msg.desktopId });
                break;

            case 'error':
                console.error('[ChatBridge] Host error:', msg.message);
                break;
        }
    }

    // ============ API - Topics ============

    async createTopic(
        title: string,
        projectId?: string,
        options?: {
            modelOverride?: string;
            promptOverride?: string;
            sourceControls?: {
                apps: { enabled: boolean; disabledItems: string[] };
                mcp: { enabled: boolean; disabledItems: string[] };
                skill: { enabled: boolean; disabledItems: string[] };
            };
        }
    ): Promise<Topic | null> {
        try {
            const topic = await this.getTrpcClient().db.createTopic.mutate({
                title,
                projectId,
                modelOverride: options?.modelOverride,
                promptOverride: options?.promptOverride,
                sourceControls: options?.sourceControls,
            });
            this.topics.set(topic.id, topic);
            this.messages.set(topic.id, []);
            this.activeTopicId = topic.id;
            // [Refactor] Do NOT create Runtime Session eagerly.
            // Session will be auto-created by Backend when the first message is sent.
            // await this.ensureSessionReady(topic.id, true); 
            this.notify({ type: 'topic', topicId: topic.id });
            return topic;
        } catch (error) {
            console.error('[ChatBridge] Error creating topic:', error);
            return null;
        }
    }

    // ============ API - Messages ============

    async sendMessage(topicId: string, content: string): Promise<Message | null> {
        try {
            // 1. Ensure Desktop is active (Lazy Activation)
            await this.activateDesktop(topicId);

            const messageId = `msg_${Date.now()}`;

            await this.ensureSessionReady(topicId, true);

            // Optimistic update: Add message to local state immediately
            // [Fix] Move Optimistic Update BEFORE network call for instant feedback
            const optimisticMessage: Message = {
                id: messageId,
                role: 'user',
                content,
                timestamp: Date.now()
            };

            const msgs = this.messages.get(topicId) || [];
            msgs.push(optimisticMessage);
            this.messages.set(topicId, msgs);
            this.touchTopic(topicId, optimisticMessage.timestamp);
            this.notify({ type: 'message', topicId, data: optimisticMessage });

            // [Fix] Race Condition: Give tRPC Subscription a moment to establish handshake
            // before sending the message that triggers the stream.
            await new Promise(resolve => setTimeout(resolve, 50));

            await this.getTrpcClient().chat.send.mutate({
                id: topicId,
                content,
                messageId
            });

            return optimisticMessage;
        } catch (error) {
            console.error('[ChatBridge] Error sending message:', error);
            throw error;
        }
    }

    // ============ API - Snapshots ============

    async requestSnapshot(topicId: string): Promise<void> {
        if (!this.snapshots.has(topicId)) {
            return;
        }
        const snapshot = await this.getTrpcClient().session.snapshot.query({ id: topicId });
        if (snapshot) {
            this.snapshots.set(topicId, (snapshot as any)?.markup ?? null);
            this.notify({ type: 'snapshot', topicId });
        }
    }

    // ============ [RFC-014] Agent Lifecycle Control ============

    async pauseAgent(topicId: string): Promise<void> {
        await this.ensureSessionReady(topicId, true);
        await this.getTrpcClient().chat.pause.mutate({ id: topicId });
    }

    async resumeAgent(topicId: string): Promise<void> {
        await this.ensureSessionReady(topicId, true);
        await this.getTrpcClient().chat.resume.mutate({ id: topicId });
    }

    async destroyDesktop(topicId: string): Promise<void> {
        await this.getTrpcClient().session.destroy.mutate({ id: topicId });
        const subscription = this.trpcSubscriptions.get(topicId);
        subscription?.unsubscribe();
        this.trpcSubscriptions.delete(topicId);
    }

    // ============ [RFC-025] Project Management ============

    getProjects(): Project[] {
        return this.projects;
    }

    async createProject(path: string, name?: string): Promise<Project> {
        const project = await this.getTrpcClient().project.create.mutate({ path, name });
        this.projects = await this.getTrpcClient().project.list.query();
        this.notify({ type: 'init' }); // Notify global update
        return project;
    }

    async deleteProject(id: string): Promise<void> {
        await this.getTrpcClient().project.delete.mutate({ id });
        this.projects = await this.getTrpcClient().project.list.query();
        this.notify({ type: 'init' });
    }

    async openProject(id: string): Promise<void> {
        await this.getTrpcClient().project.open.mutate({ id });
        this.projects = await this.getTrpcClient().project.list.query();
        this.notify({ type: 'init' });
    }

    async pickProjectFolder(): Promise<string | null> {
        return await this.getTrpcClient().project.pickFolder.mutate();
    }

    // [RFC-015] Shutdown: 关机但保留数据
    async shutdownDesktop(topicId: string): Promise<void> {
        await this.getTrpcClient().session.shutdown.mutate({ id: topicId });
    }

    async deleteTopic(topicId: string): Promise<void> {
        try {
            await this.getTrpcClient().db.deleteTopic.mutate({ id: topicId });
            this.topics.delete(topicId);
            this.messages.delete(topicId);
            this.snapshots.delete(topicId);
            this.notify({ type: 'topic', topicId });
        } catch (error) {
            console.error('[ChatBridge] Failed to delete topic:', error);
        }
    }

    async renameTopic(topicId: string, newTitle: string): Promise<void> {
        try {
            await this.getTrpcClient().db.renameTopic.mutate({ id: topicId, title: newTitle });
            const topic = this.topics.get(topicId);
            if (topic) {
                this.topics.set(topicId, { ...topic, title: newTitle, updatedAt: Date.now() });
                this.notify({ type: 'topic', topicId });
            }
        } catch (error) {
            console.error('[ChatBridge] Failed to rename topic:', error);
        }
    }

    isAgentPaused(topicId: string): boolean {
        return this.agentPaused.get(topicId) || false;
    }

    getAgentState(topicId: string): string {
        return this.agentStates.get(topicId) || 'IDLE';
    }

    /**
     * 计算用于 UI 展示的 Agent 显示状态
     * 
     * - sleeping: Session 未激活（不封驱 Desktop）
     * - paused:   Session 已激活且用户点击了暂停
     * - working:  AgentDriver 处于 thinking / executing
     * - idle:     Session 已激活，AgentDriver 空闲等待
     */
    getDisplayAgentState(topicId: string): 'sleeping' | 'idle' | 'working' | 'paused' {
        if (!this.agentStates.has(topicId)) return 'sleeping';
        if (this.agentPaused.get(topicId)) return 'paused';
        const state = this.agentStates.get(topicId) || 'IDLE';
        if (state === 'THINKING' || state === 'EXECUTING') return 'working';
        return 'idle';
    }

    // ============ Topic Management ============

    getTopics(): Topic[] {
        // Return sorted by updated time desc
        return Array.from(this.topics.values())
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    getTopic(topicId: string): Topic | undefined {
        return this.topics.get(topicId);
    }

    getMessages(topicId: string): Message[] {
        const msgs = this.messages.get(topicId) || [];
        return this.normalizeMessages(msgs);
    }

    getSnapshot(topicId: string): string {
        // Return offline state if no snapshot
        return this.snapshots.get(topicId) || '<div class="offline">Desktop Offline (Send message to wake agent)</div>';
    }

    getAgentThinking(topicId: string): string {
        const state = this.agentStates.get(topicId);
        const thought = this.agentThoughts.get(topicId) || '';
        if (thought) return thought;
        return state === 'THINKING' || state === 'EXECUTING' ? 'Agent is thinking...' : '';
    }

    getAgentReasoning(topicId: string): string {
        return this.agentReasoning.get(topicId) || '';
    }

    getActiveTopicId(): string | null {
        return this.activeTopicId;
    }

    async setActiveTopic(topicId: string): Promise<void> {
        if (this.topics.has(topicId)) {
            this.activeTopicId = topicId;

            // Load messages if not already loaded
            if (!this.messages.has(topicId)) {
                await this.loadMessagesForTopic(topicId);
            }

            this.notify({ type: 'topic', topicId });
        }
    }

    /**
     * Explicitly activate the desktop connection
     */
    async activateDesktop(topicId: string): Promise<void> {
        await this.ensureSessionReady(topicId, true);

        // Check if we already have a snapshot (proxy for "is active")
        if (!this.snapshots.has(topicId)) {
            const snapshot = await this.getTrpcClient().session.snapshot.query({ id: topicId });
            if (snapshot) {
                this.snapshots.set(topicId, (snapshot as any)?.markup ?? null);
                this.notify({ type: 'snapshot', topicId });
            }
        }
    }

    // ============ Subscription ============

    subscribe(callback: ChatSubscriber): () => void {
        this.subscribers.add(callback);
        return () => this.subscribers.delete(callback);
    }

    private notify(event: ChatUpdateEvent): void {
        this.subscribers.forEach(cb => cb(event));
    }

    private touchTopic(topicId: string, updatedAt: number = Date.now()): void {
        const topic = this.topics.get(topicId);
        if (!topic) {
            return;
        }

        this.topics.set(topicId, {
            ...topic,
            updatedAt,
        });
    }

    // ============ Utilities ============

    private isIpcAvailable(): boolean {
        return typeof (globalThis as any).electronTRPC !== 'undefined';
    }

    /**
     * Public method to access tRPC client for direct API calls
     */
    public getTrpcClient(): ReturnType<typeof createTRPCProxyClient<AppRouter>> {
        if (!this.trpcClient) {
            this.trpcClient = createTRPCProxyClient<AppRouter>({
                transformer: superjson,
                links: [ipcLink()],
            });
        }
        return this.trpcClient;
    }

    private async ensureSessionReady(topicId: string, lazy: boolean): Promise<void> {
        await this.getTrpcClient().session.create.mutate({ id: topicId, lazy });
        this.ensureSessionSubscription(topicId);
    }

    /**
     * ✅ 修复：适配 AI SDK v6 的 ModelMessage 格式
     * 
     * AI SDK v6 格式：
     * - UserMessage: { role: 'user', content: string | Array<TextPart | ImagePart | FilePart> }
     * - AssistantMessage: { role: 'assistant', content: string | Array<TextPart | ToolCallPart | ReasoningPart> }
     * - ToolMessage: { role: 'tool', content: Array<ToolResultPart> }
     */
    private normalizeMessages(messages: any[]): Message[] {
        const toolNamesByCallId = new Map<string, string>();

        return messages.map(m => {
            if (m?.messageType) {
                return m as Message;
            }
            // ✅ 处理 AI SDK v6 ModelMessage 格式
            if (m.role === 'user') {
                return this.normalizeUserMessage(m);
            } else if (m.role === 'assistant') {
                return this.normalizeAssistantMessage(m, toolNamesByCallId);
            } else if (m.role === 'tool') {
                return this.normalizeToolMessage(m, toolNamesByCallId);
            } else if (m.role === 'system') {
                return this.normalizeSystemMessage(m);
            }

            // 兜底：旧格式消息
            return this.normalizeLegacyMessage(m, toolNamesByCallId);
        });
    }

    /**
     * 规范化 User 消息
     */
    private normalizeUserMessage(m: any): Message {
        let contentText = '';

        if (typeof m.content === 'string') {
            contentText = m.content;
        } else if (Array.isArray(m.content)) {
            // 提取所有 text parts
            const textParts = m.content
                .filter((part: any) => part.type === 'text')
                .map((part: any) => part.text || '');
            contentText = textParts.join('\n');
        }

        return {
            ...m,
            content: contentText,
            messageType: 'text'
        };
    }

    /**
     * 规范化 Assistant 消息
     */
    private normalizeAssistantMessage(m: any, toolNamesByCallId: Map<string, string>): Message {
        if (typeof m.content === 'string') {
            const parsedParts = this.tryParseContentParts(m.content);
            if (parsedParts) {
                return this.normalizeAssistantMessage({ ...m, content: parsedParts }, toolNamesByCallId);
            }
            return {
                ...m,
                content: m.content,
                messageType: 'text'
            };
        }

        if (!Array.isArray(m.content)) {
            return m;
        }

        // 解析 content parts
        const textParts: string[] = [];
        let reasoning = '';
        const toolCalls: any[] = [];

        for (const part of m.content) {
            const partTyped = part as any;

            if (partTyped.type === 'text') {
                textParts.push(partTyped.text || '');
            } else if (partTyped.type === 'tool-call') {
                const toolInput = partTyped.args ?? partTyped.input;
                toolCalls.push({
                    toolCallId: partTyped.toolCallId,
                    toolName: partTyped.toolName,
                    args: toolInput,
                    input: toolInput,
                });
                // 记录 tool call ID → tool name 映射
                toolNamesByCallId.set(partTyped.toolCallId, partTyped.toolName);
            } else if (partTyped.type === 'reasoning' || partTyped.type === '思考链') {
                reasoning += (partTyped.text || '');
            }
        }

        const reasoningBlock = reasoning ? `Reasoning:\n${reasoning}` : '';

        // 决定消息类型
        if (toolCalls.length > 0) {
            const toolDetails = toolCalls
                .map(tc => {
                    const args = tc.args ? `\nArgs: ${JSON.stringify(tc.args)}` : '';
                    return `Tool Call: ${tc.toolName}${args}`;
                })
                .join('\n');

            const content = [reasoningBlock, toolDetails].filter(Boolean).join('\n\n');

            // Tool call 消息
            return {
                ...m,
                content,
                messageType: 'tool_call',
                metadata: {
                    toolName: toolCalls[0].toolName,
                    toolCallId: toolCalls[0].toolCallId,
                    args: toolCalls[0].args,
                    input: toolCalls[0].input,
                    reasoning: reasoning || undefined
                }
            };
        }

        if (reasoning && textParts.length > 0) {
            const content = [reasoningBlock, textParts.join('\n')].filter(Boolean).join('\n\n');
            return {
                ...m,
                content,
                messageType: 'text'
            };
        }

        if (reasoning) {
            // Reasoning-only 消息
            return {
                ...m,
                content: reasoningBlock,
                messageType: 'reasoning',
                metadata: {
                    reasoning
                }
            };
        }

        // 纯文本消息
        return {
            ...m,
            content: textParts.join('\n'),
            messageType: 'text'
        };
    }

    /**
     * 规范化 Tool 消息
     */
    private normalizeToolMessage(m: any, toolNamesByCallId: Map<string, string>): Message {
        if (!Array.isArray(m.content)) {
            return m;
        }

        // 提取第一个 tool-result part
        const resultPart = m.content.find((part: any) => part.type === 'tool-result');
        if (!resultPart) {
            return m;
        }

        const toolCallId = resultPart.toolCallId;
        const toolName = resultPart.toolName || toolNamesByCallId.get(toolCallId) || 'Unknown Tool';
        const rawOutput = resultPart.output ?? resultPart.result;
        const { result, displayContent, isError } = this.normalizeToolOutput(rawOutput, resultPart.isError);

        // 构造显示内容
        return {
            ...m,
            content: displayContent,
            messageType: 'tool_result',
            metadata: {
                toolCallId,
                toolName,
                result,
                isError
            }
        };
    }

    /**
     * 规范化 System 消息
     */
    private normalizeSystemMessage(m: any): Message {
        return {
            ...m,
            content: typeof m.content === 'string' ? m.content : '',
            messageType: 'text'
        };
    }

    /**
     * 规范化旧格式消息（兜底逻辑）
     */
    private normalizeLegacyMessage(m: any, toolNamesByCallId: Map<string, string>): Message {
        // 旧格式：可能有 parts 字段
        if (m.parts && m.parts.length > 0) {
            return this.rebuildMessageFromParts(m);
        }

        // 旧格式：简单的 content 字符串
        if (!m.messageType && typeof m.content === 'string') {
            const calledMatch = m.content.match(/^Called\s+(.+)$/);
            if (m.role === 'assistant' && calledMatch) {
                const toolName = calledMatch[1];
                toolNamesByCallId.set(m.id, toolName);
                return {
                    ...m,
                    messageType: 'tool_call',
                    metadata: {
                        ...(m.metadata || {}),
                        toolName,
                        toolCallId: m.metadata?.toolCallId || m.id,
                        args: m.metadata?.args
                    }
                };
            }
            if (m.role === 'tool') {
                let parsed: any = null;
                try {
                    parsed = JSON.parse(m.content);
                } catch {
                    parsed = m.content;
                }
                const toolCallId = m.metadata?.toolCallId || m.id;
                const resolvedToolName = m.metadata?.toolName || toolNamesByCallId.get(toolCallId) || toolCallId;
                return {
                    ...m,
                    messageType: 'tool_result',
                    metadata: {
                        ...(m.metadata || {}),
                        toolName: resolvedToolName,
                        toolCallId,
                        result: parsed,
                        isError: m.metadata?.isError === true
                    }
                };
            }
        }

        return m;
    }

    /**
     * [RFC-026] Rebuild message content from message_parts
     */
    private rebuildMessageFromParts(msg: any): Message {
        const parts = msg.parts || [];

        // Build displayable content from parts
        const contentParts: string[] = [];
        let reasoning = '';
        let hasToolCalls = false;
        let firstToolCall: { toolName?: string; toolCallId?: string; args?: unknown } | null = null;
        let firstToolResult: { toolName?: string; toolCallId?: string; result?: unknown; isError?: boolean } | null = null;

        for (const part of parts) {
            if (part.partType === 'text') {
                contentParts.push(part.textContent);
            } else if (part.partType === 'reasoning') {
                reasoning = part.textContent;
                contentParts.push(`💭 Thinking: ${part.textContent}`);
            } else if (part.partType === 'tool-call') {
                hasToolCalls = true;
                contentParts.push(`🔧 Called ${part.toolName}`);
                if (!firstToolCall) {
                    firstToolCall = {
                        toolName: part.toolName,
                        toolCallId: part.toolCallId,
                        args: part.input,
                    };
                }
            } else if (part.partType === 'tool-result') {
                const status = part.isError ? '❌' : '✅';
                contentParts.push(`${status} Result`);
                if (!firstToolResult) {
                    firstToolResult = {
                        toolName: part.toolName,
                        toolCallId: part.toolCallId,
                        result: part.output,
                        isError: Boolean(part.isError),
                    };
                }
            }
        }

        const displayContent = contentParts.join('\n');

        return {
            ...msg,
            content: displayContent,
            messageType: hasToolCalls ? 'tool_call' : (firstToolResult ? 'tool_result' : undefined),
            metadata: {
                ...(msg.metadata || {}),
                reasoning,
                ...(firstToolCall
                    ? {
                        toolName: firstToolCall.toolName,
                        toolCallId: firstToolCall.toolCallId,
                        args: firstToolCall.args,
                        input: firstToolCall.args,
                    }
                    : {}),
                ...(firstToolResult
                    ? {
                        toolName: firstToolResult.toolName,
                        toolCallId: firstToolResult.toolCallId,
                        result: firstToolResult.result,
                        isError: firstToolResult.isError,
                    }
                    : {}),
            }
        };
    }

    private ensureSessionSubscription(topicId: string): void {
        if (this.trpcSubscriptions.has(topicId)) {
            return;
        }
        const subscription = this.getTrpcClient().session.events.subscribe(
            { id: topicId },
            {
                onData: (event: unknown) => {
                    // [Fix] Inject topicId into the event context because some broadcast events 
                    // (like message_delta) do not carry desktopId/sessionId payload.
                    this.handleSessionEvent(event as Record<string, unknown>, topicId);
                },
                onError: (error: unknown) => {
                    console.error('[ChatBridge] tRPC session events error:', error);
                },
            }
        );
        this.trpcSubscriptions.set(topicId, subscription);
    }

    private handleSessionEvent(event: Record<string, unknown>, contextTopicId?: string): void {
        // GuiUpdateEvent format: { topicId, type: 'assistant'|'tool'|'user', message: ModelMessage }
        const eventType = (event as any).type;
        const topicId = (event as any).topicId || contextTopicId;
        const message = (event as any).message;

        console.log('[ChatBridge] SessionEvent:', {
            eventType,
            topicId,
            role: message?.role,
            contentType: Array.isArray(message?.content) ? 'parts' : typeof message?.content,
            partTypes: Array.isArray(message?.content)
                ? message.content.map((part: any) => part?.type).filter(Boolean)
                : undefined,
        });

        // Handle AI SDK v6 GuiUpdateEvent (from SessionManagerV3 → HostManagerV2)
        if (eventType === 'agent_state' && topicId) {
            const state = (event as any).state as string | undefined;
            if (state) {
                this.agentStates.set(topicId, state.toUpperCase());
                this.notify({ type: 'agent_state', topicId, data: state.toUpperCase() });
            }
            return;
        }

        if (eventType === 'agent_paused' && topicId) {
            this.agentPaused.set(topicId, true);
            this.notify({ type: 'agent_paused', topicId, data: true });
            return;
        }

        if (eventType === 'agent_resumed' && topicId) {
            this.agentPaused.set(topicId, false);
            this.notify({ type: 'agent_resumed', topicId, data: false });
            return;
        }

        if ((eventType === 'assistant' || eventType === 'tool' || eventType === 'user') && message) {
            console.log(`[ChatBridge] GuiUpdateEvent: type=${eventType}, topicId=${topicId}, role=${message?.role}`);
            this.handleGuiUpdateEvent(topicId, eventType, message);
            return;
        }

        // Fallback: legacy event format
        const msg = {
            ...event,
            desktopId: (event as any).desktopId ?? (event as any).sessionId ?? contextTopicId
        };
        this.handleHostMessage(msg);
    }

    /**
     * 处理 GuiUpdateEvent (AI SDK v6 ModelMessage 格式)
     * 将 LLM 返回的消息实时添加到聊天界面
     */
    private handleGuiUpdateEvent(topicId: string, type: string, modelMessage: any): void {
        if (!topicId) return;

        const msgs = this.messages.get(topicId) || [];

        const normalized = this.normalizeMessages([modelMessage]);
        const normalizedMessage = normalized[0];

        // 将 AI SDK v6 ModelMessage 转换为 GUI Message
        const guiMessage: Message = {
            ...(normalizedMessage || {}),
            id: normalizedMessage?.id || modelMessage.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            role: normalizedMessage?.role || modelMessage.role || type,
            content: normalizedMessage?.content ?? this.extractContentFromModelMessage(modelMessage),
            timestamp: normalizedMessage?.timestamp || modelMessage.timestamp || Date.now(),
        };

        // Dedup: 检查消息是否已存在
        const existingIdx = msgs.findIndex(m => m.id === guiMessage.id);
        if (existingIdx !== -1) {
            msgs[existingIdx] = guiMessage;
        } else {
            msgs.push(guiMessage);
        }

        this.messages.set(topicId, msgs);
        this.notify({ type: 'message', topicId, data: guiMessage });
    }

    /**
     * 从 AI SDK v6 ModelMessage 提取可显示的文本内容
     */
    private extractContentFromModelMessage(msg: any): string {
        if (!msg) return '';

        // content 是 string
        if (typeof msg.content === 'string') return msg.content;

        // content 是 Array (AI SDK v6 content parts)
        if (Array.isArray(msg.content)) {
            const parts: string[] = [];
            for (const part of msg.content) {
                if (typeof part === 'string') {
                    parts.push(part);
                } else if (part.type === 'text') {
                    parts.push(part.text || '');
                } else if (part.type === 'reasoning') {
                    // 推理内容也显示
                    parts.push(part.text || '');
                } else if (part.type === 'tool-call') {
                    parts.push(`[Tool Call: ${part.toolName}]`);
                } else if (part.type === 'tool-result') {
                    const rawOutput = part.output ?? part.result;
                    const { displayContent } = this.normalizeToolOutput(rawOutput);
                    const resultStr = displayContent || '';
                    parts.push(`[Tool Result: ${resultStr}]`);
                }
            }
            return parts.join('');
        }

        return String(msg.content || '');
    }

    private tryParseContentParts(content: string): any[] | null {
        if (!content || content[0] !== '[') {
            return null;
        }

        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed) && parsed.every(item => typeof item === 'object' && item !== null && 'type' in item)) {
                return parsed;
            }
        } catch {
            return null;
        }

        return null;
    }

    private normalizeToolOutput(rawOutput: any, isErrorFlag?: boolean): { result: any; displayContent: string; isError: boolean } {
        let isError = Boolean(isErrorFlag);
        let result = rawOutput;

        if (rawOutput && typeof rawOutput === 'object' && 'type' in rawOutput) {
            const output = rawOutput as { type: string; value?: unknown; reason?: string };
            if (output.type === 'json' || output.type === 'text') {
                result = output.value ?? '';
            } else if (output.type === 'error-json') {
                result = output.value ?? '';
                isError = true;
            } else if (output.type === 'execution-denied') {
                result = { type: output.type, reason: output.reason };
                isError = true;
            }
        }

        if (!isError && result && typeof result === 'object' && 'success' in result) {
            const successValue = (result as { success?: unknown }).success;
            if (typeof successValue === 'boolean' && successValue === false) {
                isError = true;
            }
        }

        const displayContent = typeof result === 'string'
            ? result
            : JSON.stringify(result, null, 2);

        return { result, displayContent, isError };
    }

    // ============ LLM Config Methods ============

    async getAllLLMConfigs(): Promise<any[]> {
        return this.getTrpcClient().llmConfig.getAll.query();
    }

    async getActiveLLMConfig(): Promise<any | null> {
        return this.getTrpcClient().llmConfig.getActive.query();
    }

    async createLLMConfig(data: any): Promise<any> {
        return this.getTrpcClient().llmConfig.create.mutate(data);
    }

    async updateLLMConfig(id: number, data: any): Promise<void> {
        await this.getTrpcClient().llmConfig.update.mutate({ id, data });
    }

    async deleteLLMConfig(id: number): Promise<void> {
        await this.getTrpcClient().llmConfig.delete.mutate({ id });
    }

    async setActiveLLMConfig(id: number): Promise<void> {
        await this.getTrpcClient().llmConfig.setActive.mutate({ id });
    }
}

// Export singleton getter
export function useChatBridge(): ChatBridge {
    return ChatBridge.getInstance();
}
