/**
 * AgentPromptEditor — Prompt editor matching ChatArea Prompt popover
 *
 * Layout: (i) hint → "Current" textarea → "Templates" search + compact list
 */
import React, { useEffect, useState } from 'react';
import { AgentEditorModal } from './AgentEditorModal.js';
import { useChatBridge } from '../../../ChatBridge.js';

interface PromptTemplate { id: string; name: string; content: string; }

export interface AgentPromptEditorProps {
    isOpen: boolean;
    onClose: () => void;
    value: string;
    onSave: (prompt: string) => void;
}

export const AgentPromptEditor: React.FC<AgentPromptEditorProps> = ({
    isOpen, onClose, value, onSave,
}) => {
    const bridge = useChatBridge();
    const [draft, setDraft] = useState(value);
    const [templates, setTemplates] = useState<PromptTemplate[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setDraft(value);
        setSearchQuery('');
        bridge.getTrpcClient().prompts.getTemplates.query()
            .then((list: any) => setTemplates(list || []))
            .catch(() => {});
    }, [isOpen, value, bridge]);

    const filtered = templates.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.content.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 20);

    const handleSave = () => { onSave(draft); onClose(); };

    return (
        <AgentEditorModal
            isOpen={isOpen}
            onClose={onClose}
            title="Prompt"
            width="max-w-[640px]"
            footer={
                <>
                    <button onClick={onClose} className="lg-btn hover:bg-[var(--mat-content-card-hover-bg)] px-4 py-2 rounded-xl text-[13px]">Cancel</button>
                    <button onClick={handleSave} className="lg-btn rounded-full bg-[var(--color-accent)] text-white border-transparent hover:bg-[var(--color-accent)]/90 px-6 py-2 text-[13px]">Save</button>
                </>
            }
        >
            <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-tertiary)]">
                <span aria-hidden="true" className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--mat-border)] text-[10px] leading-none">i</span>
                <span>System prompt for this agent. Select a template or write custom.</span>
            </div>

            <div className="text-[12px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Current</div>
            <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="w-full h-[160px] overflow-y-auto bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] rounded-lg px-2.5 py-2 text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
                placeholder="System prompt for this agent..."
            />
            <div className="text-[12px] text-[var(--color-text-tertiary)]">{draft.length} chars · Undo: ⌘Z / Ctrl+Z</div>

            <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] uppercase tracking-wide text-[var(--color-text-tertiary)]">Templates</div>
                <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search templates..."
                    className="w-[200px] bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] rounded-lg px-2.5 py-1.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
                />
            </div>
            <div className="rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2">
                <div className="max-h-[90px] overflow-y-auto space-y-0.5 pr-0.5 custom-scrollbar">
                    {filtered.length === 0 ? (
                        <div className="text-[13px] text-[var(--color-text-tertiary)] px-1 py-0.5">No templates found</div>
                    ) : filtered.map(t => (
                        <button key={t.id} type="button" onClick={() => setDraft(t.content)}
                            className="w-full text-left text-[13px] px-2 py-1.5 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-bg)] transition-colors">
                            {t.name}
                        </button>
                    ))}
                </div>
            </div>
        </AgentEditorModal>
    );
};
