/**
 * AgentSkinEditor - Modal for editing custom Agent state SVGs
 * 
 * Users can provide custom SVG code for each agent state:
 * - Idle, Working, Sleeping, Pause
 * Each has a live preview with default animated icons shown when empty.
 */
import React, { useState, useEffect } from 'react';
import { AgentEditorModal } from './AgentEditorModal.js';
import { IconAgentIdle, IconAgentWorking, IconAgentSleeping, IconAgentPaused } from '../../Icons.js';

export interface AgentSkin {
    working?: string;
    idle?: string;
    sleeping?: string;
    pause?: string;
}

export interface AgentSkinEditorProps {
    isOpen: boolean;
    onClose: () => void;
    value: AgentSkin;
    onSave: (skin: AgentSkin) => void;
}

const STATES: { key: keyof AgentSkin; label: string; placeholder: string; Default: React.FC<{ className?: string }> }[] = [
    { key: 'idle', label: 'Idle', placeholder: 'Paste SVG to override idle state...', Default: IconAgentIdle },
    { key: 'working', label: 'Working', placeholder: 'Paste SVG to override working state...', Default: IconAgentWorking },
    { key: 'sleeping', label: 'Sleeping', placeholder: 'Paste SVG to override sleeping state...', Default: IconAgentSleeping },
    { key: 'pause', label: 'Pause', placeholder: 'Paste SVG to override paused state...', Default: IconAgentPaused },
];

export const AgentSkinEditor: React.FC<AgentSkinEditorProps> = ({
    isOpen,
    onClose,
    value,
    onSave,
}) => {
    const [draft, setDraft] = useState<AgentSkin>({ ...value });

    useEffect(() => {
        if (isOpen) {
            setDraft({ ...value });
        }
    }, [isOpen, value]);

    const handleSave = () => {
        // Clean empty strings to undefined
        const cleaned: AgentSkin = {};
        for (const key of ['idle', 'working', 'sleeping', 'pause'] as (keyof AgentSkin)[]) {
            const val = draft[key]?.trim();
            if (val) cleaned[key] = val;
        }
        onSave(cleaned);
        onClose();
    };

    return (
        <AgentEditorModal
            isOpen={isOpen}
            onClose={onClose}
            title="Agent Skin (SVG)"
            width="max-w-[680px]"
            footer={
                <>
                    <button
                        onClick={onClose}
                        className="lg-btn hover:bg-[var(--mat-content-card-hover-bg)] px-4 py-2 rounded-xl text-[13px]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="lg-btn rounded-full bg-[var(--color-accent)] text-white border-transparent hover:bg-[var(--color-accent)]/90 px-6 py-2 text-[13px]"
                    >
                        Save
                    </button>
                </>
            }
        >
            <p className="text-[12px] text-[var(--color-text-tertiary)]">
                Provide custom SVG code for each agent state. Leave empty to use the default animated icons.
            </p>

            <div className="grid grid-cols-2 gap-4">
                {STATES.map(({ key, label, placeholder, Default }) => (
                    <div key={key} className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">
                            {label}
                        </label>
                        {/* Preview */}
                        <div className="w-full h-[80px] rounded-xl border border-[var(--mat-border)] bg-[var(--mat-input-bg)] flex items-center justify-center overflow-hidden">
                            {draft[key]?.trim() ? (
                                <div
                                    className="w-[60px] h-[60px]"
                                    dangerouslySetInnerHTML={{ __html: draft[key]! }}
                                />
                            ) : (
                                <Default className="w-[60px] h-[60px] text-[var(--color-text-tertiary)]" />
                            )}
                        </div>
                        {/* Editor */}
                        <textarea
                            value={draft[key] || ''}
                            onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                            className="w-full h-[80px] px-2 py-1.5 rounded-lg bg-[var(--mat-input-bg)] border border-[var(--mat-border)] text-[11px] font-mono resize-none focus:outline-none focus:border-[var(--color-accent)] custom-scrollbar"
                            placeholder={placeholder}
                        />
                    </div>
                ))}
            </div>
        </AgentEditorModal>
    );
};
