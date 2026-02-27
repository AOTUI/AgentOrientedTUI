/**
 * AgentModelEditor — Model selector matching ChatArea Model popover
 *
 * Layout: (i) hint → "Current" badge → Search → Provider-group cards with click-to-select
 */
import React, { useEffect, useState } from 'react';
import { AgentEditorModal } from './AgentEditorModal.js';
import { useChatBridge } from '../../../ChatBridge.js';

interface ModelGroup { providerId: string; models: string[]; displayName?: string; }

export interface AgentModelEditorProps {
    isOpen: boolean;
    onClose: () => void;
    value: string;
    onSave: (modelId: string) => void;
}

export const AgentModelEditor: React.FC<AgentModelEditorProps> = ({
    isOpen, onClose, value, onSave,
}) => {
    const bridge = useChatBridge();
    const [draft, setDraft] = useState(value);
    const [modelGroups, setModelGroups] = useState<ModelGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setDraft(value);
        setSearchQuery('');
        const load = async () => {
            setLoading(true);
            try {
                const trpc = bridge.getTrpcClient();
                const [configs, customProviders] = await Promise.all([
                    trpc.llmConfig.getAll.query(),
                    trpc.llmConfig.customProvidersList.query(),
                ]);
                const providerModels = new Map<string, Set<string>>();
                const providerDisplayNames = new Map<string, string>();
                for (const config of configs as any[]) {
                    const pid = config.providerId || 'unknown';
                    if (!providerModels.has(pid)) providerModels.set(pid, new Set<string>());
                    if (config.model) {
                        const modelName = config.model.includes(':') ? config.model.split(':').slice(1).join(':') : config.model;
                        providerModels.get(pid)!.add(modelName);
                    }
                }
                for (const cp of customProviders as any[]) {
                    if (!providerModels.has(cp.id)) providerModels.set(cp.id, new Set<string>());
                    providerDisplayNames.set(cp.id, cp.name || cp.id);
                }
                const standardProviders = ['openai', 'anthropic', 'google', 'xai'];
                for (const pid of standardProviders) {
                    if (providerModels.has(pid)) {
                        try {
                            const registryModels = await trpc.modelRegistry.getModels.query({ providerId: pid });
                            for (const m of registryModels as any[]) {
                                const modelId = m.id || m.modelId || '';
                                if (modelId) providerModels.get(pid)!.add(modelId);
                            }
                        } catch { /* registry unavailable */ }
                    }
                }
                const groups: ModelGroup[] = [];
                for (const [providerId, models] of providerModels.entries()) {
                    if (models.size === 0) continue;
                    groups.push({ providerId, models: Array.from(models).sort(), displayName: providerDisplayNames.get(providerId) });
                }
                groups.sort((a, b) => a.providerId.localeCompare(b.providerId));
                setModelGroups(groups);
            } catch (err) {
                console.error('[AgentModelEditor] load err', err);
            } finally { setLoading(false); }
        };
        void load();
    }, [isOpen, value, bridge]);

    const handleSelect = (fullId: string) => { setDraft(fullId); };
    const handleSave = () => { onSave(draft); onClose(); };

    const q = searchQuery.toLowerCase();
    const filteredGroups = modelGroups
        .map(g => ({ ...g, models: g.models.filter(m => m.toLowerCase().includes(q) || g.providerId.toLowerCase().includes(q)) }))
        .filter(g => g.models.length > 0);

    return (
        <AgentEditorModal isOpen={isOpen} onClose={onClose} title="Model" width="max-w-[500px]"
            footer={<>
                <button onClick={onClose} className="lg-btn hover:bg-[var(--mat-content-card-hover-bg)] px-4 py-2 rounded-xl text-[13px]">Cancel</button>
                <button onClick={handleSave} className="lg-btn rounded-full bg-[var(--color-accent)] text-white border-transparent hover:bg-[var(--color-accent)]/90 px-6 py-2 text-[13px]">Save</button>
            </>}
        >
            {/* (i) hint */}
            <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-tertiary)]">
                <span aria-hidden="true" className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--mat-border)] text-[10px] leading-none">i</span>
                <span>Choose the default model for this agent.</span>
            </div>

            {/* Current badge */}
            {draft && (
                <div className="flex items-center gap-2">
                    <span className="text-[12px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Current</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-[13px] font-mono">
                        ✓ {draft}
                    </span>
                </div>
            )}

            {/* Search */}
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search models..."
                className="w-full bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] rounded-lg px-2.5 py-1.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]" />

            {/* Provider groups */}
            <div className="max-h-[280px] overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
                {loading ? (
                    <div className="text-center text-[14px] text-[var(--color-text-tertiary)] py-4">Loading models...</div>
                ) : filteredGroups.length === 0 ? (
                    <div className="text-center text-[14px] text-[var(--color-text-tertiary)] py-4">No models found</div>
                ) : filteredGroups.map(group => (
                    <div key={group.providerId} className="rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2">
                        <div className="text-[12px] uppercase tracking-wide text-[var(--color-text-tertiary)] px-1 pb-1">
                            {group.displayName || group.providerId}
                        </div>
                        <div className="space-y-0.5">
                            {group.models.map(model => {
                                const fullId = `${group.providerId}:${model}`;
                                const selected = draft === fullId;
                                return (
                                    <button key={model} type="button" onClick={() => handleSelect(fullId)}
                                        className={`w-full text-left text-[13px] font-mono px-2 py-1.5 rounded-md transition-colors ${
                                            selected
                                                ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-medium'
                                                : 'text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-bg)]'
                                        }`}>
                                        {selected && <span className="mr-1.5 text-[12px]">✓</span>}
                                        {model}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </AgentEditorModal>
    );
};
