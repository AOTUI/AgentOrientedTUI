/**
 * TuiDesktopViewer Component — macOS 26 Liquid Glass redesign
 *
 * Shows only: Current App switcher + Views per app.
 * Layout mirrors ChatArea: content starts below the context pill (pt-[78px])
 * and scrolls under it, preserving the floating-glass feel.
 *
 * @module system-chat/gui/components/TuiDesktopViewer
 */
import { useEffect, useMemo, useState } from 'react';
import { parseTuiSnapshot } from './TuiParser.js';
import { ApplicationBlock } from './ApplicationBlock.js';

interface TuiDesktopViewerProps {
    snapshot: string;
    agentThinking?: string;
}

export function TuiDesktopViewer({ snapshot, agentThinking }: TuiDesktopViewerProps) {
    const parsed = useMemo(() => parseTuiSnapshot(snapshot), [snapshot]);
    const applications = parsed.desktop?.applications ?? [];
    const [activeAppId, setActiveAppId] = useState<string | null>(null);

    useEffect(() => {
        if (applications.length === 0) { setActiveAppId(null); return; }
        const stillExists = activeAppId && applications.some(app => app.id === activeAppId);
        if (stillExists) return;
        const defaultApp = applications.find(app => app.id === 'app_0') ?? applications[0];
        setActiveAppId(defaultApp.id);
    }, [applications, activeAppId]);

    /* ── Empty / error state ── */
    if (!parsed.desktop) {
        return (
            <div className="absolute inset-0 overflow-y-auto pt-[78px] px-6 pb-6 custom-scrollbar">
                <div className="flex flex-col items-center justify-center min-h-[200px]
                                text-[var(--color-text-tertiary)]">
                    <span className="text-3xl mb-3">📡</span>
                    <p className="text-[13px]">Waiting for TUI snapshot…</p>
                    {parsed.parseErrors.length > 0 && (
                        <pre className="mt-3 text-[11px] font-mono opacity-60 whitespace-pre-wrap max-w-md">
                            {parsed.parseErrors.join('\n')}
                        </pre>
                    )}
                </div>
            </div>
        );
    }

    const activeApp = applications.find(app => app.id === activeAppId) ?? null;

    return (
        /* Mirrors ChatArea layout: absolute inset-0 + pt-[78px] so first content clears
           the context pill, and the pill floats on top as content scrolls under it. */
        <div className="absolute inset-0 overflow-y-auto pt-[78px] px-6 pb-6
                        custom-scrollbar space-y-4">

            {/* ── App Switcher Row ── */}
            {applications.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold uppercase
                                     tracking-[0.06em] text-[var(--color-text-tertiary)] mr-1 shrink-0">
                        Current App
                    </span>
                    {applications.map(app => (
                        <button
                            key={app.id}
                            onClick={() => setActiveAppId(app.id)}
                            className={`
                                h-8 px-3.5 rounded-full text-[13px] font-medium
                                transition-all duration-200 select-none
                                active:scale-[0.97]
                                ${app.id === activeAppId
                                    ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/5'}
                            `}
                        >
                            {app.name}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Active App Content ── */}
            {activeApp ? (
                <ApplicationBlock key={activeApp.id} app={activeApp} />
            ) : (
                <div className="text-[13px] text-[var(--color-text-tertiary)] py-4">
                    No applications found.
                </div>
            )}

            {/* ── Agent Thinking (floating badge, bottom-right) ── */}
            {agentThinking && (
                <div className="fixed bottom-6 right-6 w-72 mat-lg-clear rounded-2xl
                                px-4 py-3
                                shadow-[0_8px_24px_var(--mat-shadow-color)] z-50">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                        <span className="text-[11px] font-semibold uppercase
                                         tracking-[0.05em] text-[var(--color-text-secondary)]">
                            Agent Thinking
                        </span>
                    </div>
                    <pre className="text-[11px] font-mono text-[var(--color-text-primary)]
                                    whitespace-pre-wrap max-h-36 overflow-y-auto">
                        {agentThinking}
                    </pre>
                </div>
            )}
        </div>
    );
}
