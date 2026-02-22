/**
 * McpVisualEditor - MCP Server 管理界面（完全重写）
 *
 * 实现 Gemini 风格的 MCP Server 管理页面：
 * - 左侧：已配置的 Server 列表（状态点 + 工具计数）
 * - 右侧：选中 Server 的详情（连接状态 + Tools 列表 + Enable/Disable 控制）
 *
 * 架构说明：
 * - mcpConfig (Record<string,any>)：来自父组件，是持久化的配置数据
 * - runtime (Record<string, RuntimeEntry>)：从 mcp.getRuntime 获取的运行时状态
 * - 依赖注入： runtimeApi prop 传入 tRPC 接口，方便单元测试
 * - Server Enable/Disable → setServerEnabled mutation（写 config + 更新运行时连接）
 * - Tool Enable/Disable → setToolEnabled mutation（写 config 中 disabledTools）
 */
import React, { useState, useEffect, useCallback } from 'react';
import { IconDelete, IconNewChat, IconPlug } from '../../Icons.js';

// ── 类型定义 ──────────────────────────────────────────────────────────────────

interface ToolInfo {
    name: string;
    description: string;
    enabled: boolean;
}

interface RuntimeEntry {
    status: string; // 'connected' | 'disabled' | 'failed' | 'needs_auth' | 'needs_client_registration'
    error?: string;
    tools: ToolInfo[];
}

/**
 * MCP 运行时 API 接口（依赖注入，方便测试）
 */
export interface McpRuntimeApi {
    getRuntime: () => Promise<Record<string, RuntimeEntry>>;
    setServerEnabled: (args: { name: string; enabled: boolean }) => Promise<{ success: boolean }>;
    setToolEnabled: (args: { serverName: string; toolName: string; enabled: boolean }) => Promise<{ success: boolean }>;
}

interface McpVisualEditorProps {
    config: Record<string, any>;
    onChange: (config: Record<string, any>) => void;
    onSave: (config: Record<string, any>) => Promise<void> | void;
    isSaving?: boolean;
    /** 必须传入：从父组件注入（方便测试时传入 mock 对象）*/
    runtimeApi: McpRuntimeApi;
}

function toObject(value: unknown): Record<string, any> {
    return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function normalizeImportedServerEntry(entry: Record<string, any>): Record<string, any> {
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

function extractServersFromImportJson(input: string): Record<string, any> {
    const parsed = JSON.parse(input);
    const obj = toObject(parsed);
    const container = toObject(obj.mcpServers ?? obj.mcp ?? obj);

    const entries = Object.entries(container)
        .filter(([, value]) => value && typeof value === 'object')
        .map(([name, value]) => [name, normalizeImportedServerEntry(value as Record<string, any>)]);

    return Object.fromEntries(entries);
}

// ── 子组件：状态徽章 ──────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string; error?: string }> = ({ status, error }) => {
    const map: Record<string, { label: string; cls: string; dot: string }> = {
        connected: { label: 'Connected', cls: 'text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/20', dot: 'bg-[var(--color-success)]' },
        disabled: { label: 'Disabled', cls: 'text-[var(--color-text-tertiary)]    bg-[var(--mat-content-card-bg)]    border-[var(--mat-border)]', dot: 'bg-[var(--color-text-tertiary)]' },
        failed: { label: 'Failed', cls: 'text-[var(--color-danger)]     bg-[var(--color-danger)]/10      border-[var(--color-danger)]/20', dot: 'bg-[var(--color-danger)]' },
        needs_auth: { label: 'Auth Required', cls: 'text-[var(--color-warning)]  bg-[var(--color-warning)]/10   border-[var(--color-warning)]/20', dot: 'bg-[var(--color-warning)]' },
        needs_client_registration: { label: 'Config Error', cls: 'text-[var(--color-warning)]  bg-[var(--color-warning)]/10  border-[var(--color-warning)]/20', dot: 'bg-[var(--color-warning)]' },
    };
    const m = map[status] ?? { label: status, cls: 'text-[var(--color-text-tertiary)] bg-[var(--mat-content-card-bg)] border-[var(--mat-border)]', dot: 'bg-[var(--color-text-tertiary)]' };

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-medium ${m.cls}`}
            title={status === 'failed' ? error : undefined}
        >
            <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
            {m.label}
        </span>
    );
};

// ── 子组件：Toggle 开关 ───────────────────────────────────────────────────────

interface ToggleProps {
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
    size?: 'sm' | 'md';
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange, disabled = false, size = 'md' }) => {
    const w = size === 'sm' ? 'w-7 h-4' : 'w-9 h-5';
    const thumb = size === 'sm' ? 'w-3 h-3 translate-x-0.5' : 'w-4 h-4 translate-x-0.5';
    const on = size === 'sm' ? 'translate-x-3' : 'translate-x-4';
    return (
        <button
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`
                relative inline-flex items-center shrink-0 rounded-full border border-transparent
                transition-colors duration-200 focus:outline-none
                ${w}
                ${checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--mat-border)]'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            `}
        >
            <span
                className={`
                    inline-block rounded-full bg-white shadow transition-transform duration-200
                    ${thumb}
                    ${checked ? on : ''}
                `}
            />
        </button>
    );
};

// ── 主组件 ────────────────────────────────────────────────────────────────────

export const McpVisualEditor: React.FC<McpVisualEditorProps> = ({
    config,
    onChange,
    onSave,
    isSaving = false,
    runtimeApi: api,
}) => {
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [runtime, setRuntime] = useState<Record<string, RuntimeEntry>>({});
    const [runtimeLoading, setRuntimeLoading] = useState(true);
    const [runtimeError, setRuntimeError] = useState<string | null>(null);
    const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [importText, setImportText] = useState('');
    const [importError, setImportError] = useState<string | null>(null);
    const [isImporting, setIsImporting] = useState(false);

    const statusLabelMap: Record<string, string> = {
        connected: 'Connected',
        disabled: 'Disabled',
        failed: 'Failed',
        needs_auth: 'Auth Required',
        needs_client_registration: 'Config Error',
    };

    // ── 运行时数据加载 ──────────────────────────────────────────────────────────

    const fetchRuntime = useCallback(async () => {
        setRuntimeLoading(true);
        setRuntimeError(null);
        try {
            const data = await api.getRuntime();
            setRuntime(data as Record<string, RuntimeEntry>);
        } catch (err) {
            console.error('[McpVisualEditor] Failed to fetch runtime:', err);
            setRuntimeError('Failed to load runtime status');
        } finally {
            setRuntimeLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        fetchRuntime();
    }, [fetchRuntime]);

    // 自动选中第一个 server
    useEffect(() => {
        const keys = Object.keys(config || {});
        if (!selectedKey && keys.length > 0) {
            setSelectedKey(keys[0]);
        } else if (selectedKey && !config[selectedKey]) {
            setSelectedKey(keys[0] || null);
        }
    }, [config, selectedKey]);

    // ── Config mutations（保留原有能力：增/删/改 server 配置） ────────────────────

    const commitChange = (newConfig: Record<string, any>) => onChange(newConfig);

    const handleAddServer = () => {
        setImportError(null);
        setImportText(`{
  "mcpServers": {
    "exa": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.exa.ai/mcp"]
    }
  }
}`);
        setShowImportDialog(true);
    };

    const handleImportServers = async () => {
        setImportError(null);
        setIsImporting(true);
        try {
            const imported = extractServersFromImportJson(importText);
            const importedNames = Object.keys(imported);
            if (importedNames.length === 0) {
                setImportError('No valid MCP servers found. Expecting { "mcpServers": { "name": { ... } } }.');
                return;
            }

            const nextConfig = {
                ...config,
                ...imported,
            };

            commitChange(nextConfig);
            setSelectedKey(importedNames[0]);
            await onSave(nextConfig);
            setShowImportDialog(false);
            await fetchRuntime();
        } catch (err) {
            setImportError((err as Error).message || 'Failed to parse JSON');
        } finally {
            setIsImporting(false);
        }
    };

    const handleDeleteServer = (e: React.MouseEvent, key: string) => {
        e.stopPropagation();
        const updated = { ...config };
        delete updated[key];
        commitChange(updated);
        if (selectedKey === key) setSelectedKey(Object.keys(updated)[0] || null);
    };

    // ── 运行时控制 ──────────────────────────────────────────────────────────────

    const handleServerToggle = async (serverName: string, enabled: boolean) => {
        const pendingKey = `server:${serverName}`;
        if (pendingToggles.has(pendingKey)) return;

        setPendingToggles(prev => new Set(prev).add(pendingKey));
        try {
            await api.setServerEnabled({ name: serverName, enabled });
            const nextConfig = {
                ...config,
                [serverName]: {
                    ...(config[serverName] || {}),
                    enabled,
                },
            };
            commitChange(nextConfig);
            // 乐观更新 runtime
            setRuntime(prev => ({
                ...prev,
                [serverName]: {
                    ...(prev[serverName] || { tools: [] }),
                    status: enabled ? 'connected' : 'disabled',
                },
            }));
            // 同步刷新（有延迟，连接需要时间）
            setTimeout(() => fetchRuntime(), 1500);
        } catch (err) {
            console.error(`[McpVisualEditor] Failed to toggle server ${serverName}:`, err);
        } finally {
            setPendingToggles(prev => {
                const next = new Set(prev);
                next.delete(pendingKey);
                return next;
            });
        }
    };

    const handleToolToggle = async (serverName: string, toolName: string, enabled: boolean) => {
        const pendingKey = `tool:${serverName}:${toolName}`;
        if (pendingToggles.has(pendingKey)) return;

        setPendingToggles(prev => new Set(prev).add(pendingKey));
        try {
            await api.setToolEnabled({ serverName, toolName, enabled });
            const currentServer = (config[serverName] || {}) as Record<string, any>;
            const disabledTools = new Set<string>(
                Array.isArray(currentServer.disabledTools)
                    ? currentServer.disabledTools.filter((name: unknown): name is string => typeof name === 'string')
                    : []
            );
            if (enabled) {
                disabledTools.delete(toolName);
            } else {
                disabledTools.add(toolName);
            }
            const nextConfig = {
                ...config,
                [serverName]: {
                    ...currentServer,
                    disabledTools: Array.from(disabledTools),
                },
            };
            commitChange(nextConfig);
            // 乐观更新 runtime
            setRuntime(prev => {
                const entry = prev[serverName];
                if (!entry) return prev;
                return {
                    ...prev,
                    [serverName]: {
                        ...entry,
                        tools: entry.tools.map(t =>
                            t.name === toolName ? { ...t, enabled } : t
                        ),
                    },
                };
            });
        } catch (err) {
            console.error(`[McpVisualEditor] Failed to toggle tool ${toolName}:`, err);
        } finally {
            setPendingToggles(prev => {
                const next = new Set(prev);
                next.delete(pendingKey);
                return next;
            });
        }
    };

    // ── 计算数据 ───────────────────────────────────────────────────────────────

    const keys = Object.keys(config || {});
    const selectedServer = selectedKey ? config[selectedKey] : null;
    const selectedRuntime = selectedKey ? runtime[selectedKey] : undefined;

    const totalEnabledTools = Object.values(runtime).reduce(
        (sum, r) => sum + (r.tools?.filter(t => t.enabled).length ?? 0), 0
    );
    const totalTools = Object.values(runtime).reduce(
        (sum, r) => sum + (r.tools?.length ?? 0), 0
    );

    const selectedStatus = selectedRuntime?.status ?? (selectedServer?.enabled === false ? 'disabled' : 'unknown');
    const connectionStatusLabel = statusLabelMap[selectedStatus] ?? 'Unknown';
    const runtimeStatusLabel = selectedStatus === 'connected' ? 'Running' : 'Stopped';

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div
            className="flex flex-col h-full min-h-[400px] rounded-[inherit] overflow-hidden"
            style={{
                isolation: 'isolate',
                WebkitMaskImage: '-webkit-radial-gradient(white, black)',
            }}
        >
            {/* 顶部工具栏 */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--mat-border)] mat-lg-clear shrink-0">
                <span className="text-[11px] text-[var(--color-text-tertiary)] font-mono">
                    {runtimeLoading ? 'Loading...' : `${totalEnabledTools} / ${totalTools} tools active`}
                </span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchRuntime}
                        disabled={runtimeLoading}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-full border border-[var(--mat-border)] text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-hover-bg)] transition-colors disabled:opacity-40"
                        title="Refresh runtime status"
                    >
                        <svg className={`w-3.5 h-3.5 ${runtimeLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                    </button>
                    <button
                        onClick={() => onSave(config)}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-full bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-95"
                    >
                        {isSaving ? 'Saving...' : 'Save Config'}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 min-h-0">
                {/* ── 左侧 Server 列表 ─────────────────────────────────────────────── */}
                <div className="w-[200px] shrink-0 border-r border-[var(--mat-border)] mat-lg-clear flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--mat-border)]">
                        <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] tracking-[0.05em]">Servers</span>
                        <button
                            onClick={handleAddServer}
                            className="p-1 hover:bg-[var(--mat-content-card-hover-bg)] rounded-full text-[var(--color-accent)] transition-colors"
                            title="Import MCP JSON"
                        >
                            <IconNewChat className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5">
                        {keys.length === 0 ? (
                            <div className="px-3 py-6 text-center text-[11px] text-[var(--color-text-tertiary)] italic">
                                No servers configured.<br />Click + to import JSON.
                            </div>
                        ) : (
                            keys.map(key => {
                                const rt = runtime[key];
                                const status = rt?.status ?? (runtimeLoading ? 'loading' : 'disabled');
                                const dots: Record<string, string> = {
                                    connected: 'bg-emerald-400',
                                    failed: 'bg-red-500',
                                    needs_auth: 'bg-amber-400',
                                    needs_client_registration: 'bg-orange-400',
                                    disabled: 'bg-[var(--mat-border)]',
                                    loading: 'bg-[var(--mat-border)] animate-pulse',
                                };
                                const dotCls = dots[status] ?? 'bg-[var(--mat-border)]';
                                const enabledCount = rt?.tools.filter(t => t.enabled).length ?? 0;
                                const totalCount = rt?.tools.length ?? 0;
                                const statusText = statusLabelMap[status] ?? (status === 'loading' ? 'Loading' : 'Unknown');

                                return (
                                    <div
                                        key={key}
                                        onClick={() => setSelectedKey(key)}
                                        className={`
                                            group flex items-center gap-2 px-2.5 py-2 rounded-[8px] cursor-pointer
                                            transition-colors text-[13px]
                                            ${selectedKey === key
                                                ? 'bg-[var(--color-accent)/15] text-[var(--color-accent)]'
                                                : 'hover:bg-[var(--mat-content-card-hover-bg)] text-[var(--color-text-primary)]'}
                                        `}
                                    >
                                        {/* 状态点 */}
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} title={status} />

                                        {/* Server 名 + 状态 */}
                                        <div className="flex-1 min-w-0">
                                            <p className="truncate text-[11px] font-medium leading-tight">{key}</p>
                                            <p className={`truncate text-[10px] mt-0.5 ${selectedKey === key ? 'text-[var(--color-accent)]/70' : 'text-[var(--color-text-tertiary)]'}`}>
                                                {statusText}
                                            </p>
                                        </div>

                                        {/* 工具计数 + 删除按钮 */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            {totalCount > 0 && (
                                                <span className={`text-[10px] font-mono tabular-nums ${selectedKey === key ? 'text-[var(--color-accent)]/70' : 'text-[var(--color-text-tertiary)]'}`}>
                                                    {enabledCount}/{totalCount}
                                                </span>
                                            )}
                                            <button
                                                onClick={(e) => handleDeleteServer(e, key)}
                                                className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 transition-opacity"
                                                title="Remove server"
                                            >
                                                <IconDelete className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* ── 右侧详情面板 ─────────────────────────────────────────────────── */}
                <div className="flex-1 flex flex-col overflow-hidden mat-content">
                    {selectedServer && selectedKey ? (
                        <>
                            {/* 详情头部 */}
                            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[var(--mat-border)] shrink-0">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">{selectedKey}</h3>
                                    <div className="flex items-center gap-3 mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                                        <span>Connection: {connectionStatusLabel}</span>
                                        <span>Runtime: {runtimeStatusLabel}</span>
                                    </div>
                                </div>
                                {selectedRuntime && <StatusBadge status={selectedRuntime.status} error={selectedRuntime.error} />}
                                {/* Server Enable/Disable 推钮 */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] text-[var(--color-text-tertiary)]">
                                        {pendingToggles.has(`server:${selectedKey}`)
                                            ? 'Updating...'
                                            : (selectedRuntime?.status === 'disabled' || selectedServer.enabled === false)
                                                ? 'Disabled'
                                                : 'Enabled'}
                                    </span>
                                    <Toggle
                                        checked={
                                            selectedRuntime
                                                ? selectedRuntime.status !== 'disabled'
                                                : selectedServer.enabled !== false
                                        }
                                        onChange={(v) => handleServerToggle(selectedKey, v)}
                                        disabled={pendingToggles.has(`server:${selectedKey}`)}
                                    />
                                </div>
                            </div>

                            {/* Tools 列表 */}
                            <div className="flex-1 overflow-y-auto">
                                {runtimeLoading ? (
                                    <div className="flex items-center justify-center py-12 text-[11px] text-[var(--color-text-tertiary)]">
                                        <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Loading tools...
                                    </div>
                                ) : runtimeError ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-[11px] text-red-400 gap-2">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                                        </svg>
                                        {runtimeError}
                                    </div>
                                ) : !selectedRuntime || selectedRuntime.status !== 'connected' ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-tertiary)] gap-3">
                                        <IconPlug className="w-10 h-10 opacity-20" />
                                        <div className="text-center">
                                            <p className="text-[13px] font-medium mb-1">
                                                {!selectedRuntime || selectedRuntime.status === 'disabled'
                                                    ? 'Server is disabled'
                                                    : selectedRuntime.status === 'failed'
                                                        ? 'Connection failed'
                                                        : selectedRuntime.status === 'needs_auth'
                                                            ? 'Authentication required'
                                                            : 'Not connected'}
                                            </p>
                                            <p className="text-[11px] text-[var(--color-text-tertiary)] max-w-[280px]">
                                                {selectedRuntime?.status === 'failed'
                                                    ? (selectedRuntime.error || 'Unknown error')
                                                    : selectedRuntime?.status === 'disabled'
                                                        ? 'Enable the server to see available tools.'
                                                        : 'Tools will appear here once connected.'}
                                            </p>
                                        </div>
                                    </div>
                                ) : selectedRuntime.tools.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-tertiary)] gap-2">
                                        <p className="text-[13px]">No tools available</p>
                                        <p className="text-[11px]">This server has no tools listed.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-[var(--mat-border)]/50">
                                        {selectedRuntime.tools.map((tool, idx) => {
                                            const pendingKey = `tool:${selectedKey}:${tool.name}`;
                                            const isPending = pendingToggles.has(pendingKey);
                                            return (
                                                <div
                                                    key={tool.name}
                                                    className={`flex items-start gap-4 px-5 py-3.5 transition-colors ${tool.enabled ? '' : 'opacity-50'
                                                        }`}
                                                >
                                                    {/* 序号 */}
                                                    <span className="text-[11px] text-[var(--color-text-tertiary)] font-mono w-5 shrink-0 pt-0.5 tabular-nums">
                                                        {idx + 1}.
                                                    </span>

                                                    {/* 工具信息 */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[13px] font-semibold text-[var(--color-text-primary)] font-mono">
                                                            {tool.name}
                                                        </p>
                                                        {tool.description && (
                                                            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 leading-relaxed">
                                                                {tool.description}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* Tool Enable 开关 */}
                                                    <Toggle
                                                        size="sm"
                                                        checked={tool.enabled}
                                                        onChange={(v) => handleToolToggle(selectedKey, tool.name, v)}
                                                        disabled={isPending || selectedRuntime.status !== 'connected'}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-text-tertiary)] p-8 text-center">
                            <IconPlug className="w-12 h-12 mb-4 opacity-20" />
                            <h4 className="text-[13px] font-medium mb-1">No MCP Server Selected</h4>
                            <p className="text-[11px]">Select a server from the left sidebar or click + to add a new one.</p>
                        </div>
                    )}
                </div>
            </div>

            {showImportDialog && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 p-4">
                    <div className="w-full max-w-2xl mat-content rounded-[16px] border border-[var(--mat-border)] shadow-2xl flex flex-col max-h-[80vh]">
                        <div className="px-4 py-3 border-b border-[var(--mat-border)] flex items-center justify-between">
                            <h4 className="text-[13px] font-semibold text-[var(--color-text-primary)]">Import MCP JSON</h4>
                            <button
                                onClick={() => setShowImportDialog(false)}
                                className="text-[11px] px-2 py-1 rounded-full hover:bg-[var(--mat-content-card-hover-bg)] text-[var(--color-text-tertiary)]"
                            >
                                Cancel
                            </button>
                        </div>

                        <div className="p-4 flex-1 min-h-0 flex flex-col gap-3">
                            <p className="text-[11px] text-[var(--color-text-tertiary)]">
                                Paste JSON like {'{ "mcpServers": { "exa": { ... } } }'}. Imported servers are saved immediately.
                            </p>
                            <textarea
                                value={importText}
                                onChange={(e) => setImportText(e.target.value)}
                                spellCheck={false}
                                className="flex-1 min-h-[240px] w-full font-mono text-[12px] p-3 rounded-xl resize-none outline-none mat-content border border-[var(--mat-border)] focus:border-[var(--color-accent)]"
                            />
                            {importError && (
                                <div className="text-[11px] px-3 py-2 rounded-lg bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/20 text-[var(--color-danger)] break-words">
                                    {importError}
                                </div>
                            )}
                        </div>

                        <div className="px-4 py-3 border-t border-[var(--mat-border)] flex items-center justify-end gap-2">
                            <button
                                onClick={() => setShowImportDialog(false)}
                                className="px-3 py-1.5 text-[12px] rounded-full border border-[var(--mat-border)] text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-hover-bg)]"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleImportServers}
                                disabled={isImporting || !importText.trim()}
                                className="px-3 py-1.5 text-[12px] rounded-full bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {isImporting ? 'Importing...' : 'Import & Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
