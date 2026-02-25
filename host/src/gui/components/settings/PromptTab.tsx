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

    const saveTemplates = async (nextTemplates: PromptTemplate[]) => {
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
                        const next = [...templates, created].sort((a, b) => a.name.localeCompare(b.name));
                        void saveTemplates(next);
                        setSelectedId(created.id);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--mat-content-card-hover-bg)] border border-[var(--mat-border)] text-[12px]"
                >
                    Add Template
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
                                    onClick={() => setSelectedId(template.id)}
                                    className={`w-full px-3 py-2 rounded-xl border cursor-pointer transition-all duration-200 ${selectedId === template.id
                                        ? 'bg-[var(--mat-content-card-hover-bg)] border-[var(--mat-border-highlight)]'
                                        : 'bg-transparent border-transparent hover:bg-[var(--mat-content-card-hover-bg)] hover:border-[var(--mat-border)]'
                                        }`}
                                >
                                    <div className="text-[13px] text-[var(--color-text-primary)] truncate">{template.name}</div>
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
                                }}
                                onBlur={() => void saveTemplates(templates)}
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
                                }}
                                onBlur={() => void saveTemplates(templates)}
                                rows={12}
                                className="w-full bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] rounded-lg px-3 py-2 text-[13px] resize-y"
                                placeholder="Template content"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const next = templates.filter((item) => item.id !== selected.id);
                                    void saveTemplates(next);
                                    setSelectedId(next[0]?.id ?? null);
                                }}
                                className="px-3 py-1.5 rounded-lg border border-[var(--color-danger)]/40 text-[var(--color-danger)] text-[12px]"
                            >
                                Delete Template
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
