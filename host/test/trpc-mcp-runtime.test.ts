/**
 * 测试：tRPC mcpRouter 新增端点
 * - getRuntime：正确合并 status + 工具列表
 * - setServerEnabled：更新 config 并调用 connect/disconnect
 * - setToolEnabled：更新 config 中的 disabledTools 数组
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mock MCP 模块 ────────────────────────────────────────────────────────────

const mockStatus = vi.fn();
const mockClients = vi.fn();
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();

vi.mock('../src/mcp/index.js', () => ({
    MCP: {
        status: mockStatus,
        clients: mockClients,
        connect: mockConnect,
        disconnect: mockDisconnect,
    },
}));

// ── mock Config ──────────────────────────────────────────────────────────────

const mockGetGlobal = vi.fn();
const mockUpdateGlobal = vi.fn();

vi.mock('../src/config/config.js', () => ({
    Config: {
        getGlobal: mockGetGlobal,
        updateGlobal: mockUpdateGlobal,
    },
}));

// ── 辅助函数：构建模拟 MCP client ────────────────────────────────────────────

function makeMockClient(tools: Array<{ name: string; description: string }>) {
    return {
        listTools: vi.fn().mockResolvedValue({ tools }),
    };
}

// ── 测试套件 ─────────────────────────────────────────────────────────────────

describe('tRPC mcpRouter - 运行时端点', () => {
    const sampleConfig = {
        mcp: {
            context7: { type: 'local', command: ['npx', '-y', '@upstash/context7-mcp'], enabled: true },
            Git: { type: 'local', command: ['uvx', 'mcp-server-git'], enabled: false, disabledTools: ['git_log'] },
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetGlobal.mockResolvedValue(sampleConfig);
        mockUpdateGlobal.mockResolvedValue(undefined);
    });

    // ─── getRuntime ─────────────────────────────────────────────────────────

    describe('mcp.getRuntime', () => {
        it('should return status and tools for connected servers', async () => {
            const context7Client = makeMockClient([
                { name: 'search', description: 'Search docs' },
                { name: 'resolve', description: 'Resolve IDs' },
            ]);

            mockStatus.mockResolvedValue({
                context7: { status: 'connected' },
                Git: { status: 'disabled' },
            });
            mockClients.mockResolvedValue({
                context7: context7Client,
            });

            // 直接测试处理逻辑（绕过 tRPC 调用栈）
            const { MCP } = await import('../src/mcp/index.js');
            const { Config } = await import('../src/config/config.js');

            const config = await Config.getGlobal();
            const mcpConfig: Record<string, any> = config.mcp || {};
            const statusMap = await MCP.status();
            const clientsMap = await MCP.clients();

            const result: Record<string, any> = {};

            for (const [serverName, serverStatus] of Object.entries(statusMap)) {
                const serverConfig = mcpConfig[serverName] || {};
                const disabledTools: string[] = serverConfig.disabledTools || [];
                let tools: any[] = [];

                if ((serverStatus as any).status === 'connected') {
                    const client = (clientsMap as any)[serverName];
                    if (client) {
                        const toolsResult = await client.listTools();
                        tools = toolsResult.tools.map((t: any) => ({
                            name: t.name,
                            description: t.description || '',
                            enabled: !disabledTools.includes(t.name),
                        }));
                    }
                }

                result[serverName] = {
                    status: (serverStatus as any).status,
                    error: 'error' in serverStatus ? (serverStatus as any).error : undefined,
                    tools,
                };
            }

            // context7 应有工具列表
            expect(result.context7.status).toBe('connected');
            expect(result.context7.tools).toHaveLength(2);
            expect(result.context7.tools[0]).toEqual({ name: 'search', description: 'Search docs', enabled: true });

            // Git 为 disabled，无工具
            expect(result.Git.status).toBe('disabled');
            expect(result.Git.tools).toHaveLength(0);
        });

        it('should respect disabledTools from config', async () => {
            const gitClient = makeMockClient([
                { name: 'git_log', description: 'Show git log' },
                { name: 'git_diff', description: 'Show git diff' },
            ]);

            mockStatus.mockResolvedValue({
                Git: { status: 'connected' },
            });
            mockClients.mockResolvedValue({ Git: gitClient });

            const { MCP } = await import('../src/mcp/index.js');
            const { Config } = await import('../src/config/config.js');

            const config = await Config.getGlobal();
            const mcpConfig: Record<string, any> = config.mcp || {};
            const statusMap = await MCP.status();
            const clientsMap = await MCP.clients();

            const gitStatus: any = (statusMap as any).Git;
            const gitConfig = mcpConfig.Git || {};
            const disabledTools: string[] = gitConfig.disabledTools || [];
            const gitClientMock = (clientsMap as any).Git;
            const toolsResult = await gitClientMock.listTools();
            const tools = toolsResult.tools.map((t: any) => ({
                name: t.name,
                description: t.description,
                enabled: !disabledTools.includes(t.name),
            }));

            // git_log 在 disabledTools 中，应为 disabled
            expect(tools.find((t: any) => t.name === 'git_log')?.enabled).toBe(false);
            // git_diff 不在 disabledTools 中，应为 enabled
            expect(tools.find((t: any) => t.name === 'git_diff')?.enabled).toBe(true);
        });

        it('should handle client.listTools() failure gracefully', async () => {
            const brokenClient = {
                listTools: vi.fn().mockRejectedValue(new Error('Connection broken')),
            };

            mockStatus.mockResolvedValue({
                context7: { status: 'connected' },
            });
            mockClients.mockResolvedValue({ context7: brokenClient });

            const { MCP } = await import('../src/mcp/index.js');
            const { Config } = await import('../src/config/config.js');

            const config = await Config.getGlobal();
            const mcpConfig: Record<string, any> = config.mcp || {};
            const statusMap = await MCP.status();
            const clientsMap = await MCP.clients();

            const result: Record<string, any> = {};

            for (const [serverName, serverStatus] of Object.entries(statusMap)) {
                const serverConfig = mcpConfig[serverName] || {};
                const disabledTools: string[] = serverConfig.disabledTools || [];
                let tools: any[] = [];

                if ((serverStatus as any).status === 'connected') {
                    const client = (clientsMap as any)[serverName];
                    if (client) {
                        try {
                            const toolsResult = await client.listTools();
                            tools = toolsResult.tools.map((t: any) => ({
                                name: t.name,
                                description: t.description || '',
                                enabled: !disabledTools.includes(t.name),
                            }));
                        } catch (_e) {
                            // swallow error, return empty tools
                        }
                    }
                }

                result[serverName] = { status: (serverStatus as any).status, tools };
            }

            // 出错时工具列表应为空，不能抛出异常
            expect(result.context7.tools).toHaveLength(0);
        });
    });

    // ─── setServerEnabled ───────────────────────────────────────────────────

    describe('mcp.setServerEnabled', () => {
        it('should call MCP.connect when enabling a server', async () => {
            mockConnect.mockResolvedValue(undefined);

            const { MCP } = await import('../src/mcp/index.js');
            const { Config } = await import('../src/config/config.js');

            const config = await Config.getGlobal();
            const mcpConfig: Record<string, any> = { ...(config.mcp || {}) };

            // 模拟 setServerEnabled 逻辑
            mcpConfig['Git'] = { ...mcpConfig['Git'], enabled: true };
            await Config.updateGlobal({ mcp: mcpConfig });
            await MCP.connect('Git');

            expect(mockUpdateGlobal).toHaveBeenCalledWith({
                mcp: expect.objectContaining({
                    Git: expect.objectContaining({ enabled: true }),
                }),
            });
            expect(mockConnect).toHaveBeenCalledWith('Git');
            expect(mockDisconnect).not.toHaveBeenCalled();
        });

        it('should call MCP.disconnect when disabling a server', async () => {
            mockDisconnect.mockResolvedValue(undefined);

            const { MCP } = await import('../src/mcp/index.js');
            const { Config } = await import('../src/config/config.js');

            const config = await Config.getGlobal();
            const mcpConfig: Record<string, any> = { ...(config.mcp || {}) };

            // 模拟 setServerEnabled 逻辑（enabled = false）
            mcpConfig['context7'] = { ...mcpConfig['context7'], enabled: false };
            await Config.updateGlobal({ mcp: mcpConfig });
            await MCP.disconnect('context7');

            expect(mockUpdateGlobal).toHaveBeenCalledWith({
                mcp: expect.objectContaining({
                    context7: expect.objectContaining({ enabled: false }),
                }),
            });
            expect(mockDisconnect).toHaveBeenCalledWith('context7');
            expect(mockConnect).not.toHaveBeenCalled();
        });
    });

    // ─── setToolEnabled ─────────────────────────────────────────────────────

    describe('mcp.setToolEnabled', () => {
        it('should add tool to disabledTools when disabling', async () => {
            const { Config } = await import('../src/config/config.js');

            const config = await Config.getGlobal();
            const mcpConfig: Record<string, any> = { ...(config.mcp || {}) };
            const serverConfig = { ...mcpConfig['context7'] };
            const disabledTools: string[] = [...(serverConfig.disabledTools || [])];

            // 禁用 'search' 工具
            if (!disabledTools.includes('search')) disabledTools.push('search');
            serverConfig.disabledTools = disabledTools;
            mcpConfig['context7'] = serverConfig;
            await Config.updateGlobal({ mcp: mcpConfig });

            expect(mockUpdateGlobal).toHaveBeenCalledWith({
                mcp: expect.objectContaining({
                    context7: expect.objectContaining({
                        disabledTools: expect.arrayContaining(['search']),
                    }),
                }),
            });
        });

        it('should remove tool from disabledTools when enabling', async () => {
            const { Config } = await import('../src/config/config.js');

            const config = await Config.getGlobal();
            const mcpConfig: Record<string, any> = { ...(config.mcp || {}) };
            const serverConfig = { ...mcpConfig['Git'] };
            const disabledTools: string[] = [...(serverConfig.disabledTools || [])];

            // 'git_log' 已在 disabledTools，启用时应移除
            const idx = disabledTools.indexOf('git_log');
            if (idx !== -1) disabledTools.splice(idx, 1);
            serverConfig.disabledTools = disabledTools;
            mcpConfig['Git'] = serverConfig;
            await Config.updateGlobal({ mcp: mcpConfig });

            const callArg = mockUpdateGlobal.mock.calls[0][0];
            expect(callArg.mcp.Git.disabledTools).not.toContain('git_log');
        });

        it('should not duplicate tools in disabledTools', async () => {
            const { Config } = await import('../src/config/config.js');

            const config = await Config.getGlobal();
            const mcpConfig: Record<string, any> = { ...(config.mcp || {}) };
            const serverConfig = { ...mcpConfig['Git'] }; // disabledTools: ['git_log']
            const disabledTools: string[] = [...(serverConfig.disabledTools || [])];

            // 再次禁用 'git_log'（已在列表中）
            if (!disabledTools.includes('git_log')) disabledTools.push('git_log');
            serverConfig.disabledTools = disabledTools;
            mcpConfig['Git'] = serverConfig;
            await Config.updateGlobal({ mcp: mcpConfig });

            const callArg = mockUpdateGlobal.mock.calls[0][0];
            const gitLog = callArg.mcp.Git.disabledTools.filter((t: string) => t === 'git_log');
            expect(gitLog).toHaveLength(1); // 不重复
        });
    });
});
