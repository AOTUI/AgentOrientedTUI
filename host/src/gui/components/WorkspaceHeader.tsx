import React from 'react';
import { IconMenu, IconEllipsis, IconPencil, IconDelete, IconChat, IconTerminal } from './Icons.js';
import type { Topic } from '../../types.js';

interface WorkspaceHeaderProps {
    activeTopic: Topic | null;
    emptyTitle?: string;
    connected: boolean;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    viewMode: 'chat' | 'tui';
    setViewMode: (mode: 'chat' | 'tui') => void;
    onDeleteActiveTopic?: () => void;
    onRenameActiveTopic?: (newTitle: string) => void;
}

export function WorkspaceHeader({
    activeTopic,
    emptyTitle = 'System Chat',
    connected,
    sidebarOpen,
    setSidebarOpen,
    viewMode,
    setViewMode,
    onDeleteActiveTopic,
    onRenameActiveTopic,
}: WorkspaceHeaderProps) {
    const [menuOpen, setMenuOpen] = React.useState(false);
    const [isRenaming, setIsRenaming] = React.useState(false);
    const [renameValue, setRenameValue] = React.useState('');
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleRenameStart = () => {
        setRenameValue(activeTopic?.title ?? '');
        setIsRenaming(true);
        setMenuOpen(false);
    };

    const handleRenameCommit = () => {
        const trimmed = renameValue.trim();
        if (trimmed && onRenameActiveTopic) onRenameActiveTopic(trimmed);
        setIsRenaming(false);
    };

    return (
        <header className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
            <div className="flex items-center justify-between px-3 pt-2">

                {/* ── Left Island: Context Pill (Hamburger | Dot + Title | Ellipsis) ── */}
                <div
                    data-testid="header-left-island"
                    ref={menuRef}
                    className={`
                        pointer-events-auto relative flex items-center h-10 w-[420px] max-w-[420px] shrink-0
                        mat-lg-clear rounded-full px-1
                        transition-all duration-300 ease-[var(--ease-standard)]
                        ${sidebarOpen ? 'ml-0 -translate-x-2' : 'ml-[80px] translate-x-0'}
                    `}
                >
                    {/* Hamburger */}
                    <button
                        data-testid="hamburger-btn"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="w-8 h-8 flex items-center justify-center rounded-full shrink-0
                                   text-[var(--color-text-secondary)]
                                   hover:text-[var(--color-text-primary)]
                                   hover:bg-white/5 transition-all
                                   active:scale-[0.97] motion-reduce:active:scale-100"
                        aria-label="Toggle Sidebar"
                    >
                        <IconMenu />
                    </button>

                    {/* Status dot */}
                    <span className={`w-2 h-2 rounded-full shrink-0 ml-3 ${
                        connected ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]'
                    }`} />

                    {/* Title or rename input */}
                    {isRenaming ? (
                        <input
                            autoFocus
                            data-testid="rename-input"
                            className="text-[13px] font-medium bg-transparent border-none outline-none
                                       text-[var(--color-text-primary)] tracking-tight
                                       flex-1 min-w-0 ml-2 mr-1"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { handleRenameCommit(); e.stopPropagation(); }
                                if (e.key === 'Escape') { setIsRenaming(false); e.stopPropagation(); }
                            }}
                            onBlur={handleRenameCommit}
                        />
                    ) : (
                        <span className="text-[13px] font-medium text-[var(--color-text-primary)]
                                         flex-1 min-w-0 truncate leading-none tracking-tight ml-2 mr-1">
                            {activeTopic?.title || emptyTitle}
                        </span>
                    )}

                    {/* Ellipsis — only when a topic exists and not renaming */}
                    {activeTopic && !isRenaming && (
                        <div className="relative mr-1 shrink-0">
                            <button
                                data-testid="topic-more-btn"
                                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                                className="w-8 h-8 rounded-full flex items-center justify-center
                                           text-[var(--color-text-tertiary)]
                                           hover:text-[var(--color-text-primary)]
                                           hover:bg-white/5 transition-all
                                           active:scale-[0.97]"
                                aria-label="Topic options"
                            >
                                <IconEllipsis />
                            </button>
                            {menuOpen && (
                                <div
                                    className="absolute top-full right-0 mt-2 z-50 min-w-[160px]
                                               mat-lg-regular rounded-xl overflow-hidden
                                               shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {onRenameActiveTopic && (
                                        <button
                                            className="w-full flex items-center gap-2.5 px-3 py-2.5
                                                       text-[13px] text-[var(--color-text-secondary)]
                                                       hover:bg-[var(--mat-content-card-hover-bg)]
                                                       hover:text-[var(--color-text-primary)] transition-colors"
                                            onClick={handleRenameStart}
                                        >
                                            <IconPencil />
                                            <span>Rename</span>
                                        </button>
                                    )}
                                    {onDeleteActiveTopic && (
                                        <button
                                            className="w-full flex items-center gap-2.5 px-3 py-2.5
                                                       text-[13px] text-[var(--color-danger)]
                                                       hover:bg-[var(--color-danger)]/10 transition-colors"
                                            onClick={() => { onDeleteActiveTopic(); setMenuOpen(false); }}
                                        >
                                            <IconDelete />
                                            <span>Delete</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Right Island: Mode Pill (Chat / TUI) with icons ── */}
                {activeTopic && (
                    <div className="
                        pointer-events-auto relative flex items-center
                        h-10 p-1 rounded-full mat-lg-clear mr-0 translate-x-1
                    ">
                        {/* Spring-animated background slider */}
                        <span
                            className="absolute top-1 bottom-1 rounded-full
                                       bg-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.1)]
                                       transition-all duration-300
                                       ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                            style={{
                                left: viewMode === 'chat' ? '4px' : 'calc(50% + 2px)',
                                width: 'calc(50% - 6px)',
                            }}
                        />
                        <button
                            onClick={() => setViewMode('chat')}
                            aria-label="Chat view"
                            className={`
                                relative z-10 h-8 w-10 rounded-full
                                flex items-center justify-center
                                transition-colors duration-200 select-none
                                active:scale-[0.97]
                                ${viewMode === 'chat'
                                    ? 'text-[var(--color-accent)]'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/5'}
                            `}
                        >
                            <IconChat />
                        </button>
                        <button
                            onClick={() => setViewMode('tui')}
                            aria-label="TUI view"
                            className={`
                                relative z-10 h-8 w-10 rounded-full
                                flex items-center justify-center
                                transition-colors duration-200 select-none
                                active:scale-[0.97]
                                ${viewMode === 'tui'
                                    ? 'text-[var(--color-accent)]'
                                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/5'}
                            `}
                        >
                            <IconTerminal />
                        </button>
                    </div>
                )}

            </div>
        </header>
    );
}
