import React from 'react';
import { IconMenu } from './Icons.js';
import type { Topic } from '../../types.js';

interface WorkspaceHeaderProps {
    activeTopic: Topic | null;
    connected: boolean;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    viewMode: 'chat' | 'tui';
    setViewMode: (mode: 'chat' | 'tui') => void;
}

export function WorkspaceHeader({
    activeTopic,
    connected,
    sidebarOpen,
    setSidebarOpen,
    viewMode,
    setViewMode,
}: WorkspaceHeaderProps) {
    return (
        <header className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
            <div className="flex items-center justify-between px-3 pt-2">

                {/* ── Left Island: Context Pill (Hamburger + Divider + Title) ── */}
                <div
                    data-testid="header-left-island"
                    className={`
                        pointer-events-auto flex items-center h-10
                        mat-lg-regular rounded-full shadow-sm
                        transition-all duration-300 ease-[var(--ease-standard)]
                        ${sidebarOpen ? 'ml-0 -translate-x-2' : 'ml-[80px] translate-x-0'}
                    `}
                >
                    {/* Hamburger */}
                    <button
                        data-testid="hamburger-btn"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="w-10 h-10 flex items-center justify-center rounded-full
                                   text-[var(--color-text-secondary)]
                                   hover:text-[var(--color-text-primary)]
                                   hover:bg-white/5 transition-all
                                   active:scale-95 motion-reduce:active:scale-100"
                        aria-label="Toggle Sidebar"
                    >
                        <IconMenu />
                    </button>

                    {/* Vertical separator */}
                    <span className="w-px h-4 bg-white/10 shrink-0" />

                    {/* Connection dot + Title */}
                    <div className="flex items-center gap-2 px-3">
                        <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                                connected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'
                            }`}
                        />
                        <span className="text-[15px] font-semibold text-[var(--color-text-primary)] max-w-[200px] truncate leading-none tracking-tight">
                            {activeTopic?.title || 'System Chat'}
                        </span>
                    </div>
                </div>

                {/* ── Right Island: Mode Pill (Chat / TUI View) with spring slider ── */}
                {activeTopic && (
                    <div className="
                        pointer-events-auto relative flex items-center
                        h-10 p-1 rounded-full mat-lg-regular shadow-sm mr-0 translate-x-1
                    ">
                        {/* Spring-animated background slider */}
                        <span
                            className="absolute top-1 bottom-1 rounded-full
                                       bg-white/15 border border-white/10
                                       transition-all duration-300
                                       ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                            style={{
                                left: viewMode === 'chat' ? '4px' : 'calc(50% + 2px)',
                                width: 'calc(50% - 6px)',
                            }}
                        />
                        {(['chat', 'tui'] as const).map((mode) => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`
                                    relative z-10 h-8 px-5 rounded-full
                                    text-[12px] font-bold uppercase tracking-[0.05em]
                                    transition-colors duration-200 select-none
                                    ${viewMode === mode
                                        ? 'text-[var(--color-text-primary)]'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}
                                `}
                            >
                                {mode === 'chat' ? 'Chat' : 'TUI View'}
                            </button>
                        ))}
                    </div>
                )}

            </div>
        </header>
    );
}
