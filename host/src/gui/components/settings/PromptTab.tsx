import React, { useEffect, useMemo, useState } from 'react';
import { useChatBridge } from '../../ChatBridge.js';
import { LoadingState } from './LoadingState.js';

type PromptTemplate = {
    id: string;
    name: string;
    content: string;
    createdAt?: number;
    updatedAt?: number;
};

const createTemplate = (): PromptTemplate => {
    const now = Date.now();
    return {
        id: `prompt_${now}_${Math.random().toString(36).slice(2, 7)}`,
        name: 'New Prompt',
        content: '',
        createdAt: now,
        updatedAt: now,
    };
};

export const PromptTab: React.FC = () => {
    const bridge = useChatBridge();
    const [loading, setLoading] = useState(true);
    const [templates, setTemplates] = useState<PromptTemplate[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    /** Tracks the id of a newly created (unsaved) template */
    const [unsavedId, setUnsavedId] = useState<string | null>(null);
    /** Tracks whether a dirty edit has been made to a saved template */
    const [isDirty, setIsDirty] = useState(false);
    /** Tracks delete-confirmation state */
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const rows = await bridge.getTrpcClient().prompts.getTemplates.query();
                setTemplates((rows as PromptTemplate[]) || []);
                setSelectedId((rows as PromptTemplate[])[0]?.id ?? null);
            } catch (error) {
                console.error('[PromptTab] Failed to load templates:', error);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [bridge]);

    const selectedIndex = useMemo(() => templates.findIndex((item) => item.id === selectedId), [templates, selectedId]);
    const selected = selectedIndex >= 0 ? templates[selectedIndex] : null;
    const isSelectedUnsaved = unsavedId != null && selectedId === unsavedId;

    const persistTemplates = async (nextTemplates: PromptTemplate[]) => {
        setTemplates(nextTemplates);
        setSaving(true);
        try {
            await bridge.getTrpcClient().prompts.replaceTemplates.mutate({ templates: nextTemplates });
        } catch (error) {
            console.error('[PromptTab] Failed to save templates:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        const sorted = [...templates].sort((a, b) => a.name.localeCompare(b.name));
        await persistTemplates(sorted);
        setUnsavedId(null);
        setIsDirty(false);
    };

    const handleDelete = async (id: string) => {
        const next = templates.filter((item) => item.id !== id);
        if (id === unsavedId) {
            setTemplates(next);
            setUnsavedId(null);
        } else {
            await persistTemplates(next);
        }
        setSelectedId(next[0]?.id ?? null);
        setConfirmDeleteId(null);
        setIsDirty(false);
    };

    if (loading) {
        return <LoadingState message="Loading prompt templates..." size="md" />;
    }

    return (
        <div className="relative flex flex-col h-full min-h-0 gap-4">
            <div>
                <h3 className="text-[13px] font-medium text-[var(--color-text-secondary)]">Prompt Templates</h3>
                <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">
                    Manage global templates for quick topic prompt selection.
                </p>
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => {
                        const created = createTemplate();
                        const next = [...templates, created];
                        setTemplates(next);
                        setSelectedId(created.id);
                        setUnsavedId(created.id);
                        setIsDirty(false);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[12px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-all"
                >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M12 4v16m8-8H4" /></svg>
                    Add Prompt
                </button>
                {saving && <span className="text-[11px] text-[var(--color-text-tertiary)]">Saving…</span>}
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-3">
                <div className="mat-content rounded-[16px] overflow-hidden p-2">
                    {templates.length === 0 ? (
                        <div className="h-full min-h-[180px] flex items-center justify-center text-[13px] text-[var(--color-text-tertiary)]">
                            No prompt templates yet.
                        </div>
                    ) : (
                        <div className="space-y-1 max-h-full overflow-y-auto p-1">
                            {templates.map((template) => (
                                <div
                                    key={template.id}
                                    onClick={() => { setSelectedId(template.id); setConfirmDeleteId(null); }}
                                    className={`w-full px-3 py-2 rounded-xl border cursor-pointer transition-all duration-200 ${selectedId === template.id
                                        ? 'bg-[var(--mat-content-card-hover-bg)] border-[var(--mat-border-highlight)]'
                                        : 'bg-transparent border-transparent hover:bg-[var(--mat-content-card-hover-bg)] hover:border-[var(--mat-border)]'
                                        }`}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[13px] text-[var(--color-text-primary)] truncate">{template.name}</span>
                                        {template.id === unsavedId && (
                                            <span className="text-[9px] text-[var(--color-accent)] border border-[var(--color-accent)]/30 rounded px-1">new</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="mat-content rounded-[16px] p-4 sm:p-5 overflow-y-auto">
                    {!selected ? (
                        <div className="h-full min-h-[180px] flex items-center justify-center text-[13px] text-[var(--color-text-tertiary)]">
                            Select a template to edit
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <input
                                value={selected.name}
                                onChange={(event) => {
                                    const next = templates.map((item) => item.id === selected.id
                                        ? { ...item, name: event.target.value, updatedAt: Date.now() }
                                        : item);
                                    setTemplates(next);
                                    if (!isSelectedUnsaved) setIsDirty(true);
                                }}
                                className="w-full bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] rounded-lg px-3 py-2 text-[13px]"
                                placeholder="Template name"
                            />
                            <textarea
                                value={selected.content}
                                onChange={(event) => {
                                    const next = templates.map((item) => item.id === selected.id
                                        ? { ...item, content: event.target.value, updatedAt: Date.now() }
                                        : item);
                                    setTemplates(next);
                                    if (!isSelectedUnsaved) setIsDirty(true);
                                }}
                                rows={12}
                                className="w-full bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] rounded-lg px-3 py-2 text-[13px] resize-y"
                                placeholder="Template content"
                            />
                            <div className="flex items-center gap-2">
                                {/* Save button: visible for unsaved new template or dirty edits */}
                                {(isSelectedUnsaved || isDirty) && (
                                    <button
                                        type="button"
                                        onClick={() => void handleSave()}
                                        disabled={saving}
                                        className="px-4 py-1.5 rounded-lg bg-[var(--color-accent)] text-white text-[12px] font-medium hover:bg-[var(--color-accent)]/90 transition-colors disabled:opacity-50"
                                    >
                                        {saving ? 'Saving…' : 'Save'}
                                    </button>
                                )}
                                {/* Delete button: only for saved templates */}
                                {!isSelectedUnsaved && (
                                    confirmDeleteId === selected.id ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[12px] text-[var(--color-danger)]">Delete this template?</span>
                                            <button
                                                type="button"
                                                onClick={() => void handleDelete(selected.id)}
                                                className="px-3 py-1 rounded-lg bg-[var(--color-danger)] text-white text-[12px] font-medium hover:bg-[var(--color-danger)]/90 transition-colors"
                                            >
                                                Confirm
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setConfirmDeleteId(null)}
                                                className="px-3 py-1 rounded-lg border border-[var(--mat-border)] text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-hover-bg)] transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setConfirmDeleteId(selected.id)}
                                            className="px-3 py-1.5 rounded-lg border border-[var(--color-danger)]/40 text-[var(--color-danger)] text-[12px] hover:bg-[var(--color-danger)]/10 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
