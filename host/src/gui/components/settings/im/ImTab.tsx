/**
 * ImTab - IM Channel Configuration
 *
 * Settings tab for configuring IM channel integrations (Feishu/Lark).
 * Users can:
 *   1. Select a channel type (feishu / lark)
 *   2. Enable/disable the channel
 *   3. Bind a bot to a specific agent (1:1 relationship)
 *   4. Fill in API credentials (appId, appSecret, botToken)
 *   5. Configure connection and policy options
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useChatBridge } from '../../../ChatBridge.js';
import { LoadingState } from '../LoadingState.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentInfo {
    id: string;
    name: string;
}

interface FeishuChannelConfig {
    enabled?: boolean;
    appId?: string;
    appSecret?: string;
    botToken?: string;
    botAgentId?: string;
    domain?: string;
    connectionMode?: 'websocket' | 'webhook';
    dmPolicy?: 'open' | 'allowlist' | 'pairing';
    groupPolicy?: 'open' | 'allowlist' | 'disabled';
    requireMention?: boolean;
    apiBaseUrl?: string;
}

interface ImConfig {
    channels?: {
        feishu?: FeishuChannelConfig;
        lark?: FeishuChannelConfig;
    };
}

type ChannelKey = 'feishu' | 'lark';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHANNEL_OPTIONS: { key: ChannelKey; label: string; description: string }[] = [
    { key: 'feishu', label: '飞书 (Feishu)', description: '飞书国内版' },
    { key: 'lark', label: 'Lark', description: 'Lark international' },
];

const EMPTY_CHANNEL_CONFIG: FeishuChannelConfig = {
    enabled: false,
    appId: '',
    appSecret: '',
    botToken: '',
    botAgentId: '',
    domain: 'feishu',
    connectionMode: 'websocket',
    dmPolicy: 'open',
    groupPolicy: 'open',
    requireMention: true,
};

// ─── Shared Styles ────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export const ImTab: React.FC = () => {
    const bridge = useChatBridge();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Data
    const [imConfig, setImConfig] = useState<ImConfig>({});
    const [agents, setAgents] = useState<AgentInfo[]>([]);
    const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

    // UI state
    const [selectedChannel, setSelectedChannel] = useState<ChannelKey>('feishu');
    const [showSecret, setShowSecret] = useState(false);

    // ─── Load ─────────────────────────────────────────────────────────────────

    useEffect(() => {
        const load = async () => {
            try {
                const [config, agentData] = await Promise.all([
                    bridge.getImConfig(),
                    bridge.getImAgents(),
                ]);
                setImConfig(config ?? {});
                setAgents(agentData.list ?? []);
                setActiveAgentId(agentData.activeAgentId ?? null);

                // Auto-select the first channel that has config
                if (config?.channels?.lark && !config?.channels?.feishu) {
                    setSelectedChannel('lark');
                }
            } catch (error) {
                console.error('[ImTab] Failed to load IM config:', error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Current channel config ───────────────────────────────────────────────

    const channelConfig: FeishuChannelConfig = {
        ...EMPTY_CHANNEL_CONFIG,
        domain: selectedChannel === 'lark' ? 'lark' : 'feishu',
        ...(imConfig.channels?.[selectedChannel] ?? {}),
    };

    const updateChannelField = useCallback(<K extends keyof FeishuChannelConfig>(
        field: K,
        value: FeishuChannelConfig[K],
    ) => {
        setImConfig((prev) => ({
            ...prev,
            channels: {
                ...prev.channels,
                [selectedChannel]: {
                    ...(prev.channels?.[selectedChannel] ?? {}),
                    [field]: value,
                },
            },
        }));
    }, [selectedChannel]);

    // ─── Save ─────────────────────────────────────────────────────────────────

    const handleSave = useCallback(async () => {
        setSaving(true);
        setSaveMessage(null);
        try {
            await bridge.saveImConfig(imConfig);
            setSaveMessage({ type: 'success', text: '已保存，重启后生效' });
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            console.error('[ImTab] Save failed:', error);
            setSaveMessage({ type: 'error', text: '保存失败' });
        } finally {
            setSaving(false);
        }
    }, [bridge, imConfig]);

    // ─── Render ───────────────────────────────────────────────────────────────

    if (loading) {
        return <LoadingState message="Loading IM configuration..." />;
    }

    const boundAgent = agents.find((a) => a.id === channelConfig.botAgentId);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
                    IM Channels
                </h2>
                <p className="text-[13px] text-[var(--color-text-secondary)] mt-1">
                    配置外部 IM 消息通道，将 Bot 绑定到指定 Agent。消息从 IM 发送到 Bot 后，
                    由绑定的 Agent 处理并回复。
                </p>
            </div>

            {/* Channel Selector */}
            <div className="flex gap-2">
                {CHANNEL_OPTIONS.map(({ key, label }) => (
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
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Channel Config Card */}
            <div className="mat-md-regular rounded-2xl p-5 space-y-5">
                {/* Enable Toggle */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
                            启用 {selectedChannel === 'feishu' ? '飞书' : 'Lark'} 通道
                        </h3>
                        <p className="text-[12px] text-[var(--color-text-muted)] mt-0.5">
                            开启后，Host 启动时会自动连接到 {selectedChannel === 'feishu' ? '飞书' : 'Lark'} 平台
                        </p>
                    </div>
                    <button
                        onClick={() => updateChannelField('enabled', !channelConfig.enabled)}
                        className={`
                            relative w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer
                            ${channelConfig.enabled
                                ? 'bg-[var(--color-accent)]'
                                : 'bg-[var(--mat-border)]'
                            }
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

                <hr className="border-[var(--mat-border)]" />

                {/* Agent Binding */}
                <div>
                    <label className={labelClass}>
                        绑定 Agent
                        <span className="text-[11px] text-[var(--color-text-muted)] ml-2">
                            Bot 收到的消息将由此 Agent 处理
                        </span>
                    </label>
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
                    {boundAgent && (
                        <p className="text-[11px] text-[var(--color-accent)] mt-1.5">
                            已绑定: {boundAgent.name}
                        </p>
                    )}
                </div>

                <hr className="border-[var(--mat-border)]" />

                {/* API Credentials */}
                <div className="space-y-4">
                    <h4 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                        应用凭证
                    </h4>

                    <div>
                        <label className={labelClass}>App ID</label>
                        <input
                            type="text"
                            value={channelConfig.appId || ''}
                            onChange={(e) => updateChannelField('appId', e.target.value)}
                            placeholder="cli_xxxxxxxxxx"
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label className={labelClass}>App Secret</label>
                        <div className="relative">
                            <input
                                type={showSecret ? 'text' : 'password'}
                                value={channelConfig.appSecret || ''}
                                onChange={(e) => updateChannelField('appSecret', e.target.value)}
                                placeholder="输入 App Secret"
                                className={inputClass}
                            />
                            <button
                                type="button"
                                onClick={() => setShowSecret(!showSecret)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] cursor-pointer px-1.5 py-0.5 rounded"
                            >
                                {showSecret ? '隐藏' : '显示'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>
                            Bot Token
                            <span className="text-[11px] text-[var(--color-text-muted)] ml-2">(可选，用于发送消息)</span>
                        </label>
                        <input
                            type="password"
                            value={channelConfig.botToken || ''}
                            onChange={(e) => updateChannelField('botToken', e.target.value)}
                            placeholder="t-xxxxxxxxxx"
                            className={inputClass}
                        />
                    </div>
                </div>

                <hr className="border-[var(--mat-border)]" />

                {/* Connection & Policy Settings */}
                <div className="space-y-4">
                    <h4 className="text-[13px] font-semibold text-[var(--color-text-primary)]">
                        连接与策略
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Connection Mode */}
                        <div>
                            <label className={labelClass}>连接模式</label>
                            <select
                                value={channelConfig.connectionMode || 'websocket'}
                                onChange={(e) => updateChannelField('connectionMode', e.target.value as 'websocket' | 'webhook')}
                                className={selectClass}
                            >
                                <option value="websocket">WebSocket (推荐)</option>
                                <option value="webhook">Webhook</option>
                            </select>
                        </div>

                        {/* Domain */}
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

                        {/* DM Policy */}
                        <div>
                            <label className={labelClass}>私聊策略</label>
                            <select
                                value={channelConfig.dmPolicy || 'open'}
                                onChange={(e) => updateChannelField('dmPolicy', e.target.value as 'open' | 'allowlist' | 'pairing')}
                                className={selectClass}
                            >
                                <option value="open">开放 (所有人可用)</option>
                                <option value="allowlist">白名单</option>
                                <option value="pairing">配对审批</option>
                            </select>
                        </div>

                        {/* Group Policy */}
                        <div>
                            <label className={labelClass}>群聊策略</label>
                            <select
                                value={channelConfig.groupPolicy || 'open'}
                                onChange={(e) => updateChannelField('groupPolicy', e.target.value as 'open' | 'allowlist' | 'disabled')}
                                className={selectClass}
                            >
                                <option value="open">开放</option>
                                <option value="allowlist">白名单</option>
                                <option value="disabled">禁用群聊</option>
                            </select>
                        </div>
                    </div>

                    {/* Require Mention */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => updateChannelField('requireMention', !channelConfig.requireMention)}
                            className={`
                                relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0
                                ${channelConfig.requireMention !== false
                                    ? 'bg-[var(--color-accent)]'
                                    : 'bg-[var(--mat-border)]'
                                }
                            `}
                            role="switch"
                            aria-checked={channelConfig.requireMention !== false}
                        >
                            <span
                                className={`
                                    absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200
                                    ${channelConfig.requireMention !== false ? 'translate-x-4' : 'translate-x-0'}
                                `}
                            />
                        </button>
                        <div>
                            <span className="text-[13px] text-[var(--color-text-primary)]">群聊需要 @Bot</span>
                            <span className="text-[11px] text-[var(--color-text-muted)] ml-2">
                                开启后，群聊中只有 @Bot 的消息才会被处理
                            </span>
                        </div>
                    </div>

                    {/* Custom API Base URL */}
                    <div>
                        <label className={labelClass}>
                            自定义 API Base URL
                            <span className="text-[11px] text-[var(--color-text-muted)] ml-2">(可选)</span>
                        </label>
                        <input
                            type="text"
                            value={channelConfig.apiBaseUrl || ''}
                            onChange={(e) => updateChannelField('apiBaseUrl', e.target.value || undefined)}
                            placeholder="留空使用默认地址"
                            className={inputClass}
                        />
                    </div>
                </div>
            </div>

            {/* Save Button */}
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
