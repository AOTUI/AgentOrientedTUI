/**
 * AgentAppsEditor — Toggle-switch editor for Agent apps
 *
 * UI mirrors ChatArea Apps popover: group toggle + per-item toggles
 */
import React, { useEffect, useState } from 'react';
import { AgentEditorModal } from './AgentEditorModal.js';
import { useChatBridge } from '../../../ChatBridge.js';

interface AppEntry { name: string; source?: string; }

export interface AgentAppsEditorProps {
    isOpen: boolean;
    onClose: () => void;
    value: string[];
    onSave: (enabledApps: string[]) => void;
}

export const AgentAppsEditor: React.FC<AgentAppsEditorProps> = ({
    isOpen, onClose, value, onSave,
}) => {
    const bridge = useChatBridge();
    const [draft, setDraft] = useState<Set<string>>(new Set(value));
    const [apps, setApps] = useState<AppEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        setDraft(new Set(value));
        (async () => {
            setLoading(true);
            try {
                const config = await bridge.getTrpcClient().apps.getConfig.query();
                const entries: AppEntry[] = Object.entries(config as Record<string, any>).map(
                    ([k, v]) => ({ name: v?.name || k, source: v?.source }),
                );
                entries.sort((a, b) => a.name.localeCompare(b.name));
                setApps(entries);
            } catch { /* skip */ }
            finally { setLoading(false); }
        })();
    }, [isOpen, value, bridge]);

    const toggle = (name: string) =>
        setDraft(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

    const handleSave = () => { onSave(Array.from(draft)); onClose(); };

    const anyEnabled = draft.size > 0;
    const toggleAll = (v: boolean) => setDraft(v ? new Set(apps.map(a => a.name)) : new Set());

    const renderToggle = (checked: boolean, onChange: (v: boolean) => void, disabled = false) => (
        <button type="button" role="switch" aria-checked={checked} disabled={disabled}
            onClick={e => { e.preventDefault(); e.stopPropagation(); onChange(!checked); }}
            className={`relative inline-flex items-center shrink-0 rounded-full transition-colors duration-200 w-8 h-[18px]
                ${checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--mat-border)]'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
            <span className={`inline-block rounded-full bg-white shadow transition-transform duration-200 w-3.5 h-3.5 translate-x-0.5 ${checked ? 'translate-x-3' : ''}`} />
        </button>
    );

    return (
        <AgentEditorModal
            isOpen={isOpen}
            onClose={onClose}
            title="Apps"
            footer={
                <>
                    <button onClick={onClose} className="lg-btn hover:bg-[var(--mat-content-card-hover-bg)] px-4 py-2 rounded-xl text-[13px]">Cancel</button>
                    <button onClick={handleSave} className="lg-btn rounded-full bg-[var(--color-accent)] text-white border-transparent hover:bg-[var(--color-accent)]/90 px-6 py-2 text-[13px]">Save</button>
                </>
            }
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-tertiary)]">
                    <span aria-hidden="true" className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--mat-border)] text-[10px] leading-none">i</span>
                    <span>Enable TUI Apps for this agent.</span>
                </div>
                {renderToggle(anyEnabled, toggleAll)}
            </div>
            {loading ? (
                <div className="py-6 text-center text-[14px] text-[var(--color-text-tertiary)]">Loading apps...</div>
            ) : apps.length === 0 ? (
                <div className="text-[13px] text-[var(--color-text-tertiary)]">No apps found</div>
            ) : (
                <div className="rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2 space-y-1">
                    {apps.map(app => (
                        <label key={`app-${app.name}`} className="flex items-center justify-between gap-2 text-[13px] text-[var(--color-text-secondary)]">
                            <span className="truncate">{app.name}</span>
                            {renderToggle(draft.has(app.name), () => toggle(app.name))}
                        </label>
                    ))}
                </div>
            )}
        </AgentEditorModal>
    );
};
