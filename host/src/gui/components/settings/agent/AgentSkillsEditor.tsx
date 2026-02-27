/**
 * AgentSkillsEditor — Toggle-switch editor for Agent skills
 *
 * UI mirrors ChatArea Skills popover: group toggle, Global/Project sections, per-item toggles
 */
import React, { useEffect, useState } from 'react';
import { AgentEditorModal } from './AgentEditorModal.js';
import { useChatBridge } from '../../../ChatBridge.js';

interface SkillEntry { name: string; description?: string; scope?: string; }

export interface AgentSkillsEditorProps {
    isOpen: boolean;
    onClose: () => void;
    value: Record<string, string[]>;
    onSave: (enabledSkills: Record<string, string[]>) => void;
    currentProjectPath?: string | null;
}

const GLOBAL_KEY = '__global__';

export const AgentSkillsEditor: React.FC<AgentSkillsEditorProps> = ({
    isOpen, onClose, value, onSave, currentProjectPath,
}) => {
    const bridge = useChatBridge();
    const [draft, setDraft] = useState<Record<string, Set<string>>>({});
    const [globalSkills, setGlobalSkills] = useState<SkillEntry[]>([]);
    const [projectSkills, setProjectSkills] = useState<SkillEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        const initial: Record<string, Set<string>> = {};
        for (const [key, names] of Object.entries(value)) initial[key] = new Set(names);
        setDraft(initial);

        (async () => {
            setLoading(true);
            try {
                const globalRes = await bridge.getTrpcClient().skills.getRuntime.query({});
                const gs = ((globalRes as any)?.skills || []) as SkillEntry[];
                let ps: SkillEntry[] = [];
                if (currentProjectPath) {
                    const projRes = await bridge.getTrpcClient().skills.getRuntime.query({ projectPath: currentProjectPath });
                    ps = ((projRes as any)?.skills || []).filter((s: any) => s.scope === 'project');
                }
                setGlobalSkills(gs.filter(s => s.scope !== 'project'));
                setProjectSkills(ps);
            } catch { /* skip */ }
            finally { setLoading(false); }
        })();
    }, [isOpen, value, bridge, currentProjectPath]);

    const toggle = (groupKey: string, skillName: string) => {
        setDraft(prev => {
            const next = { ...prev };
            const set = new Set(next[groupKey] || []);
            set.has(skillName) ? set.delete(skillName) : set.add(skillName);
            if (set.size > 0) next[groupKey] = set; else delete next[groupKey];
            return next;
        });
    };

    const handleSave = () => {
        const result: Record<string, string[]> = {};
        for (const [key, set] of Object.entries(draft)) if (set.size > 0) result[key] = Array.from(set);
        onSave(result);
        onClose();
    };

    const allNames = [...globalSkills.map(s => s.name), ...projectSkills.map(s => s.name)];
    const anyEnabled = Object.values(draft).some(set => set.size > 0);
    const toggleAll = (v: boolean) => {
        if (v) {
            const next: Record<string, Set<string>> = {};
            if (globalSkills.length > 0) next[GLOBAL_KEY] = new Set(globalSkills.map(s => s.name));
            if (currentProjectPath && projectSkills.length > 0) next[currentProjectPath] = new Set(projectSkills.map(s => s.name));
            setDraft(next);
        } else {
            setDraft({});
        }
    };

    const renderToggle = (checked: boolean, onChange: (v: boolean) => void, disabled = false) => (
        <button type="button" role="switch" aria-checked={checked} disabled={disabled}
            onClick={e => { e.preventDefault(); e.stopPropagation(); onChange(!checked); }}
            className={`relative inline-flex items-center shrink-0 rounded-full transition-colors duration-200 w-8 h-[18px]
                ${checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--mat-border)]'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
            <span className={`inline-block rounded-full bg-white shadow transition-transform duration-200 w-3.5 h-3.5 translate-x-0.5 ${checked ? 'translate-x-3' : ''}`} />
        </button>
    );

    const renderSkillList = (items: SkillEntry[], groupKey: string) => (
        <div className="rounded-xl bg-[var(--mat-content-card-hover-bg)] p-2 space-y-1">
            {items.map(s => (
                <label key={`skill-${s.name}`} className="flex items-center justify-between gap-2 text-[13px] text-[var(--color-text-secondary)]">
                    <span className="truncate">{s.name}</span>
                    {renderToggle(draft[groupKey]?.has(s.name) || false, () => toggle(groupKey, s.name))}
                </label>
            ))}
        </div>
    );

    return (
        <AgentEditorModal
            isOpen={isOpen}
            onClose={onClose}
            title="Skills"
            width="max-w-[560px]"
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
                    <span>Enable Skills for this agent.</span>
                </div>
                {renderToggle(anyEnabled, toggleAll)}
            </div>
            {loading ? (
                <div className="py-6 text-center text-[14px] text-[var(--color-text-tertiary)]">Loading skills...</div>
            ) : globalSkills.length === 0 && projectSkills.length === 0 ? (
                <div className="text-[13px] text-[var(--color-text-tertiary)]">No skills available</div>
            ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto custom-scrollbar">
                    {globalSkills.length > 0 && (
                        <div>
                            <div className="text-[12px] uppercase tracking-wide text-[var(--color-text-tertiary)] mb-1">Global</div>
                            {renderSkillList(globalSkills, GLOBAL_KEY)}
                        </div>
                    )}
                    {projectSkills.length > 0 && currentProjectPath && (
                        <div>
                            <div className="text-[12px] uppercase tracking-wide text-[var(--color-text-tertiary)] mb-1">
                                Project <span className="normal-case">{currentProjectPath.split('/').pop()}</span>
                            </div>
                            {renderSkillList(projectSkills, currentProjectPath)}
                        </div>
                    )}
                </div>
            )}
        </AgentEditorModal>
    );
};
