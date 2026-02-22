/**
 * 前端测试：McpVisualEditor 组件
 * 
 * 使用依赖注入的 runtimeApi prop，完全解耦 ChatBridge/electronTRPC。
 * 覆盖：左侧列表渲染、Server 选择和工具显示、Enable/Disable 操作、错误处理
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── mock Icons ───────────────────────────────────────────────────────────────

vi.mock('../../Icons.js', () => ({
    IconDelete: ({ className }: any) => <span data-testid="icon-delete" className={className} />,
    IconNewChat: ({ className }: any) => <span data-testid="icon-new-chat" className={className} />,
    IconPlug: ({ className }: any) => <span data-testid="icon-plug" className={className} />,
}));

// ── mock useChatBridge（防止真实代码在模块收集时触发 electronTRPC）────────────

vi.mock('../../../ChatBridge.js', () => ({
    useChatBridge: () => ({
        getTrpcClient: () => ({ mcp: {} }),
    }),
}));

// ── 在所有 mock 之后导入被测组件 ─────────────────────────────────────────────

import { McpVisualEditor, type McpRuntimeApi } from '../McpVisualEditor.js';

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockConfig: Record<string, any> = {
    context7: { type: 'local', command: ['npx'], enabled: true },
    Git: { type: 'local', command: ['uvx'], enabled: false },
};

const mockRuntimeData = {
    context7: {
        status: 'connected',
        tools: [
            { name: 'search', description: 'Search documentation', enabled: true },
            { name: 'resolve', description: 'Resolve library IDs', enabled: true },
        ],
    },
    Git: {
        status: 'disabled',
        tools: [],
    },
};

// 工厂函数：创建 mock runtimeApi
function makeRuntimeApi(overrides?: Partial<McpRuntimeApi>): McpRuntimeApi {
    return {
        getRuntime: vi.fn().mockResolvedValue(mockRuntimeData),
        setServerEnabled: vi.fn().mockResolvedValue({ success: true }),
        setToolEnabled: vi.fn().mockResolvedValue({ success: true }),
        ...overrides,
    };
}

// 默认 props（使用依赖注入 runtimeApi）
function makeProps(runtimeApi: McpRuntimeApi, extra?: Partial<React.ComponentProps<typeof McpVisualEditor>>) {
    return {
        config: mockConfig,
        onChange: vi.fn(),
        onSave: vi.fn(),
        isSaving: false,
        runtimeApi,
        ...extra,
    };
}

// ── 测试套件 ─────────────────────────────────────────────────────────────────

describe('McpVisualEditor 组件', () => {
    // ─── 基础渲染 ────────────────────────────────────────────────────────────

    describe('基础渲染', () => {
        it('应渲染左侧 Server 列表', async () => {
            const api = makeRuntimeApi();
            render(<McpVisualEditor {...makeProps(api)} />);

            await waitFor(() => {
                expect(screen.getAllByText('context7')[0]).toBeInTheDocument();
                expect(screen.getAllByText('Git')[0]).toBeInTheDocument();
            });
        });

        it('应在顶部显示工具统计', async () => {
            const api = makeRuntimeApi();
            render(<McpVisualEditor {...makeProps(api)} />);

            await waitFor(() => {
                expect(screen.getByText('2 / 2 tools active')).toBeInTheDocument();
            });
        });

        it('空配置时应显示占位提示', async () => {
            const api = makeRuntimeApi({ getRuntime: vi.fn().mockResolvedValue({}) });
            render(<McpVisualEditor {...makeProps(api, { config: {} })} />);

            await waitFor(() => {
                expect(screen.getByText(/No servers configured/i)).toBeInTheDocument();
            });
        });
    });

    // ─── Server 选择和工具显示 ───────────────────────────────────────────────

    describe('Server 选择', () => {
        it('默认自动选中第一个 server，右侧应显示工具列表', async () => {
            const api = makeRuntimeApi();
            render(<McpVisualEditor {...makeProps(api)} />);

            // context7 是第一个，应自动选中并在右侧显示工具列表
            await waitFor(() => {
                expect(screen.getByText('search')).toBeInTheDocument();
                expect(screen.getByText('Search documentation')).toBeInTheDocument();
                expect(screen.getByText('resolve')).toBeInTheDocument();
            });
        });

        it('点击 disabled server 应显示 disabled 提示', async () => {
            const api = makeRuntimeApi();
            render(<McpVisualEditor {...makeProps(api)} />);

            await waitFor(() => {
                expect(screen.getByText('Git')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Git'));

            await waitFor(() => {
                expect(screen.getByText('Server is disabled')).toBeInTheDocument();
                expect(screen.getByText('Connection: Disabled')).toBeInTheDocument();
                expect(screen.getByText('Runtime: Stopped')).toBeInTheDocument();
            });
        });

        it('选中 connected server 时应显示连接与运行状态', async () => {
            const api = makeRuntimeApi();
            render(<McpVisualEditor {...makeProps(api)} />);

            await waitFor(() => {
                expect(screen.getByText('Connection: Connected')).toBeInTheDocument();
                expect(screen.getByText('Runtime: Running')).toBeInTheDocument();
            });
        });

        it('点击 failed server 应显示错误信息', async () => {
            const api = makeRuntimeApi({
                getRuntime: vi.fn().mockResolvedValue({
                    context7: { status: 'failed', error: 'Connection timeout', tools: [] },
                }),
            });
            render(<McpVisualEditor {...makeProps(api, { config: { context7: { type: 'local', command: ['npx'] } } })} />);

            await waitFor(() => {
                expect(screen.getByText('Connection failed')).toBeInTheDocument();
                expect(screen.getByText('Connection timeout')).toBeInTheDocument();
            });
        });
    });

    // ─── Tool Enable/Disable ─────────────────────────────────────────────────

    describe('Tool Enable/Disable', () => {
        it('点击工具 Toggle 应调用 setToolEnabled', async () => {
            const api = makeRuntimeApi();
            render(<McpVisualEditor {...makeProps(api)} />);

            // 等待工具列表加载
            await waitFor(() => {
                expect(screen.getByText('search')).toBeInTheDocument();
            });

            // allToggles[0]=ServerToggle, [1]=search, [2]=resolve
            const allToggles = screen.getAllByRole('switch');
            expect(allToggles.length).toBeGreaterThanOrEqual(2);

            await act(async () => {
                fireEvent.click(allToggles[1]); // 点击 'search' 的 toggle（当前 enabled=true）
            });

            await waitFor(() => {
                expect(api.setToolEnabled).toHaveBeenCalledWith({
                    serverName: 'context7',
                    toolName: 'search',
                    enabled: false,
                });
            });
        });

        it('禁用后乐观更新 - setToolEnabled 应被调用', async () => {
            const api = makeRuntimeApi();
            render(<McpVisualEditor {...makeProps(api)} />);

            await waitFor(() => {
                expect(screen.getByText('search')).toBeInTheDocument();
            });

            const allToggles = screen.getAllByRole('switch');
            await act(async () => {
                fireEvent.click(allToggles[1]);
            });

            expect(api.setToolEnabled).toHaveBeenCalled();
        });
    });

    // ─── Server Enable/Disable ───────────────────────────────────────────────

    describe('Server Enable/Disable', () => {
        it('点击 Server Toggle 应调用 setServerEnabled', async () => {
            const api = makeRuntimeApi();
            render(<McpVisualEditor {...makeProps(api)} />);

            await waitFor(() => {
                expect(screen.getByText('Enabled')).toBeInTheDocument();
            });

            const toggles = screen.getAllByRole('switch');
            await act(async () => {
                fireEvent.click(toggles[0]); // Server 级别的开关（context7 已自动选中）
            });

            await waitFor(() => {
                expect(api.setServerEnabled).toHaveBeenCalledWith({
                    name: 'context7',
                    enabled: false, // 从 enabled 切换到 disabled
                });
            });
        });
    });

    // ─── 操作按钮 ────────────────────────────────────────────────────────────

    describe('操作按钮', () => {
        it('点击 Refresh 应重新获取 runtime 数据', async () => {
            const api = makeRuntimeApi();
            render(<McpVisualEditor {...makeProps(api)} />);

            await waitFor(() => {
                expect(api.getRuntime).toHaveBeenCalledTimes(1);
            });

            const refreshBtn = screen.getByText('Refresh');
            await act(async () => {
                fireEvent.click(refreshBtn);
            });

            await waitFor(() => {
                expect(api.getRuntime).toHaveBeenCalledTimes(2);
            });
        });

        it('点击 Save Config 应调用 onSave', async () => {
            const onSave = vi.fn();
            const api = makeRuntimeApi();
            render(<McpVisualEditor {...makeProps(api, { onSave })} />);

            await waitFor(() => {
                expect(screen.getByText('Save Config')).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText('Save Config'));
            expect(onSave).toHaveBeenCalledWith(mockConfig);
        });

        it('isSaving=true 时按钮应禁用且显示 Saving...', async () => {
            const api = makeRuntimeApi();
            render(<McpVisualEditor {...makeProps(api, { isSaving: true })} />);

            const btn = await screen.findByText('Saving...');
            expect(btn).toBeDisabled();
        });
    });

    // ─── 错误处理 ────────────────────────────────────────────────────────────

    describe('错误处理', () => {
        it('runtime 加载失败时应显示错误状态', async () => {
            const api = makeRuntimeApi({
                getRuntime: vi.fn().mockRejectedValue(new Error('Network error')),
            });
            render(<McpVisualEditor {...makeProps(api)} />);

            await waitFor(() => {
                expect(screen.getByText('Failed to load runtime status')).toBeInTheDocument();
            });
        });

        it('runtime 加载失败时仍应正常显示 server 列表', async () => {
            const api = makeRuntimeApi({
                getRuntime: vi.fn().mockRejectedValue(new Error('Network error')),
            });
            render(<McpVisualEditor {...makeProps(api)} />);

            await waitFor(() => {
                expect(screen.getAllByText('context7')[0]).toBeInTheDocument();
                expect(screen.getAllByText('Git')[0]).toBeInTheDocument();
            });
        });
    });

    // ─── Server 管理 ─────────────────────────────────────────────────────────

    describe('Server 管理', () => {
        it('点击 + 按钮应调用 onChange 添加新 server', async () => {
            const onChange = vi.fn();
            const api = makeRuntimeApi();
            render(<McpVisualEditor {...makeProps(api, { onChange })} />);

            await waitFor(() => {
                expect(screen.getByTitle('Add Server')).toBeInTheDocument();
            });

            const addBtn = screen.getByTitle('Add Server');
            expect(addBtn).not.toBeNull();

            fireEvent.click(addBtn);

            expect(onChange).toHaveBeenCalledWith(
                expect.objectContaining({
                    'new-server': expect.objectContaining({ type: 'remote' }),
                })
            );
        });
    });
});
