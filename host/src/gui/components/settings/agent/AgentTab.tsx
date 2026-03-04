/**
 * AgentTab - Card-based Agent management
 *
 * Pure card list + modal editors (no master-detail panel).
 * "Add Agent" opens a tabbed AgentCreateModal.
 * Each card has clickable sections for: Prompt / Model / Apps / Skills / MCP / Skin.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useChatBridge } from '../../../ChatBridge.js';
import { LoadingState } from '../LoadingState.js';
import { AgentCard } from './AgentCard.js';
import { AgentCreateModal } from './AgentCreateModal.js';
import { AgentPromptEditor } from './AgentPromptEditor.js';
import { AgentModelEditor } from './AgentModelEditor.js';
import { AgentAppsEditor } from './AgentAppsEditor.js';
import { AgentSkillsEditor } from './AgentSkillsEditor.js';
import { AgentMcpEditor } from './AgentMcpEditor.js';
import { AgentSkinEditor } from './AgentSkinEditor.js';
import { buildMcpToolItemKey } from '../../../../shared/source-control-keys.js';

export interface AgentConfig {
    id: string;
    name: string;
    prompt: string;
    modelId: string;
    enabledApps: string[];
    enabledSkills: Record<string, string[]>;
    enabledMCPs: string[];
    /** Individual tool keys disabled within enabled MCP servers */
    disabledMcpTools?: string[];
    skin: {
        working?: string;
        idle?: string;
        sleeping?: string;
        pause?: string;
    };
}

const createAgent = (): AgentConfig => {
    const now = Date.now();
    return {
        id: `agent_${now}_${Math.random().toString(36).slice(2, 7)}`,
        name: 'New Agent',
        prompt: '',
        modelId: '',
        enabledApps: [],
        enabledSkills: {},
        enabledMCPs: [],
        disabledMcpTools: [],
        skin: {},
    };
};

type EditorType = 'prompt' | 'model' | 'apps' | 'skills' | 'mcp' | 'skin' | null;

export const AgentTab: React.FC<{ projectPath?: string | null; onSwitchTab?: (tab: string) => void }> = ({ projectPath, onSwitchTab }) => {
    const bridge = useChatBridge();
    const [loading, setLoading] = useState(true);
    const [agents, setAgents] = useState<AgentConfig[]>([]);
    const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // Modal state
    const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
    const [editorType, setEditorType] = useState<EditorType>(null);

    // Create/edit modal state
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [createModalInitial, setCreateModalInitial] = useState<AgentConfig | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await bridge.getAgents();
                setAgents(data.list || []);
                setActiveAgentId(data.activeAgentId || null);
            } catch (error) {
                console.error('[AgentTab] Failed to load agents:', error);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [bridge]);

    const editingAgent = editingAgentId ? agents.find((a) => a.id === editingAgentId) : null;

    const syncActiveTopicAgentSources = useCallback(async (nextAgents: AgentConfig[]) => {
        const activeTopicId = bridge.getActiveTopicId();
        if (!activeTopicId) return;

        const activeTopic = bridge.getTopic(activeTopicId);
        if (!activeTopic?.agentId) return;

        const boundAgent = nextAgents.find((agent) => agent.id === activeTopic.agentId);
        if (!boundAgent) return;

        const trpc = bridge.getTrpcClient();
        const currentCaps = await trpc.sourceControl.getTopic.query({
            id: activeTopicId,
            projectPath: projectPath || undefined,
        });

        const enabledAppsSet = new Set(boundAgent.enabledApps || []);
        const enabledSkillNames = new Set(Object.values(boundAgent.enabledSkills || {}).flat());
        const enabledMCPsSet = new Set(boundAgent.enabledMCPs || []);
        const disabledToolsSet = new Set(boundAgent.disabledMcpTools || []);

        await trpc.sourceControl.setSourceEnabled.mutate({
            id: activeTopicId,
            source: 'apps',
            enabled: enabledAppsSet.size > 0,
        });
        await trpc.sourceControl.setSourceEnabled.mutate({
            id: activeTopicId,
            source: 'skill',
            enabled: enabledSkillNames.size > 0,
        });
        await trpc.sourceControl.setSourceEnabled.mutate({
            id: activeTopicId,
            source: 'mcp',
            enabled: enabledMCPsSet.size > 0,
        });

        for (const item of currentCaps.apps.items) {
            const shouldEnable = enabledAppsSet.has(item.name);
            if (item.enabled !== shouldEnable) {
                await trpc.sourceControl.setItemEnabled.mutate({
                    id: activeTopicId,
                    source: 'apps',
                    itemName: item.name,
                    enabled: shouldEnable,
                });
            }
        }

        for (const item of currentCaps.skill.items) {
            const shouldEnable = enabledSkillNames.has(item.name);
            if (item.enabled !== shouldEnable) {
                await trpc.sourceControl.setItemEnabled.mutate({
                    id: activeTopicId,
                    source: 'skill',
                    itemName: item.name,
                    enabled: shouldEnable,
                });
            }
        }

        for (const group of currentCaps.mcp.groups) {
            const serverShouldEnable = enabledMCPsSet.has(group.serverName);
            if (group.enabled !== serverShouldEnable) {
                await trpc.sourceControl.setItemEnabled.mutate({
                    id: activeTopicId,
                    source: 'mcp',
                    itemName: group.key,
                    enabled: serverShouldEnable,
                });
            }

            for (const item of group.items) {
                const canonicalKey = buildMcpToolItemKey(group.serverName, item.name);
                const legacyScopedKey = `${group.serverName}::${item.name}`;
                const legacyUnscopedKey = item.name;
                const toolShouldEnable = !(
                    disabledToolsSet.has(item.key)
                    || disabledToolsSet.has(canonicalKey)
                    || disabledToolsSet.has(legacyScopedKey)
                    || disabledToolsSet.has(legacyUnscopedKey)
                );

                if (item.enabled !== toolShouldEnable) {
                    await trpc.sourceControl.setItemEnabled.mutate({
                        id: activeTopicId,
                        source: 'mcp',
                        itemName: item.key,
                        enabled: toolShouldEnable,
                    });
                }
            }
        }
    }, [bridge, projectPath]);

    const saveAgents = useCallback(async (nextAgents: AgentConfig[], nextActiveId: string | null) => {
        setAgents(nextAgents);
        setActiveAgentId(nextActiveId);
        setSaving(true);
        try {
            await bridge.saveAgents(nextAgents, nextActiveId);
            await syncActiveTopicAgentSources(nextAgents);
        } catch (error) {
            console.error('[AgentTab] Failed to save agents:', error);
        } finally {
            setSaving(false);
        }
    }, [bridge, syncActiveTopicAgentSources]);

    const updateAgent = useCallback((agentId: string, updates: Partial<AgentConfig>) => {
        const next = agents.map((a) => (a.id === agentId ? { ...a, ...updates } : a));
        void saveAgents(next, activeAgentId);
    }, [agents, activeAgentId, saveAgents]);

    const deleteAgent = useCallback((agentId: string) => {
        const next = agents.filter((a) => a.id !== agentId);
        const nextActiveId = activeAgentId === agentId ? null : activeAgentId;
        void saveAgents(next, nextActiveId);
    }, [agents, activeAgentId, saveAgents]);

    const openEditor = (agentId: string, type: EditorType) => {
        setEditingAgentId(agentId);
        setEditorType(type);
    };

    const closeEditor = () => {
        setEditingAgentId(null);
        setEditorType(null);
    };

    if (loading) {
        return <LoadingState message="Loading agents..." size="md" />;
    }

    return (
        <div className="relative flex flex-col h-full min-h-0 gap-4">
            {/* Header */}
            <div>
                <h3 className="text-[13px] font-medium text-[var(--color-text-secondary)]">Agents</h3>
                <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">
                    Create custom Agents with specific models, prompts, and tools. Set one as default to auto-apply on new topics.
                </p>
            </div>

            {/* Add button */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => {
                        setCreateModalInitial(null);
                        setCreateModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[12px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-all"
                >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4" /></svg>
                    Add Agent
                </button>
                {saving && <span className="text-[11px] text-[var(--color-text-tertiary)]">Saving…</span>}
            </div>

            {/* Card list */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {agents.length === 0 ? (
                    <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-2 text-[var(--color-text-tertiary)]">
                        <svg className="w-10 h-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                            <circle cx="12" cy="8" r="4" />
                            <path d="M5 20v-1a7 7 0 0114 0v1" />
                        </svg>
                        <span className="text-[13px]">No agents yet</span>
                        <span className="text-[12px]">Click "Add Agent" to create one</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {agents.map((agent) => (
                            <AgentCard
                                key={agent.id}
                                agent={agent}
                                isActive={activeAgentId === agent.id}
                                projectPath={projectPath}
                                onSetActive={() => void saveAgents(agents, agent.id)}
                                onClearActive={() => void saveAgents(agents, null)}
                                onDelete={() => deleteAgent(agent.id)}
                                onEditName={(name) => updateAgent(agent.id, { name })}
                                onEditPrompt={() => openEditor(agent.id, 'prompt')}
                                onEditModel={() => openEditor(agent.id, 'model')}
                                onEditApps={() => openEditor(agent.id, 'apps')}
                                onEditSkills={() => openEditor(agent.id, 'skills')}
                                onEditMcp={() => openEditor(agent.id, 'mcp')}
                                onEditSkin={() => openEditor(agent.id, 'skin')}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Modal editors ── */}
            {editingAgent && (
                <>
                    <AgentPromptEditor
                        isOpen={editorType === 'prompt'}
                        onClose={closeEditor}
                        value={editingAgent.prompt}
                        onSave={(prompt) => updateAgent(editingAgent.id, { prompt })}
                    />
                    <AgentModelEditor
                        isOpen={editorType === 'model'}
                        onClose={closeEditor}
                        value={editingAgent.modelId}
                        onSave={(modelId) => updateAgent(editingAgent.id, { modelId })}
                    />
                    <AgentAppsEditor
                        isOpen={editorType === 'apps'}
                        onClose={closeEditor}
                        value={editingAgent.enabledApps}
                        onSave={(enabledApps) => updateAgent(editingAgent.id, { enabledApps })}
                    />
                    <AgentSkillsEditor
                        isOpen={editorType === 'skills'}
                        onClose={closeEditor}
                        value={editingAgent.enabledSkills}
                        onSave={(enabledSkills) => updateAgent(editingAgent.id, { enabledSkills })}
                        currentProjectPath={projectPath}
                    />
                    <AgentMcpEditor
                        isOpen={editorType === 'mcp'}
                        onClose={closeEditor}
                        value={editingAgent.enabledMCPs}
                        disabledTools={editingAgent.disabledMcpTools || []}
                        onSave={(enabledMCPs, disabledMcpTools) => updateAgent(editingAgent.id, { enabledMCPs, disabledMcpTools })}
                    />
                    <AgentSkinEditor
                        isOpen={editorType === 'skin'}
                        onClose={closeEditor}
                        value={editingAgent.skin}
                        onSave={(skin) => updateAgent(editingAgent.id, { skin })}
                    />
                </>
            )}

            {/* ── Create / Edit Agent modal ── */}
            <AgentCreateModal
                isOpen={createModalOpen}
                onClose={() => { setCreateModalOpen(false); setCreateModalInitial(null); }}
                initial={createModalInitial}
                projectPath={projectPath}
                onSwitchToModelTab={onSwitchTab ? () => { setCreateModalOpen(false); onSwitchTab('model'); } : undefined}
                onOpenMcpSettings={onSwitchTab ? () => { setCreateModalOpen(false); onSwitchTab('mcp'); } : undefined}
                onSave={(agent) => {
                    const exists = agents.find(a => a.id === agent.id);
                    if (exists) {
                        // Update existing
                        const next = agents.map(a => a.id === agent.id ? agent : a);
                        void saveAgents(next, activeAgentId);
                    } else {
                        // Create new
                        void saveAgents([...agents, agent], activeAgentId);
                    }
                    setCreateModalOpen(false);
                    setCreateModalInitial(null);
                }}
            />
        </div>
    );
};
