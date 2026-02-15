
import { describe, it, expect, vi } from 'vitest';
import { SessionManager } from '../src/host/session-manager.js';
import * as db from '../src/db/index.js';

// Mock DB
vi.mock('../src/db/index.js', () => ({
    initDatabase: vi.fn(),
    getTopic: vi.fn(),
    createTopic: vi.fn(),
    getProject: vi.fn(),
    createProject: vi.fn(),
    updateTopic: vi.fn(),
    updateProject: vi.fn(),
    getAllProjects: vi.fn(),
    getAllTopics: vi.fn(),
    getMessages: vi.fn(),
}));

// Mock AgentDriver things to avoid complex setup
vi.mock('@aotui/agent-driver', () => ({
    AgentDriver: class {
        setBridge() {}
        setMessagesBuilder() {}
        setLanguageModel() {}
        start() {}
        onStateChange = () => {}
        onThought = () => {}
        onReasoning = () => {}
        onError = () => {}
    },
    AgentSession: class {
        public desktopId: string | undefined;
        public driver = {};
        public events = { on: vi.fn(), off: vi.fn() };
        constructor(private config: any) {
            this.desktopId = config.desktopId;
        }
        async start() {
            await this.config.runtime.createDesktop(this.desktopId, this.config.context);
        }
        async chat() {
            return new Response();
        }
    },
    createMessagesBuilder: () => ({
        setSystemPrompt: () => {},
        setTuiInstruction: () => {}
    })
}));

// Mock Runtime Bridge
vi.mock('@aotui/runtime', () => ({
    Bridge: class {},
    createDesktopId: (id: string) => `dt_${id}`,
}));

describe('Project Injection', () => {
    it('should inject project path into desktop config', async () => {
        // 1. Setup Data Mocks
        const project = { id: 'p1', path: '/tmp/test', name: 'Test', createdAt: 0 };
        const topic = { id: 't1', title: 'Topic', projectId: 'p1', createdAt: 0, updatedAt: 0, status: 'hot' };

        (db.getTopic as any).mockReturnValue(topic);
        (db.getProject as any).mockReturnValue(project);

        // 2. Mock DesktopManager
        const runtime = {
            createDesktop: vi.fn().mockResolvedValue('dt_t1'),
            installDynamicWorkerApp: vi.fn(),
            getDesktop: vi.fn().mockReturnValue({ id: 'dt_t1' })
        };
        const mockDesktopManager = {
            getDesktop: vi.fn().mockReturnValue({ id: 'dt_t1' }),
            getKernel: vi.fn().mockReturnValue(runtime),
            deleteDesktop: vi.fn().mockResolvedValue(true),
            getThirdPartyAppsConfig: vi.fn().mockReturnValue([])
        } as any;

        // 3. Create SessionManager
        const sessionManager = new SessionManager(mockDesktopManager);

        // 4. Act
        await sessionManager.createSession('t1');

        // 5. Assert
        expect(runtime.createDesktop).toHaveBeenCalledWith(
            expect.stringContaining('t1'),
            { env: { projectPath: '/tmp/test' } }
        );
    });

    it('should not inject config if no project', async () => {
        // 1. Setup Data Mocks
        const topic = { id: 't2', title: 'Topic 2', projectId: undefined, createdAt: 0, updatedAt: 0, status: 'hot' };

        (db.getTopic as any).mockReturnValue(topic);
        
        // 2. Mock DesktopManager
        const runtime = {
            createDesktop: vi.fn().mockResolvedValue('dt_t2'),
            installDynamicWorkerApp: vi.fn(),
            getDesktop: vi.fn().mockReturnValue({ id: 'dt_t2' })
        };
        const mockDesktopManager = {
            getDesktop: vi.fn().mockReturnValue({ id: 'dt_t2' }),
            getKernel: vi.fn().mockReturnValue(runtime),
            getThirdPartyAppsConfig: vi.fn().mockReturnValue([])
        } as any;

        // 3. Create SessionManager
        const sessionManager = new SessionManager(mockDesktopManager);

        // 4. Act
        await sessionManager.createSession('t2');

        // 5. Assert
        expect(runtime.createDesktop).toHaveBeenCalledWith(
            expect.stringContaining('t2'),
            { env: {} }
        );
    });
});
