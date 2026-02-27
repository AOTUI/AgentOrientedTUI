/**
 * AgentCard — Narrow card for 3-column grid layout
 *
 * macOS 26 Content Layer. Vertical stack: avatar+name header,
 * prompt preview (4 lines), tag row (Model / Apps / Skills / MCP),
 * and a text activate/deactivate button at the bottom.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { IconBrain, IconApps, IconSkills, IconPlug, IconAgentIdle, IconAgentWorking, IconAgentSleeping, IconAgentPaused } from '../../Icons.js';
import type { AgentConfig } from './AgentTab.js';

/* ─── Carousel config ──────────────────────────────────────────────────── */

const STATE_ICONS: { key: keyof AgentConfig['skin']; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { key: 'idle',     label: 'Idle',     Icon: IconAgentIdle },
    { key: 'working',  label: 'Working',  Icon: IconAgentWorking },
    { key: 'sleeping', label: 'Sleeping', Icon: IconAgentSleeping },
    { key: 'pause',    label: 'Paused',   Icon: IconAgentPaused },
];

const CAROUSEL_MS = 2800;

/* ─── Toolchain tag (shared by Model / Apps / Skills / MCP) ────────────── */

const Tag: React.FC<{ icon: React.ReactNode; text: string; onClick: () => void }> = ({ icon, text, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center justify-center gap-1 h-6 rounded-md text-[12px] leading-none
                   text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]
                   hover:bg-[var(--color-bg-highlight)]/60 transition-colors"
    >
        <span className="flex-shrink-0 opacity-60">{icon}</span>
        <span className="font-medium truncate">{text}</span>
    </button>
);

/* ─── Main AgentCard ───────────────────────────────────────────────────── */

export interface AgentCardProps {
    agent: AgentConfig;
    isActive: boolean;
    projectPath?: string | null;
    onSetActive: () => void;
    onClearActive: () => void;
    onDelete: () => void;
    onEditName: (name: string) => void;
    onEditPrompt: () => void;
    onEditModel: () => void;
    onEditApps: () => void;
    onEditSkills: () => void;
    onEditMcp: () => void;
    onEditSkin: () => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({
    agent, isActive, projectPath,
    onSetActive, onClearActive, onDelete, onEditName,
    onEditPrompt, onEditModel, onEditApps, onEditSkills, onEditMcp, onEditSkin,
}) => {
    /* ── Inline name editing ── */
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(agent.name);
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => { setDraft(agent.name); }, [agent.name]);
    useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

    const commit = useCallback(() => {
        const t = draft.trim();
        if (t && t !== agent.name) onEditName(t);
        else setDraft(agent.name);
        setEditing(false);
    }, [draft, agent.name, onEditName]);

    /* ── SVG Carousel ── */
    const [ci, setCi] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setCi(i => (i + 1) % STATE_ICONS.length), CAROUSEL_MS);
        return () => clearInterval(t);
    }, []);

    /* ── Derived ── */
    const modelLabel = useMemo(() => {
        if (!agent.modelId) return '';
        return agent.modelId.includes(':') ? agent.modelId.split(':').slice(1).join(':') : agent.modelId;
    }, [agent.modelId]);

    const skillCount = useMemo(() => {
        const globalCount = (agent.enabledSkills?.['__global__'] || []).length;
        if (!projectPath) return globalCount;
        const projectCount = (agent.enabledSkills?.[projectPath] || []).length;
        return globalCount + projectCount;
    }, [agent.enabledSkills, projectPath]);
    const appsCount = (agent.enabledApps || []).length;
    const mcpCount = (agent.enabledMCPs || []).length;

    return (
        <div
            className="group flex flex-col rounded-xl border border-[var(--mat-border)] bg-[var(--mat-content-card-bg)]
                        hover:bg-[var(--mat-content-card-hover-bg)] hover:border-[var(--mat-border-highlight)]
                        transition-colors duration-150 overflow-hidden"
        >
            {/* ── Header: avatar + name + delete ── */}
            <div className="flex items-center gap-2.5 px-3 pt-3 pb-1.5">
                {/* Avatar 28×28 squircle */}
                <button
                    type="button"
                    onClick={onEditSkin}
                    className="relative w-9 h-9 rounded-lg flex-shrink-0 overflow-hidden
                               bg-[var(--color-bg-highlight)]/50 border border-[var(--mat-border)]
                               hover:border-[var(--mat-border-highlight)] transition-colors"
                    title={`Edit skin — ${STATE_ICONS[ci].label}`}
                >
                    {STATE_ICONS.map((s, i) => {
                        const svg = agent.skin?.[s.key]?.trim();
                        return (
                            <div key={s.key} className="absolute inset-0 flex items-center justify-center transition-opacity duration-500" style={{ opacity: i === ci ? 1 : 0 }}>
                                {svg
                                    ? <div className="w-5 h-5" dangerouslySetInnerHTML={{ __html: svg }} />
                                    : <s.Icon className="w-5 h-5 text-[var(--color-text-tertiary)]" />}
                            </div>
                        );
                    })}
                </button>

                {/* Name + active dot + model tag */}
                <div className="flex-1 min-w-0 flex items-center gap-1">
                    {editing ? (
                        <input
                            ref={inputRef}
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            onBlur={commit}
                            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(agent.name); setEditing(false); } }}
                            className="flex-1 min-w-0 text-[14px] font-semibold bg-transparent outline-none
                                       text-[var(--color-text-primary)] border-b border-[var(--color-text-tertiary)]/40 pb-px"
                        />
                    ) : (
                        <button type="button" onClick={() => setEditing(true)} className="min-w-0 text-left flex-shrink-1">
                            <span className="text-[14px] font-semibold text-[var(--color-text-primary)] truncate block leading-tight
                                             hover:text-[var(--color-text-secondary)] transition-colors">
                                {agent.name || 'Unnamed'}
                            </span>
                        </button>
                    )}
                    {isActive && (
                        <span className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-400" title="Active" />
                    )}
                    {/* Model tag — inline next to name */}
                    <button
                        type="button"
                        onClick={onEditModel}
                        className="flex-shrink-0 inline-flex items-center gap-1 h-[22px] px-1.5 rounded
                                   text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]
                                   hover:bg-[var(--color-bg-highlight)]/60 transition-colors max-w-[180px] ml-auto"
                    >
                        <IconBrain className="w-3 h-3 flex-shrink-0 opacity-60" />
                        <span className="text-[11px] font-medium truncate">
                            {modelLabel || 'Model'}
                        </span>
                    </button>
                </div>

            </div>

            {/* ── Prompt preview (up to 5 lines) ── */}
            <button type="button" onClick={onEditPrompt} className="block w-full text-left px-3 pt-2 pb-3">
                {agent.prompt ? (
                    <p className="text-[13px] leading-[18px] text-[var(--color-text-tertiary)] line-clamp-5
                                  hover:text-[var(--color-text-secondary)] transition-colors">
                        {agent.prompt}
                    </p>
                ) : (
                    <span className="text-[13px] text-[var(--color-text-tertiary)]/40 italic hover:text-[var(--color-text-tertiary)] transition-colors">
                        Add prompt…
                    </span>
                )}
            </button>

            {/* ── Tags: Apps / Skills / MCP (equal-width) ── */}
            <div className="grid grid-cols-3 gap-1.5 px-3 pb-2.5">
                <Tag icon={<IconApps className="w-3.5 h-3.5" />} text={appsCount > 0 ? `${appsCount} Apps` : 'Apps'} onClick={onEditApps} />
                <Tag icon={<IconSkills className="w-3.5 h-3.5" />} text={skillCount > 0 ? `${skillCount} Skills` : 'Skills'} onClick={onEditSkills} />
                <Tag icon={<IconPlug className="w-3.5 h-3.5" />} text={mcpCount > 0 ? `${mcpCount} MCP` : 'MCP'} onClick={onEditMcp} />
            </div>

            {/* ── Footer: Activate/Deactivate + Delete ── */}
            <div className="border-t border-[var(--mat-border)] flex items-center">
                <button
                    type="button"
                    onClick={isActive ? onClearActive : onSetActive}
                    className={`flex-1 text-center text-[12px] font-medium py-2 transition-colors
                        ${isActive
                            ? 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-highlight)]/50'
                            : 'text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10'}`}
                >
                    {isActive ? 'Deactivate' : 'Activate'}
                </button>
                <div className="w-px h-3.5 bg-[var(--mat-border)]" />
                <button
                    type="button"
                    onClick={onDelete}
                    className="px-3.5 py-2 text-[12px] font-medium text-[var(--color-text-tertiary)]
                               hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
                >
                    Delete
                </button>
            </div>
        </div>
    );
};
