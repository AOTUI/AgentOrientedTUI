/**
 * Host V2 - 完全基于 HostManager V2 的架构
 * 
 * 核心组件:
 * - HostManagerV2: 核心管理器
 * - LLMConfigService: LLM 配置管理
 * - WebSocketHandlerV2: WebSocket 处理
 * - GUIBridge: GUI 事件桥接
 */

import { WebSocketServer } from 'ws';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { createServer as createHttpServer } from 'http';

// ✅ V2 Core Services
import { desktopManager, desktopManagerReady } from '../core/desktop-manager.js';
import { MessageServiceV2 } from '../core/message-service-v2.js';
import { HostManagerV2 } from '../core/host-manager-v2.js';
import { LLMConfigService, initializeLLMConfigService } from '../core/llm-config-service.js';
import { WebSocketHandlerV2 } from './websocket-handler-v2.js';
import { GUIBridge } from './gui-bridge.js';
import * as db from '../db/index.js';
import type { ModelRegistry } from '../services/model-registry.js';

// ═══════════════════════════════════════════════════════════════
//  Express Routes (REST API for Topics/Messages)
// ═══════════════════════════════════════════════════════════════

function setupExpressRoutes(app: express.Application, hostManager?: HostManagerV2): void {
    app.use(cors());
    app.use(express.json());

    // Logging middleware
    app.use((req: Request, _res: Response, next: NextFunction) => {
        console.log(`[HostV2] ${req.method} ${req.path}`);
        next();
    });

    // Topics CRUD
    app.get('/api/topics', (_req: Request, res: Response) => {
        try {
            const topics = db.getAllTopics();
            res.json({ success: true, data: topics });
        } catch (error) {
            console.error('[HostV2] Error getting topics:', error);
            res.status(500).json({ success: false, error: 'Failed to get topics' });
        }
    });

    app.post('/api/topics', async (req: Request, res: Response) => {
        try {
            const { title } = req.body as { title?: string };
            if (!title || typeof title !== 'string') {
                res.status(400).json({ success: false, error: 'Title is required' });
                return;
            }
            const topicId = `desktop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
            const topic = {
                id: topicId,
                title,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                status: 'hot' as const
            };
            db.createTopic(topic);
            
            // ✅ Initialize Session for the new Topic
            if (hostManager) {
                try {
                    await hostManager.ensureSessionForTopic(topicId);
                    console.log(`[HostV2] Session initialized for topic: ${topicId}`);
                } catch (error) {
                    console.error(`[HostV2] Failed to initialize session for topic ${topicId}:`, error);
                    // Continue even if session initialization fails
                }
            }
            
            res.status(201).json({ success: true, data: topic });
        } catch (error) {
            console.error('[HostV2] Error creating topic:', error);
            res.status(500).json({ success: false, error: 'Failed to create topic' });
        }
    });

    app.get('/api/topics/:id', (req: Request, res: Response) => {
        try {
            const topic = db.getTopic(req.params.id);
            if (!topic) {
                res.status(404).json({ success: false, error: 'Topic not found' });
                return;
            }
            res.json({ success: true, data: topic });
        } catch (error) {
            console.error('[HostV2] Error getting topic:', error);
            res.status(500).json({ success: false, error: 'Failed to get topic' });
        }
    });

    app.delete('/api/topics/:id', (req: Request, res: Response) => {
        try {
            db.deleteTopic(req.params.id);
            res.json({ success: true });
        } catch (error) {
            console.error('[HostV2] Error deleting topic:', error);
            res.status(500).json({ success: false, error: 'Failed to delete topic' });
        }
    });

    // Messages CRUD
    app.get('/api/topics/:id/messages', (req: Request, res: Response) => {
        try {
            const topic = db.getTopic(req.params.id);
            if (!topic) {
                res.status(404).json({ success: false, error: 'Topic not found' });
                return;
            }
            const messageService = new MessageServiceV2();
            const messages = messageService.getMessages(req.params.id);
            res.json({ success: true, data: messages });
        } catch (error) {
            console.error('[HostV2] Error getting messages:', error);
            res.status(500).json({ success: false, error: 'Failed to get messages' });
        }
    });

    app.post('/api/topics/:id/messages', (req: Request, res: Response) => {
        try {
            const topicId = req.params.id;
            const { role, content } = req.body as { role?: string; content?: string };

            if (!role || !content) {
                res.status(400).json({ success: false, error: 'Role and content are required' });
                return;
            }
            if (!['user', 'assistant', 'system', 'tool'].includes(role)) {
                res.status(400).json({ success: false, error: 'Invalid role' });
                return;
            }

            const topic = db.getTopic(topicId);
            if (!topic) {
                res.status(404).json({ success: false, error: 'Topic not found' });
                return;
            }

            const messageService = new MessageServiceV2();
            const message = messageService.addMessage(topicId, { role, content } as any);
            db.updateTopic(topicId, { updatedAt: Date.now() });

            res.status(201).json({ success: true, data: message });
        } catch (error) {
            console.error('[HostV2] Error creating message:', error);
            res.status(500).json({ success: false, error: 'Failed to create message' });
        }
    });

    // Health check
    app.get('/api/health', (_req: Request, res: Response) => {
        res.json({ status: 'ok', service: 'host-v2', timestamp: Date.now() });
    });
}

// ═══════════════════════════════════════════════════════════════
//  Main: Create Host V2 Core
// ═══════════════════════════════════════════════════════════════

export async function createHostV2Core(modelRegistry: ModelRegistry): Promise<{
    hostManager: HostManagerV2;
    llmConfigService: LLMConfigService;
    guiBridge: GUIBridge;
    wsHandler: WebSocketHandlerV2;
}> {
    // 1. Wait for Runtime initialization
    await desktopManagerReady;
    console.log('[HostV2] DesktopManager initialized');

    // 2. Initialize database
    await db.initDatabase();

    // 3. Create LLM Config Service (with ModelRegistry) and initialize singleton
    const llmConfigService = initializeLLMConfigService(modelRegistry);

    // 初始化默认配置
    llmConfigService.initializeDefaultConfigs();
    console.log('[HostV2] LLM Config Service initialized');

    // 4. Create HostManager V2 (with ModelRegistry)
    const hostManager = new HostManagerV2('default_topic', modelRegistry);
    console.log('[HostV2] HostManager V2 initialized');

    // 5. 获取 Kernel (SessionManagerV3 will create Desktops on-demand)
    const kernel = desktopManager.getKernel();
    console.log('[HostV2] Kernel ready for Session-based Desktop creation');

    // 6. 初始化 SessionManagerV3（与是否已有 active LLM 配置解耦）
    // ⚠️ 不再需要提前创建 Desktop，SessionManagerV3 会按需创建
    // initAgentDriver 内部会创建 SessionManagerV3，并在 ensureSession/createSession 时读取当前 active config
    const desktop = {} as any; // Placeholder - no longer needed
    await hostManager.initAgentDriver(desktop, kernel, desktopManager);

    const activeConfig = await llmConfigService.getActiveLLMConfig();
    if (activeConfig) {
        console.log('[HostV2] SessionManagerV3 initialized via HostManager with config:', activeConfig.model);
    } else {
        console.warn('[HostV2] SessionManagerV3 initialized without active LLM config; awaiting user configuration');
    }

    // 7. Create GUIBridge
    const guiBridge = new GUIBridge(hostManager);
    console.log('[HostV2] GUIBridge initialized');

    // 8. Create WebSocket Handler V2
    const wsHandler = new WebSocketHandlerV2(hostManager, guiBridge);
    console.log('[HostV2] WebSocketHandler V2 initialized');

    return { hostManager, llmConfigService, guiBridge, wsHandler };
}

export async function createHostV2(port: number = 8080, modelRegistry: ModelRegistry): Promise<WebSocketServer> {
    console.log('[HostV2] Starting Host V2 with AgentDriver V2 architecture...');

    const { hostManager, llmConfigService, wsHandler } = await createHostV2Core(modelRegistry);

    // 3. Setup Express (pass hostManager for Session initialization on Topic creation)
    const app = express();
    setupExpressRoutes(app, hostManager);

    // 4. Create HTTP + WebSocket servers
    const server = createHttpServer(app);
    const wss = new WebSocketServer({ server });

    // ✅ 使用 WebSocketHandlerV2
    wss.on('connection', (ws) => {
        wsHandler.handleConnection(ws);
    });

    // Expose httpServer for testing
    (wss as any).httpServer = server;

    return new Promise((resolve) => {
        server.listen(port, () => {
            console.log(`[HostV2] Server listening on port ${port}`);
            console.log(`[HostV2] ✅ AgentDriver V2 architecture fully integrated`);
            resolve(wss);
        });
    });
}
