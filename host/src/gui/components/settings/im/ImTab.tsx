/**
 * ImTab - IM Channel Configuration
 *
 * Supports channel-level defaults plus multiple concrete bot accounts.
 * Channel defaults still matter because account configs inherit from them,
 * but each account can now carry its own app credentials and agent binding.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useChatBridge } from '../../../ChatBridge.js';
import { LoadingState } from '../LoadingState.js';

interface AgentInfo {
    id: string;
    name: string;
}

type ChannelKey = 'feishu' | 'lark';
type ConnectionMode = 'websocket' | 'webhook';
type DmPolicy = 'open' | 'allowlist' | 'pairing';
type GroupPolicy = 'open' | 'allowlist' | 'disabled';
type SessionScope = 'peer' | 'peer_sender' | 'peer_thread' | 'peer_thread_sender';

interface FeishuAccountConfig {
    enabled?: boolean;
    appId?: string;
    appSecret?: string;
    verificationToken?: string;
    botToken?: string;
    botAgentId?: string;
    domain?: string;
    connectionMode?: ConnectionMode;
    sessionScope?: SessionScope;
    dmPolicy?: DmPolicy;
    groupPolicy?: GroupPolicy;
    requireMention?: boolean;
    apiBaseUrl?: string;
}

interface FeishuChannelConfig extends FeishuAccountConfig {
    accounts?: Record<string, FeishuAccountConfig>;
}

interface ImConfig {
    enabled?: boolean;
    channels?: {
        feishu?: FeishuChannelConfig;
        lark?: FeishuChannelConfig;
    };
}

interface ImRuntimeAccountState {
    accountId: string;
    active: boolean;
    appId?: string;
    connectionMode?: ConnectionMode;
    sessionScope?: SessionScope | string;
}

interface ImRuntimeChannelState {
    id: string;
    active?: boolean;
    runtime?: {
        started?: boolean;
        accountIds?: string[];
        sessionScopes?: string[];
        accounts?: ImRuntimeAccountState[];
    };
}

interface ImRuntimeResponse {
    started?: boolean;
    channels?: ImRuntimeChannelState[];
}

const CHANNEL_OPTIONS: { key: ChannelKey; label: string; description: string }[] = [
    { key: 'feishu', label: '飞书 (Feishu)', description: '飞书国内版' },
    { key: 'lark', label: 'Lark', description: 'Lark international' },
];

const SESSION_SCOPE_OPTIONS: Array<{ value: SessionScope; label: string; description: string }> = [
    { value: 'peer', label: '群/私聊会话', description: '同一个群或私聊共享上下文' },
    { value: 'peer_sender', label: '按发送者隔离', description: '群里不同发送者拆成独立上下文' },
    { value: 'peer_thread', label: '按线程隔离', description: '群里不同 thread 拆成独立上下文' },
    { value: 'peer_thread_sender', label: '线程 + 发送者', description: 'thread 内不同发送者继续拆分' },
];

const EMPTY_ACCOUNT_CONFIG: FeishuAccountConfig = {
    enabled: true,
    appId: '',
    appSecret: '',
    verificationToken: '',
    botToken: '',
    botAgentId: '',
    connectionMode: 'websocket',
    sessionScope: 'peer',
    dmPolicy: 'open',
    groupPolicy: 'open',
    requireMention: true,
    apiBaseUrl: '',
};

const EMPTY_CHANNEL_CONFIG: FeishuChannelConfig = {
    enabled: false,
    appId: '',
    appSecret: '',
    verificationToken: '',
    botToken: '',
    botAgentId: '',
    domain: 'feishu',
    connectionMode: 'websocket',
    sessionScope: 'peer',
    dmPolicy: 'open',
    groupPolicy: 'open',
    requireMention: true,
    apiBaseUrl: '',
    accounts: {},
};

const labelClass = 'block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5';
const inputClass = `
    w-full px-3 py-2 rounded-lg text-[13px]
    bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)]
    text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
    focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30
    transition-colors duration-200
`;
const selectClass = `
    w-full px-3 py-2 rounded-lg text-[13px] cursor-pointer appearance-none
    bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)]
    text-[var(--color-text-primary)]
    focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30
    transition-colors duration-200
`;

function buildDefaultAccountId(existingIds: string[]): string {
    let index = existingIds.length + 1;
    let next = `bot${index}`;
    const existing = new Set(existingIds);
    while (existing.has(next)) {
        index += 1;
        next = `bot${index}`;
    }
    return next;
}

function sanitizeAccountId(value: string): string {
    return value.trim().replace(/\s+/g, '-');
}

function describeEffectiveAgent(
    botAgentId: string | undefined,
    channelAgentId: string | undefined,
    activeAgentId: string | null,
    agents: AgentInfo[],
): string {
    const effectiveId = botAgentId || channelAgentId || activeAgentId || '';
    if (!effectiveId) {
        return '未绑定，保存后将使用当前运行中的活跃 Agent'
    }

    const matched = agents.find((agent) => agent.id === effectiveId);
    return matched ? matched.name : effectiveId;
}

function buildWebhookUrl(accountId?: string): string {
    if (typeof window === 'undefined') {
        return accountId ? `/api/im/feishu/webhook/${accountId}` : '/api/im/feishu/webhook';
    }

    return accountId
        ? `${window.location.origin}/api/im/feishu/webhook/${encodeURIComponent(accountId)}`
        : `${window.location.origin}/api/im/feishu/webhook`;
}

function AccountEditor(props: {
    accountId: string;
    config: FeishuAccountConfig;
    selectedChannel: ChannelKey;
    channelConnectionMode?: ConnectionMode;
    agents: AgentInfo[];
    activeAgentId: string | null;
    channelAgentId?: string;
    runtime?: ImRuntimeAccountState;
    onRename: (nextId: string) => void;
    onUpdate: <K extends keyof FeishuAccountConfig>(field: K, value: FeishuAccountConfig[K]) => void;
    onRemove: () => void;
}) {
    const {
        accountId,
        config,
        selectedChannel,
        channelConnectionMode,
        agents,
        activeAgentId,
        channelAgentId,
        runtime,
        onRename,
        onUpdate,
        onRemove,
    } = props;

    const [draftAccountId, setDraftAccountId] = useState(accountId);
    const boundAgent = describeEffectiveAgent(config.botAgentId, channelAgentId, activeAgentId, agents);

    useEffect(() => {
        setDraftAccountId(accountId);
    }, [accountId]);

    return (
        <div className="rounded-2xl border border-[var(--mat-border)] bg-[var(--mat-content-card-bg)] p-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1 flex-1">
                    <label className={labelClass}>账号 ID</label>
                    <input
                        type="text"
                        value={draftAccountId}
                        onChange={(e) => setDraftAccountId(e.target.value)}
                        onBlur={() => onRename(draftAccountId)}
                        placeholder="corpA"
                        className={inputClass}
                    />
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                        这是本地配置 key，用于区分不同 Bot 账号。
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        runtime?.active
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-[var(--mat-border)] text-[var(--color-text-muted)]'
                    }`}>
                        {runtime ? (runtime.active ? '运行中' : '未连接') : '未观测'}
                    </span>
                    <button
                        onClick={onRemove}
                        className="px-3 py-2 rounded-lg text-[12px] font-medium border border-red-500/30 text-red-500 hover:bg-red-500/8 transition-colors"
                    >
                        删除账号
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-[13px] font-semibold text-[var(--color-text-primary)]">启用该 Bot</h4>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        关闭后该账号不会建连，也不会消费属于自己的事件。
                    </p>
                </div>
                <button
                    onClick={() => onUpdate('enabled', !(config.enabled ?? true))}
                    className={`
                        relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer
                        ${(config.enabled ?? true) ? 'bg-[var(--color-accent)]' : 'bg-[var(--mat-border)]'}
                    `}
                    role="switch"
                    aria-checked={config.enabled ?? true}
                >
                    <span
                        className={`
                            absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200
                            ${(config.enabled ?? true) ? 'translate-x-5' : 'translate-x-0'}
                        `}
                    />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={labelClass}>App ID</label>
                    <input
                        type="text"
                        value={config.appId || ''}
                        onChange={(e) => onUpdate('appId', e.target.value)}
                        placeholder="cli_xxxxxxxxxx"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label className={labelClass}>App Secret</label>
                    <input
                        type="password"
                        value={config.appSecret || ''}
                        onChange={(e) => onUpdate('appSecret', e.target.value)}
                        placeholder="输入该 Bot 的 App Secret"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label className={labelClass}>Bot Token</label>
                    <input
                        type="password"
                        value={config.botToken || ''}
                        onChange={(e) => onUpdate('botToken', e.target.value)}
                        placeholder="可选，留空则运行时动态获取"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label className={labelClass}>Verification Token</label>
                    <input
                        type="password"
                        value={config.verificationToken || ''}
                        onChange={(e) => onUpdate('verificationToken', e.target.value)}
                        placeholder="Webhook 模式校验 token"
                        className={inputClass}
                    />
                </div>
                <div>
                    <label className={labelClass}>账号专属 Agent</label>
                    <select
                        value={config.botAgentId || ''}
                        onChange={(e) => onUpdate('botAgentId', e.target.value || undefined)}
                        className={selectClass}
                    >
                        <option value="">继承渠道默认 / 当前活跃 Agent</option>
                        {agents.map((agent) => (
                            <option key={agent.id} value={agent.id}>
                                {agent.name}
                            </option>
                        ))}
                    </select>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
                        当前生效 Agent: {boundAgent}
                    </p>
                </div>
                <div>
                    <label className={labelClass}>连接模式</label>
                    <select
                        value={config.connectionMode || 'websocket'}
                        onChange={(e) => onUpdate('connectionMode', e.target.value as ConnectionMode)}
                        className={selectClass}
                    >
                        <option value="websocket">WebSocket</option>
                        <option value="webhook">Webhook</option>
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Session Scope</label>
                    <select
                        value={config.sessionScope || 'peer'}
                        onChange={(e) => onUpdate('sessionScope', e.target.value as SessionScope)}
                        className={selectClass}
                    >
                        {SESSION_SCOPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
                        {SESSION_SCOPE_OPTIONS.find((option) => option.value === (config.sessionScope || 'peer'))?.description}
                    </p>
                </div>
                <div>
                    <label className={labelClass}>私聊策略</label>
                    <select
                        value={config.dmPolicy || 'open'}
                        onChange={(e) => onUpdate('dmPolicy', e.target.value as DmPolicy)}
                        className={selectClass}
                    >
                        <option value="open">开放</option>
                        <option value="allowlist">白名单</option>
                        <option value="pairing">配对审批</option>
                    </select>
                </div>
                <div>
                    <label className={labelClass}>群聊策略</label>
                    <select
                        value={config.groupPolicy || 'open'}
                        onChange={(e) => onUpdate('groupPolicy', e.target.value as GroupPolicy)}
                        className={selectClass}
                    >
                        <option value="open">开放</option>
                        <option value="allowlist">白名单</option>
                        <option value="disabled">禁用群聊</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onUpdate('requireMention', !(config.requireMention ?? true))}
                        className={`
                            relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0
                            ${(config.requireMention ?? true) ? 'bg-[var(--color-accent)]' : 'bg-[var(--mat-border)]'}
                        `}
                        role="switch"
                        aria-checked={config.requireMention ?? true}
                    >
                        <span
                            className={`
                                absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200
                                ${(config.requireMention ?? true) ? 'translate-x-4' : 'translate-x-0'}
                            `}
                        />
                    </button>
                    <div>
                        <span className="text-[13px] text-[var(--color-text-primary)]">群聊仅在 @ 时触发回复</span>
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                            未 @ 时只写入该 Bot 的上下文，不触发 Agent run。
                        </p>
                    </div>
                </div>

                <div>
                    <label className={labelClass}>自定义 API Base URL</label>
                    <input
                        type="text"
                        value={config.apiBaseUrl || ''}
                        onChange={(e) => onUpdate('apiBaseUrl', e.target.value || undefined)}
                        placeholder={`留空使用 ${selectedChannel} 默认地址`}
                        className={inputClass}
                    />
                </div>
            </div>

            {(config.connectionMode || channelConnectionMode || 'websocket') === 'webhook' && (
                <div className="rounded-xl border border-[var(--mat-border)] bg-[var(--mat-background)] px-3 py-2.5 text-[11px] text-[var(--color-text-muted)]">
                    <div>
                        <span className="text-[var(--color-text-secondary)] font-medium">Webhook URL:</span>
                        {' '}
                        <code className="text-[var(--color-text-primary)]">{buildWebhookUrl(accountId)}</code>
                    </div>
                    <div className="mt-1">
                        该地址会把事件路由到账号 <code className="text-[var(--color-text-primary)]">{accountId}</code> 对应的 Bot 身份。
                    </div>
                </div>
            )}

            {runtime && (
                <div className="rounded-xl border border-[var(--mat-border)] bg-[var(--mat-background)] px-3 py-2.5 text-[11px] text-[var(--color-text-muted)]">
                    <span className="text-[var(--color-text-secondary)] font-medium">Runtime:</span>
                    {' '}
                    appId={runtime.appId || '未暴露'}
                    {' · '}
                    mode={runtime.connectionMode || 'unknown'}
                    {' · '}
                    scope={runtime.sessionScope || config.sessionScope || 'peer'}
                </div>
            )}
        </div>
    );
}

export const ImTab: React.FC = () => {
    const bridge = useChatBridge();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const [imConfig, setImConfig] = useState<ImConfig>({});
    const [imRuntime, setImRuntime] = useState<ImRuntimeResponse | null>(null);
    const [agents, setAgents] = useState<AgentInfo[]>([]);
    const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
    const [selectedChannel, setSelectedChannel] = useState<ChannelKey>('feishu');

    useEffect(() => {
        const load = async () => {
            try {
                const [config, agentData, runtime] = await Promise.all([
                    bridge.getImConfig(),
                    bridge.getImAgents(),
                    bridge.getImRuntime(),
                ]);

                setImConfig(config ?? {});
                setAgents(agentData.list ?? []);
                setActiveAgentId(agentData.activeAgentId ?? null);
                setImRuntime(runtime ?? null);

                if (config?.channels?.lark && !config?.channels?.feishu) {
                    setSelectedChannel('lark');
                }
            } catch (error) {
                console.error('[ImTab] Failed to load IM config:', error);
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const channelConfig: FeishuChannelConfig = useMemo(() => {
        const current = imConfig.channels?.[selectedChannel] ?? {};
        return {
            ...EMPTY_CHANNEL_CONFIG,
            domain: selectedChannel === 'lark' ? 'lark' : 'feishu',
            ...current,
            accounts: current.accounts ?? {},
        };
    }, [imConfig.channels, selectedChannel]);

    const runtimeChannel = useMemo(() => {
        return imRuntime?.channels?.find((channel) => channel.id === selectedChannel) ?? null;
    }, [imRuntime, selectedChannel]);

    const runtimeAccounts = useMemo(() => {
        return new Map((runtimeChannel?.runtime?.accounts ?? []).map((account) => [account.accountId, account]));
    }, [runtimeChannel]);

    const updateCurrentChannel = useCallback((updater: (prev: FeishuChannelConfig) => FeishuChannelConfig) => {
        setImConfig((prev) => {
            const previousChannel = {
                ...EMPTY_CHANNEL_CONFIG,
                ...(prev.channels?.[selectedChannel] ?? {}),
                accounts: prev.channels?.[selectedChannel]?.accounts ?? {},
            };

            return {
                ...prev,
                channels: {
                    ...prev.channels,
                    [selectedChannel]: updater(previousChannel),
                },
            };
        });
    }, [selectedChannel]);

    const updateChannelField = useCallback(<K extends keyof FeishuChannelConfig>(
        field: K,
        value: FeishuChannelConfig[K],
    ) => {
        updateCurrentChannel((prev) => ({
            ...prev,
            [field]: value,
        }));
    }, [updateCurrentChannel]);

    const updateAccountField = useCallback(<K extends keyof FeishuAccountConfig>(
        accountId: string,
        field: K,
        value: FeishuAccountConfig[K],
    ) => {
        updateCurrentChannel((prev) => ({
            ...prev,
            accounts: {
                ...(prev.accounts ?? {}),
                [accountId]: {
                    ...(prev.accounts?.[accountId] ?? EMPTY_ACCOUNT_CONFIG),
                    [field]: value,
                },
            },
        }));
    }, [updateCurrentChannel]);

    const addAccount = useCallback(() => {
        const accountId = buildDefaultAccountId(Object.keys(channelConfig.accounts ?? {}));
        updateCurrentChannel((prev) => ({
            ...prev,
            accounts: {
                ...(prev.accounts ?? {}),
                [accountId]: {
                    ...EMPTY_ACCOUNT_CONFIG,
                    enabled: true,
                    connectionMode: prev.connectionMode || 'websocket',
                    sessionScope: prev.sessionScope || 'peer',
                    dmPolicy: prev.dmPolicy || 'open',
                    groupPolicy: prev.groupPolicy || 'open',
                    requireMention: prev.requireMention ?? true,
                },
            },
        }));
    }, [channelConfig.accounts, updateCurrentChannel]);

    const removeAccount = useCallback((accountId: string) => {
        updateCurrentChannel((prev) => {
            const nextAccounts = { ...(prev.accounts ?? {}) };
            delete nextAccounts[accountId];
            return {
                ...prev,
                accounts: nextAccounts,
            };
        });
    }, [updateCurrentChannel]);

    const renameAccount = useCallback((accountId: string, nextValue: string) => {
        const nextId = sanitizeAccountId(nextValue);
        if (!nextId || nextId === accountId) {
            return;
        }

        if ((channelConfig.accounts ?? {})[nextId]) {
            setSaveMessage({ type: 'error', text: `账号 ID "${nextId}" 已存在` });
            return;
        }

        updateCurrentChannel((prev) => {
            const nextAccounts = { ...(prev.accounts ?? {}) };
            const current = nextAccounts[accountId];
            if (!current) {
                return prev;
            }

            delete nextAccounts[accountId];
            nextAccounts[nextId] = current;
            return {
                ...prev,
                accounts: nextAccounts,
            };
        });
    }, [channelConfig.accounts, updateCurrentChannel]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        setSaveMessage(null);

        try {
            await bridge.saveImConfig(imConfig);
            const runtime = await bridge.getImRuntime();
            setImRuntime(runtime ?? null);
            setSaveMessage({ type: 'success', text: '已保存，新的多 Bot 配置会在 Host 重载后生效' });
            window.setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            console.error('[ImTab] Save failed:', error);
            setSaveMessage({ type: 'error', text: '保存失败，请检查账号配置是否完整' });
        } finally {
            setSaving(false);
        }
    }, [bridge, imConfig]);

    if (loading) {
        return <LoadingState message="Loading IM configuration..." />;
    }

    const boundDefaultAgent = describeEffectiveAgent(channelConfig.botAgentId, undefined, activeAgentId, agents);
    const accountEntries = Object.entries(channelConfig.accounts ?? {});

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    IM Channels
                </h2>
                <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
                    现在可以在同一个渠道下配置多个真实 Bot 身份。每个 Bot 有自己的 appId / appSecret / botToken，
                    自己维护 session 和上下文；群聊里只有被 @ 的 Bot 会真正触发 Agent 回复。
                </p>
            </div>

            <div className="flex gap-2">
                {CHANNEL_OPTIONS.map(({ key, label, description }) => (
                    <button
                        key={key}
                        onClick={() => setSelectedChannel(key)}
                        className={`
                            px-4 py-2 rounded-xl text-[13px] font-medium border transition-all duration-200 cursor-pointer
                            ${selectedChannel === key
                                ? 'bg-[var(--mat-content-card-hover-bg)] border-[var(--mat-border-highlight)] text-[var(--color-text-primary)] shadow-[inset_0_1px_0_var(--mat-inset-highlight)]'
                                : 'bg-transparent border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-hover-bg)] hover:text-[var(--color-text-primary)]'
                            }
                        `}
                        title={description}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="mat-md-regular rounded-2xl p-5 space-y-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                            启用 {selectedChannel === 'feishu' ? '飞书' : 'Lark'} 通道
                        </h3>
                        <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
                            渠道开启后，下面的默认配置和 Bot 账号会一起参与启动。
                        </p>
                    </div>
                    <button
                        onClick={() => updateChannelField('enabled', !channelConfig.enabled)}
                        className={`
                            relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer
                            ${channelConfig.enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--mat-border)]'}
                        `}
                        role="switch"
                        aria-checked={channelConfig.enabled}
                    >
                        <span
                            className={`
                                absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200
                                ${channelConfig.enabled ? 'translate-x-5' : 'translate-x-0'}
                            `}
                        />
                    </button>
                </div>

                <div className="rounded-2xl border border-[var(--mat-border)] bg-[var(--mat-content-card-bg)] p-4 space-y-4">
                    <div>
                        <h4 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                            渠道默认配置
                        </h4>
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                            这里的配置会作为所有账号的默认值。默认 Bot 身份是可选的，不再强制要求存在。
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>默认 Agent</label>
                            <select
                                value={channelConfig.botAgentId || ''}
                                onChange={(e) => updateChannelField('botAgentId', e.target.value || undefined)}
                                className={selectClass}
                            >
                                <option value="">
                                    {activeAgentId
                                        ? `使用当前活跃 Agent (${agents.find((a) => a.id === activeAgentId)?.name ?? activeAgentId})`
                                        : '使用当前活跃 Agent'
                                    }
                                </option>
                                {agents.map((agent) => (
                                    <option key={agent.id} value={agent.id}>
                                        {agent.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
                                当前默认 Agent: {boundDefaultAgent}
                            </p>
                        </div>
                        <div>
                            <label className={labelClass}>Session Scope</label>
                            <select
                                value={channelConfig.sessionScope || 'peer'}
                                onChange={(e) => updateChannelField('sessionScope', e.target.value as SessionScope)}
                                className={selectClass}
                            >
                                {SESSION_SCOPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
                                {SESSION_SCOPE_OPTIONS.find((option) => option.value === (channelConfig.sessionScope || 'peer'))?.description}
                            </p>
                        </div>
                        <div>
                            <label className={labelClass}>连接模式</label>
                            <select
                                value={channelConfig.connectionMode || 'websocket'}
                                onChange={(e) => updateChannelField('connectionMode', e.target.value as ConnectionMode)}
                                className={selectClass}
                            >
                                <option value="websocket">WebSocket (推荐)</option>
                                <option value="webhook">Webhook</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>域名</label>
                            <select
                                value={channelConfig.domain || selectedChannel}
                                onChange={(e) => updateChannelField('domain', e.target.value)}
                                className={selectClass}
                            >
                                <option value="feishu">feishu.cn (国内)</option>
                                <option value="lark">larksuite.com (海外)</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>私聊策略</label>
                            <select
                                value={channelConfig.dmPolicy || 'open'}
                                onChange={(e) => updateChannelField('dmPolicy', e.target.value as DmPolicy)}
                                className={selectClass}
                            >
                                <option value="open">开放</option>
                                <option value="allowlist">白名单</option>
                                <option value="pairing">配对审批</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>群聊策略</label>
                            <select
                                value={channelConfig.groupPolicy || 'open'}
                                onChange={(e) => updateChannelField('groupPolicy', e.target.value as GroupPolicy)}
                                className={selectClass}
                            >
                                <option value="open">开放</option>
                                <option value="allowlist">白名单</option>
                                <option value="disabled">禁用群聊</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>默认 App ID</label>
                            <input
                                type="text"
                                value={channelConfig.appId || ''}
                                onChange={(e) => updateChannelField('appId', e.target.value)}
                                placeholder="可选，作为默认/root Bot"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>默认 App Secret</label>
                            <input
                                type="password"
                                value={channelConfig.appSecret || ''}
                                onChange={(e) => updateChannelField('appSecret', e.target.value)}
                                placeholder="可选，仅默认 Bot 使用"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>默认 Bot Token</label>
                            <input
                                type="password"
                                value={channelConfig.botToken || ''}
                                onChange={(e) => updateChannelField('botToken', e.target.value)}
                                placeholder="可选，留空则运行时动态获取"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>默认 Verification Token</label>
                            <input
                                type="password"
                                value={channelConfig.verificationToken || ''}
                                onChange={(e) => updateChannelField('verificationToken', e.target.value)}
                                placeholder="Webhook 模式 challenge / callback 校验"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className={labelClass}>自定义 API Base URL</label>
                            <input
                                type="text"
                                value={channelConfig.apiBaseUrl || ''}
                                onChange={(e) => updateChannelField('apiBaseUrl', e.target.value || undefined)}
                                placeholder="留空使用默认地址"
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => updateChannelField('requireMention', !channelConfig.requireMention)}
                            className={`
                                relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0
                                ${(channelConfig.requireMention ?? true) ? 'bg-[var(--color-accent)]' : 'bg-[var(--mat-border)]'}
                            `}
                            role="switch"
                            aria-checked={channelConfig.requireMention ?? true}
                        >
                            <span
                                className={`
                                    absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200
                                    ${(channelConfig.requireMention ?? true) ? 'translate-x-4' : 'translate-x-0'}
                                `}
                            />
                        </button>
                        <div>
                            <span className="text-[13px] text-[var(--color-text-primary)]">默认群聊仅在 @ 时触发回复</span>
                            <span className="text-[11px] text-[var(--color-text-muted)] ml-2">
                                子账号不覆盖时会继承这里的规则。
                            </span>
                        </div>
                    </div>

                    {channelConfig.connectionMode === 'webhook' && (
                        <div className="rounded-xl border border-[var(--mat-border)] bg-[var(--mat-background)] px-3 py-2.5 text-[11px] text-[var(--color-text-muted)]">
                            <div>
                                <span className="text-[var(--color-text-secondary)] font-medium">默认/root Bot Webhook URL:</span>
                                {' '}
                                <code className="text-[var(--color-text-primary)]">{buildWebhookUrl()}</code>
                            </div>
                            <div className="mt-1">
                                如果你不使用默认 root Bot，可以只配置下面各个子账号自己的 webhook 地址。
                            </div>
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-[var(--mat-border)] bg-[var(--mat-content-card-bg)] p-4 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h4 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                                Bot 账号列表
                            </h4>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                                每个账号代表一个真实的飞书 / Lark 应用身份。它们可以共享同一个 Agent，也可以各自绑定不同 Agent。
                            </p>
                        </div>
                        <button
                            onClick={addAccount}
                            className="px-3.5 py-2 rounded-xl text-[12px] font-semibold bg-[var(--color-accent)] text-white hover:brightness-110 transition-all"
                        >
                            新增 Bot 账号
                        </button>
                    </div>

                    {accountEntries.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[var(--mat-border)] px-4 py-5 text-[12px] text-[var(--color-text-muted)]">
                            还没有配置子账号。你可以只配置默认 Bot，也可以在这里新增多个独立 Bot 身份。
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {accountEntries.map(([accountId, accountConfig]) => (
                                <AccountEditor
                                    key={accountId}
                                    accountId={accountId}
                                    config={{ ...EMPTY_ACCOUNT_CONFIG, ...accountConfig }}
                                    selectedChannel={selectedChannel}
                                    channelConnectionMode={channelConfig.connectionMode}
                                    agents={agents}
                                    activeAgentId={activeAgentId}
                                    channelAgentId={channelConfig.botAgentId}
                                    runtime={runtimeAccounts.get(accountId)}
                                    onRename={(nextId) => renameAccount(accountId, nextId)}
                                    onUpdate={(field, value) => updateAccountField(accountId, field, value)}
                                    onRemove={() => removeAccount(accountId)}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {runtimeChannel && (
                    <div className="rounded-2xl border border-[var(--mat-border)] bg-[var(--mat-background)] p-4 space-y-2">
                        <h4 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                            Runtime 观测
                        </h4>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                            渠道 active={String(runtimeChannel.active)} · started={String(runtimeChannel.runtime?.started)}
                            {' · '}
                            已观测账号 {runtimeChannel.runtime?.accounts?.length ?? 0} 个
                        </p>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`
                        px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 cursor-pointer
                        bg-[var(--color-accent)] text-white
                        hover:brightness-110 active:scale-[0.97]
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                >
                    {saving ? '保存中...' : '保存配置'}
                </button>
                {saveMessage && (
                    <span className={`text-[12px] ${saveMessage.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                        {saveMessage.text}
                    </span>
                )}
            </div>
        </div>
    );
};
