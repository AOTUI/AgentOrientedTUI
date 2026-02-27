/**
 * AgentCreateModal - Tabbed modal for creating/editing an Agent
 *
 * 6 tabs: Model (required) / Prompt / Apps / Skills / MCP / Skin
 * Model tab uses provider→model two-step selection.
 * "Add Model Provider →" link switches to Settings Model page.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { AgentEditorModal } from './AgentEditorModal.js';
import { useChatBridge } from '../../../ChatBridge.js';
import { IconBrain, IconPrompt, IconApps, IconSkills, IconPlug, IconAgentIdle, IconAgentWorking, IconAgentSleeping, IconAgentPaused } from '../../Icons.js';
import type { AgentConfig } from './AgentTab.js';
import { buildMcpToolItemKey } from '../../../../core/source-control-keys.js';

/* ── Tiny helper types ── */
interface ModelGroup {
    providerId: string;
    models: string[];
    displayName?: string;
}
interface PromptTemplate { id: string; name: string; content: string; }
interface AppEntry { name: string; source?: string; }
interface SkillEntry { name: string; description?: string; scope?: string; enabled?: boolean; }
interface McpServer { name: string; connected: boolean; status?: string; tools: Array<{ name: string; description: string; enabled: boolean }>; }

type TabKey = 'model' | 'prompt' | 'apps' | 'skills' | 'mcp' | 'skin';
const TABS: { key: TabKey; label: string; icon: React.ReactNode; required?: boolean }[] = [
    { key: 'model',  label: 'Model',  icon: <IconBrain className="w-3.5 h-3.5" />, required: true },
    { key: 'prompt', label: 'Prompt', icon: <IconPrompt className="w-3.5 h-3.5" /> },
    { key: 'apps',   label: 'Apps',   icon: <IconApps className="w-3.5 h-3.5" /> },
    { key: 'skills', label: 'Skills', icon: <IconSkills className="w-3.5 h-3.5" /> },
    { key: 'mcp',    label: 'MCP',    icon: <IconPlug className="w-3.5 h-3.5" /> },
    { key: 'skin',   label: 'Skin',   icon: <IconAgentIdle className="w-3.5 h-3.5" /> },
];

const SKIN_STATES: { key: keyof AgentConfig['skin']; label: string; Default: React.FC<{ className?: string }> }[] = [
    { key: 'idle',     label: 'Idle',     Default: IconAgentIdle },
    { key: 'working',  label: 'Working',  Default: IconAgentWorking },
    { key: 'sleeping', label: 'Sleeping', Default: IconAgentSleeping },
    { key: 'pause',    label: 'Pause',    Default: IconAgentPaused },
];

export interface AgentCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (agent: AgentConfig) => void;
    /** Pre-populated agent for editing; null = create new */
    initial: AgentConfig | null;
    projectPath?: string | null;
    /** Navigate to Settings Model tab */
    onSwitchToModelTab?: () => void;
    /** Navigate to Settings MCP tab */
    onOpenMcpSettings?: () => void;
}

export const AgentCreateModal: React.FC<AgentCreateModalProps> = ({
    isOpen, onClose, onSave, initial, projectPath, onSwitchToModelTab, onOpenMcpSettings,
}) => {
    const bridge = useChatBridge();
    const [activeTab, setActiveTab] = useState<TabKey>('model');

    // ── Draft agent state ──
    const [name, setName] = useState('');
    const [modelId, setModelId] = useState('');
    const [prompt, setPrompt] = useState('');
    const [enabledApps, setEnabledApps] = useState<string[]>([]);
    const [enabledSkills, setEnabledSkills] = useState<Record<string, string[]>>({});
    const [enabledMCPs, setEnabledMCPs] = useState<string[]>([]);
    const [disabledMcpTools, setDisabledMcpTools] = useState<string[]>([]);
    const [skin, setSkin] = useState<AgentConfig['skin']>({});

    // ── Fetched data ──
    const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
    const [modelSearch, setModelSearch] = useState('');
    const [loadingModels, setLoadingModels] = useState(true);
    const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([]);
    const [promptSearch, setPromptSearch] = useState('');
    const [apps, setApps] = useState<AppEntry[]>([]);
    const [skills, setSkills] = useState<{ global: SkillEntry[]; project: SkillEntry[] }>({ global: [], project: [] });
    const [mcpServers, setMcpServers] = useState<McpServer[]>([]);

    // Reset on open
    useEffect(() => {
        if (!isOpen) return;
        setActiveTab('model');
        setModelSearch('');
        setPromptSearch('');
        if (initial) {
            setName(initial.name);
            setModelId(initial.modelId);
            setPrompt(initial.prompt);
            setEnabledApps([...initial.enabledApps]);
            setEnabledSkills({ ...initial.enabledSkills });
            setEnabledMCPs([...initial.enabledMCPs]);
            setDisabledMcpTools([...(initial.disabledMcpTools || [])]);
            setSkin({ ...initial.skin });
        } else {
            setName('New Agent');
            setModelId('');
            setPrompt('');
            setEnabledApps([]);
            setEnabledSkills({});
            setEnabledMCPs([]);
            setDisabledMcpTools([]);
            setSkin({});
        }
    }, [isOpen, initial]);

    // Fetch all data on open
    useEffect(() => {
        if (!isOpen) return;
        const trpc = bridge.getTrpcClient();

        // Models — aligned with App.tsx refreshModelGroups
        (async () => {
            setLoadingModels(true);
            try {
                const [allConfigs, customProvidersList] = await Promise.all([
                    trpc.llmConfig.getAll.query(),
                    trpc.llmConfig.customProvidersList.query().catch(() => [] as Array<{ id: string; name: string }>),
                ]);
                const customNameMap = new Map<string, string>(
                    (customProvidersList as Array<{ id: string; name: string }>).map(cp => [cp.id, cp.name]),
                );
                const configuredGroupsMap = new Map<string, Set<string>>();
                (allConfigs as any[] || []).forEach((config: any) => {
                    const providerId = config?.providerId?.trim();
                    const model = config?.model?.trim();
                    if (!providerId || !model) return;
                    if (!configuredGroupsMap.has(providerId)) configuredGroupsMap.set(providerId, new Set<string>());
                    configuredGroupsMap.get(providerId)!.add(model);
                });
                const providerIds = Array.from(configuredGroupsMap.keys());
                const groups = await Promise.all(providerIds.map(async (providerId) => {
                    const mergedModels = new Set(Array.from(configuredGroupsMap.get(providerId) || []));
                    const isCustom = providerId.startsWith('custom:');
                    if (!isCustom) {
                        try {
                            const models = await trpc.modelRegistry.getModels.query({ providerId });
                            (models as Array<{ id?: string; name?: string }>).forEach((item: any) => {
                                const raw = item?.id || item?.name;
                                if (!raw || typeof raw !== 'string') return;
                                const normalized = raw.startsWith(`${providerId}/`) ? raw.slice(providerId.length + 1) : raw;
                                if (normalized.trim()) mergedModels.add(normalized.trim());
                            });
                        } catch { /* skip */ }
                    }
                    return { providerId, models: Array.from(mergedModels).sort((a, b) => a.localeCompare(b)), displayName: customNameMap.get(providerId) };
                }));
                groups.sort((a, b) => a.providerId.localeCompare(b.providerId));
                setModelGroups(groups);
            } catch (e) { console.error('[AgentCreate] models:', e); }
            finally { setLoadingModels(false); }
        })();

        // Prompt templates
        trpc.prompts.getTemplates.query().then((list: any) => setPromptTemplates(list || [])).catch(() => {});

        // Apps
        trpc.apps.getConfig.query().then((cfg: any) => {
            const arr: AppEntry[] = Object.entries(cfg || {}).map(([k, v]: any) => ({ name: v?.name || k, source: v?.source }));
            setApps(arr);
            if (!initial) setEnabledApps(arr.map(a => a.name));
        }).catch(() => {});

        // Skills
        (async () => {
            try {
                const globalRes = await trpc.skills.getRuntime.query({});
                const gs: SkillEntry[] = (globalRes as any)?.skills || [];
                let ps: SkillEntry[] = [];
                if (projectPath) {
                    const projRes = await trpc.skills.getRuntime.query({ projectPath });
                    ps = ((projRes as any)?.skills || []).filter((s: any) => s.scope === 'project');
                }
                const globalSkills = gs.filter(s => s.scope !== 'project');
                setSkills({ global: globalSkills, project: ps });
                if (!initial) {
                    const defaults: Record<string, string[]> = {};
                    if (globalSkills.length > 0) defaults['__global__'] = globalSkills.map(s => s.name);
                    if (projectPath && ps.length > 0) defaults[projectPath] = ps.map(s => s.name);
                    setEnabledSkills(defaults);
                }
            } catch { /* skip */ }
        })();

        // MCPs
        (async () => {
            try {
                const [cfg, runtime] = await Promise.all([trpc.mcp.getConfig.query(), trpc.mcp.getRuntime.query()]);
                const configServers = (cfg as Record<string, any>) || {};
                const runtimeServers = (runtime as Record<string, any>) || {};
                const allNames = new Set([
                    ...Object.keys(configServers).filter(k => typeof configServers[k] === 'object'),
                    ...Object.keys(runtimeServers).filter(k => typeof runtimeServers[k] === 'object'),
                ]);
                const servers: McpServer[] = Array.from(allNames).map(name => ({
                    name,
                    connected: runtimeServers[name]?.status === 'connected',
                    status: runtimeServers[name]?.status,
                    tools: runtimeServers[name]?.tools || [],
                }));
                setMcpServers(servers);
                if (!initial) {
                    setEnabledMCPs(servers.filter(s => s.connected).map(s => s.name));
                    setDisabledMcpTools([]);
                }
            } catch { /* skip */ }
        })();
    }, [isOpen, bridge, projectPath]);

    const handleSave = () => {
        if (!modelId) return; // Model required
        const id = initial?.id || `agent_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        onSave({ id, name: name.trim() || 'Unnamed Agent', prompt, modelId, enabledApps, enabledSkills, enabledMCPs, disabledMcpTools, skin });
        onClose();
    };

    // ── Derived ──
    const lowerModelSearch = modelSearch.toLowerCase();
    const filteredModelGroups = modelGroups.map(g => ({
        ...g,
        models: g.models.filter(m =>
            m.toLowerCase().includes(lowerModelSearch) ||
            g.providerId.toLowerCase().includes(lowerModelSearch) ||
            (g.displayName ?? '').toLowerCase().includes(lowerModelSearch)
        ),
    })).filter(g => g.models.length > 0);

    const currentModelSelection = (() => {
        if (!modelId || !modelId.includes(':')) return { provider: '—', model: '—' };
        const idx = modelId.indexOf(':');
        return { provider: modelId.slice(0, idx), model: modelId.slice(idx + 1) };
    })();

    const filteredTemplates = promptTemplates.filter(t =>
        t.name.toLowerCase().includes(promptSearch.toLowerCase()) || t.content.toLowerCase().includes(promptSearch.toLowerCase())
    ).slice(0, 20);

    const GLOBAL_KEY = '__global__';

    const renderToggle = (checked: boolean, onChange: (v: boolean) => void, disabled = false) => (
        <button type="button" role="switch" aria-checked={checked} disabled={disabled}
            onClick={e => { e.preventDefault(); e.stopPropagation(); onChange(!checked); }}
            className={`relative inline-flex items-center shrink-0 rounded-full transition-colors duration-200 w-8 h-[18px]
                ${checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--mat-border)]'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
            <span className={`inline-block rounded-full bg-white shadow transition-transform duration-200 w-3.5 h-3.5 translate-x-0.5 ${checked ? 'translate-x-3.5' : ''}`} />
        </button>
    );

    const toggleSkill = (groupKey: string, skillName: string) => {
        setEnabledSkills(prev => {
            const cur = prev[groupKey] || [];
            const next = cur.includes(skillName) ? cur.filter(n => n !== skillName) : [...cur, skillName];
            const out = { ...prev };
            if (next.length > 0) out[groupKey] = next; else delete out[groupKey];
            return out;
        });
    };

    /* ─────────────────── RENDER ─────────────────── */
    return (
        <AgentEditorModal
            isOpen={isOpen}
            onClose={onClose}
            title={initial ? `Edit Agent — ${initial.name}` : 'Create Agent'}
            width="max-w-[720px]"
            footer={
                <>
                    <button onClick={onClose} className="lg-btn hover:bg-[var(--mat-content-card-hover-bg)] px-4 py-2 rounded-xl text-[13px]">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!modelId}
                        className={`lg-btn rounded-full px-6 py-2 text-[13px] transition-all
                            ${modelId ? 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90' : 'bg-[var(--mat-content-card-hover-bg)] text-[var(--color-text-tertiary)] cursor-not-allowed'}`}
                    >
                        {initial ? 'Save Changes' : 'Create Agent'}
                    </button>
                </>
            }
        >
            {/* Name field */}
            <div className="flex flex-col gap-1">
                <label className="text-[14px] font-medium text-[var(--color-text-secondary)]">Name</label>
                <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--mat-input-bg)] border border-[var(--mat-border)] text-[13px] focus:outline-none focus:border-[var(--color-accent)]"
                    placeholder="Agent name"
                />
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setActiveTab(t.key)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all
                            ${activeTab === t.key
                                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/25'
                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-hover-bg)] border border-transparent'
                            }`}
                    >
                        {t.icon}
                        {t.label}
                        {t.required && <span className="text-[10px] text-[var(--color-danger)]">*</span>}
                    </button>
                ))}
            </div>

            {/* ── TAB CONTENT ── */}
            <div className="min-h-[320px]">

                {/* ─── MODEL TAB ─── */}
                {activeTab === 'model' && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-tertiary)]">
                            <span aria-hidden="true" className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--mat-border)] text-[10px] leading-none">i</span>
                            <span>Click a model to select it for this agent. <span className="text-[var(--color-danger)]">*Required</span></span>
                        </div>

                        {loadingModels ? (
                            <div className="py-8 text-center text-[14px] text-[var(--color-text-tertiary)]">Loading models...</div>
                        ) : modelGroups.length === 0 ? (
                            <div className="py-8 text-center text-[13px] text-[var(--color-text-tertiary)]">
                                <p>No model providers configured.</p>
                                {onSwitchToModelTab && (
                                    <button type="button" onClick={() => { onClose(); onSwitchToModelTab(); }}
                                        className="mt-2 text-[var(--color-accent)] hover:underline text-[13px]">
                                        Add Model Provider →
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {/* Current selection */}
                                {modelId && (
                                    <div className="flex items-center gap-2 text-[13px] text-[var(--color-text-primary)]">
                                        <div className="text-[12px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Current</div>
                                        <span className="text-[var(--color-success)]" aria-hidden="true">✅</span>
                                        <span className="truncate">
                                            {currentModelSelection.provider}
                                            <span className="mx-1 text-[var(--color-text-tertiary)]">/</span>
                                            {currentModelSelection.model}
                                        </span>
                                        <button type="button" onClick={() => setModelId('')}
                                            className="ml-auto text-[12px] text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]">
                                            Clear
                                        </button>
                                    </div>
                                )}

                                {/* Search */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-[12px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Provider</div>
                                    <input
                                        value={modelSearch}
                                        onChange={e => setModelSearch(e.target.value)}
                                        placeholder="Search model ..."
                                        className="w-[220px] bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] rounded-lg px-2.5 py-1.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
                                    />
                                </div>

                                {/* Provider groups */}
                                {filteredModelGroups.length === 0 ? (
                                    <div className="text-[13px] text-[var(--color-text-tertiary)]">No models found</div>
                                ) : (
                                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2 custom-scrollbar">
                                        {filteredModelGroups.map(group => (
                                            <div key={`model-group-${group.providerId}`} className="rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2 mr-1 min-h-[70px]">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <div className="text-[12px] uppercase tracking-wide text-[var(--color-text-tertiary)]">{group.displayName ?? group.providerId}</div>
                                                    {group.providerId.startsWith('custom:') && (
                                                        <span className="px-1 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.04em]
                                                            bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/20">
                                                            Custom
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                                                    {group.models.map(model => {
                                                        const fullId = `${group.providerId}:${model}`;
                                                        const active = modelId === fullId;
                                                        return (
                                                            <button
                                                                key={fullId}
                                                                type="button"
                                                                onClick={() => setModelId(fullId)}
                                                                className={`w-full text-left text-[13px] px-2 py-1.5 rounded-md transition-colors ${active
                                                                    ? 'bg-[var(--color-accent)] text-white'
                                                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-bg)]'
                                                                }`}
                                                            >
                                                                {model}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {onSwitchToModelTab && (
                                    <button type="button" onClick={() => { onClose(); onSwitchToModelTab(); }}
                                        className="self-start text-[13px] text-[var(--color-accent)] hover:underline">
                                        Add Model Provider →
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ─── PROMPT TAB ─── */}
                {activeTab === 'prompt' && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-tertiary)]">
                            <span aria-hidden="true" className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--mat-border)] text-[10px] leading-none">i</span>
                            <span>System prompt for this agent. Select a template or write custom.</span>
                        </div>

                        <div className="text-[12px] uppercase tracking-wide text-[var(--color-text-tertiary)] mb-0">Current</div>
                        <textarea
                            value={prompt} onChange={e => setPrompt(e.target.value)}
                            className="w-full h-[140px] overflow-y-auto bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] rounded-lg px-2.5 py-2 text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
                            placeholder="System prompt for this agent..."
                        />
                        <div className="text-[12px] text-[var(--color-text-tertiary)]">{prompt.length} chars · Undo: ⌘Z / Ctrl+Z</div>

                        <div className="flex items-center justify-between gap-2">
                            <div className="text-[12px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Templates</div>
                            <input
                                value={promptSearch} onChange={e => setPromptSearch(e.target.value)}
                                placeholder="Search templates..."
                                className="w-[200px] bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] rounded-lg px-2.5 py-1.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
                            />
                        </div>
                        <div className="rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2">
                            <div className="max-h-[90px] overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
                                {filteredTemplates.length === 0 ? (
                                    <div className="text-[13px] text-[var(--color-text-tertiary)] px-1 py-0.5">No templates found</div>
                                ) : filteredTemplates.map(t => (
                                    <button key={t.id} type="button" onClick={() => setPrompt(t.content)}
                                        className="w-full text-left text-[13px] px-2 py-1.5 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-bg)] transition-colors">
                                        {t.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── APPS TAB ─── */}
                {activeTab === 'apps' && (() => {
                    const anyEnabled = enabledApps.length > 0;
                    const toggleAll = (v: boolean) => setEnabledApps(v ? apps.map(a => a.name) : []);
                    return (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-tertiary)]">
                                <span aria-hidden="true" className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--mat-border)] text-[10px] leading-none">i</span>
                                <span>Enable TUI Apps for this agent.</span>
                            </div>
                            {renderToggle(anyEnabled, toggleAll)}
                        </div>
                        {apps.length === 0 ? (
                            <div className="text-[13px] text-[var(--color-text-tertiary)]">No apps found</div>
                        ) : (
                            <div className="rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2 space-y-1">
                                {apps.map(app => {
                                    const checked = enabledApps.includes(app.name);
                                    return (
                                        <label key={`app-${app.name}`} className="flex items-center justify-between gap-2 text-[13px] text-[var(--color-text-secondary)]">
                                            <span className="truncate">{app.name}</span>
                                            {renderToggle(checked, v => setEnabledApps(prev => v ? [...prev, app.name] : prev.filter(n => n !== app.name)))}
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    );
                })()}

                {/* ─── SKILLS TAB ─── */}
                {activeTab === 'skills' && (() => {
                    const allSkillNames = [...skills.global.map(s => s.name), ...(projectPath ? skills.project.map(s => s.name) : [])];
                    const anySkillsEnabled = Object.values(enabledSkills).some(arr => arr.length > 0);
                    const toggleAllSkills = (v: boolean) => {
                        if (v) {
                            const defaults: Record<string, string[]> = {};
                            if (skills.global.length > 0) defaults[GLOBAL_KEY] = skills.global.map(s => s.name);
                            if (projectPath && skills.project.length > 0) defaults[projectPath] = skills.project.map(s => s.name);
                            setEnabledSkills(defaults);
                        } else {
                            setEnabledSkills({});
                        }
                    };
                    const renderSkillList = (items: SkillEntry[], groupKey: string) => (
                        <div className="rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2 space-y-1">
                            {items.map(s => {
                                const checked = (enabledSkills[groupKey] || []).includes(s.name);
                                return (
                                    <label key={`skill-${s.name}`} className="flex items-center justify-between gap-2 text-[13px] text-[var(--color-text-secondary)]">
                                        <span className="truncate">{s.name}</span>
                                        {renderToggle(checked, () => toggleSkill(groupKey, s.name))}
                                    </label>
                                );
                            })}
                        </div>
                    );
                    return (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-tertiary)]">
                                <span aria-hidden="true" className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--mat-border)] text-[10px] leading-none">i</span>
                                <span>Enable Skills for this agent.</span>
                            </div>
                            {renderToggle(anySkillsEnabled, toggleAllSkills)}
                        </div>
                        {skills.global.length === 0 && skills.project.length === 0 ? (
                            <div className="text-[13px] text-[var(--color-text-tertiary)]">No skills available</div>
                        ) : (
                            <div className="space-y-2">
                                {skills.global.length > 0 && (
                                    <div>
                                        <div className="text-[12px] uppercase tracking-wide text-[var(--color-text-tertiary)] mb-1">Global</div>
                                        {renderSkillList(skills.global, GLOBAL_KEY)}
                                    </div>
                                )}
                                {skills.project.length > 0 && projectPath && (
                                    <div>
                                        <div className="text-[12px] uppercase tracking-wide text-[var(--color-text-tertiary)] mb-1">
                                            Project <span className="normal-case">{projectPath.split('/').pop()}</span>
                                        </div>
                                        {renderSkillList(skills.project, projectPath)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    );
                })()}

                {/* ─── MCP TAB ─── */}
                {activeTab === 'mcp' && (() => {
                    const activeServers = mcpServers.filter(s => s.connected);
                    const inactiveServers = mcpServers.filter(s => !s.connected);
                    const toggleMcp = (name: string) => setEnabledMCPs(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
                    const mcpAnyEnabled = enabledMCPs.length > 0;
                    const toggleAllMcp = (v: boolean) => setEnabledMCPs(v ? mcpServers.map(s => s.name) : []);
                    return (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-tertiary)]">
                                <span aria-hidden="true" className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--mat-border)] text-[10px] leading-none">i</span>
                                <span>Enable MCP servers for this agent.</span>
                            </div>
                            {renderToggle(mcpAnyEnabled, toggleAllMcp)}
                        </div>
                        {mcpServers.length === 0 ? (
                            <div className="py-6 text-center text-[14px] text-[var(--color-text-tertiary)]">No MCP servers configured</div>
                        ) : (
                            <div className="space-y-3 max-h-[320px] overflow-y-auto custom-scrollbar">
                                {/* Active servers */}
                                {activeServers.length > 0 && (
                                    <div>
                                        <div className="text-[12px] uppercase tracking-wide text-[var(--color-text-tertiary)] mb-1">Active</div>
                                        <div className="space-y-2">
                                            {activeServers.map(srv => {
                                                const checked = enabledMCPs.includes(srv.name);
                                                return (
                                                    <details key={srv.name} className="rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2" open>
                                                        <summary className="list-none cursor-pointer flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--color-success)]" />
                                                                <span className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">{srv.name}</span>
                                                            </div>
                                                            {renderToggle(checked, () => toggleMcp(srv.name))}
                                                        </summary>
                                                        <div className={`mt-1 space-y-0.5 ${checked ? '' : 'opacity-45'}`}>
                                                            {srv.tools.map(tool => {
                                                                const toolKey = buildMcpToolItemKey(srv.name, tool.name);
                                                                const legacyToolKey = `${srv.name}::${tool.name}`;
                                                                const toolEnabled = !disabledMcpTools.includes(toolKey) && !disabledMcpTools.includes(legacyToolKey) && !disabledMcpTools.includes(tool.name);
                                                                const toggleTool = (val: boolean) => setDisabledMcpTools(prev =>
                                                                    val
                                                                        ? prev.filter(k => k !== toolKey && k !== legacyToolKey && k !== tool.name)
                                                                        : [...prev.filter(k => k !== legacyToolKey && k !== tool.name), toolKey]
                                                                );
                                                                return (
                                                                <div key={`mcp-tool-${tool.name}`} className="flex items-center justify-between gap-2 px-1 py-0.5">
                                                                    <span className="text-[13px] text-[var(--color-text-secondary)] truncate">{tool.name}</span>
                                                                    {renderToggle(toolEnabled && checked, (v) => toggleTool(v))}
                                                                </div>
                                                                );
                                                            })}
                                                            {srv.tools.length === 0 && (
                                                                <div className="text-[12px] text-[var(--color-text-tertiary)] py-1">No tools listed</div>
                                                            )}
                                                        </div>
                                                    </details>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {/* Inactive servers */}
                                {inactiveServers.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-[12px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Inactive</div>
                                            {onOpenMcpSettings && (
                                                <button type="button" onClick={() => { onClose(); onOpenMcpSettings(); }}
                                                    className="text-[12px] text-[var(--color-accent)] hover:underline">
                                                    Open Settings To Activate →
                                                </button>
                                            )}
                                        </div>
                                        <div className="rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2 space-y-1.5 opacity-50">
                                            {inactiveServers.map(srv => (
                                                <div key={srv.name} className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-tertiary)]">
                                                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[var(--color-text-tertiary)]" />
                                                    <span className="truncate">{srv.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    );
                })()}

                {/* ─── SKIN TAB ─── */}
                {activeTab === 'skin' && (
                    <div className="flex flex-col gap-3">
                        <p className="text-[14px] text-[var(--color-text-tertiary)]">
                            Each state shows the default animated icon. Paste custom SVG code to override it.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            {SKIN_STATES.map(({ key, label, Default }) => {
                                const hasCustom = !!skin[key]?.trim();
                                return (
                                    <div key={key} className="flex flex-col gap-1">
                                        <label className="text-[14px] font-medium text-[var(--color-text-secondary)]">{label}</label>
                                        <div className="flex gap-2">
                                            {/* Left: square SVG preview */}
                                            <div className="w-[56px] h-[56px] shrink-0 rounded-xl border border-[var(--mat-border)] bg-[var(--mat-input-bg)] flex items-center justify-center overflow-hidden">
                                                {hasCustom ? (
                                                    <div className="w-[36px] h-[36px]" dangerouslySetInnerHTML={{ __html: skin[key]! }} />
                                                ) : (
                                                    <Default className="w-[32px] h-[32px] text-[var(--color-text-tertiary)]" />
                                                )}
                                            </div>
                                            {/* Right: textarea */}
                                            <textarea
                                                value={skin[key] || ''}
                                                onChange={e => setSkin(prev => ({ ...prev, [key]: e.target.value }))}
                                                className="flex-1 min-w-0 h-[56px] px-2 py-1.5 rounded-lg bg-[var(--mat-input-bg)] border border-[var(--mat-border)] text-[13px] font-mono resize-none focus:outline-none focus:border-[var(--color-accent)] custom-scrollbar"
                                                placeholder={`SVG for ${label}...`}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </AgentEditorModal>
    );
};
