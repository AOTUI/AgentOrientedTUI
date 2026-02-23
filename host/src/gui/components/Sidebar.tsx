import React from 'react';
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { IconNewChat, IconSun, IconMoon, IconFolder, IconSettings, IconEllipsis, IconPin, IconPencil, IconDelete } from './Icons.js';
import type { Topic } from '../../types.js';

interface SidebarProps {
    sidebarOpen: boolean;
    topics: Topic[];
    activeTopicId: string | null;
    theme: 'dark' | 'light';
    onNewChat: () => void;
    onSelectTopic: (topicId: string) => void;
    toggleTheme: () => void;
    onSwitchProject: () => void;
    onOpenSettings?: () => void;
    getTopicState: (topicId: string) => string;
    getTopicPaused?: (topicId: string) => boolean;
    onDeleteTopic?: (topicId: string) => void;
    onRenameTopic?: (topicId: string, newTitle: string) => void;
}

function formatTimeAgo(timestamp: number) {
    if (!timestamp) return '';
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
}

export function Sidebar({
    sidebarOpen,
    topics,
    activeTopicId,
    theme,
    onNewChat,
    onSelectTopic,
    toggleTheme,
    onSwitchProject,
    onOpenSettings,
    getTopicState,
    getTopicPaused,
    onDeleteTopic,
    onRenameTopic,
}: SidebarProps) {
    const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);
    const [renamingId, setRenamingId] = React.useState<string | null>(null);
    const [renameValue, setRenameValue] = React.useState('');
    const [pinnedIds, setPinnedIds] = React.useState<Set<string>>(new Set());
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handlePin = (topicId: string) => {
        setPinnedIds((prev) => {
            const next = new Set(prev);
            next.has(topicId) ? next.delete(topicId) : next.add(topicId);
            return next;
        });
        setOpenMenuId(null);
    };

    const handleRenameStart = (topic: Topic) => {
        setRenamingId(topic.id);
        setRenameValue(topic.title);
        setOpenMenuId(null);
    };

    const handleRenameCommit = (topicId: string) => {
        const trimmed = renameValue.trim();
        if (trimmed && onRenameTopic) {
            onRenameTopic(topicId, trimmed);
        }
        setRenamingId(null);
    };

    const sortedTopics = [...topics].sort((a, b) => {
        const aPinned = pinnedIds.has(a.id) ? 0 : 1;
        const bPinned = pinnedIds.has(b.id) ? 0 : 1;
        if (aPinned !== bPinned) return aPinned - bPinned;
        return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });
    const getStateClass = (state: string, paused: boolean) => {
        if (paused) return 'text-[var(--color-warning)]';
        if (state === 'THINKING') return 'text-[var(--color-text-secondary)]';
        if (state === 'EXECUTING') return 'text-[var(--color-success)]';
        if (state === 'STOPPED') return 'text-[var(--color-danger)]';
        return 'text-[var(--color-text-tertiary)]';
    };

    const getDotClass = (state: string, paused: boolean) => {
        if (paused) return 'bg-[var(--color-warning)]';
        if (state === 'THINKING') return 'bg-[var(--color-accent)]';
        if (state === 'EXECUTING') return 'bg-[var(--color-success)]';
        if (state === 'STOPPED') return 'bg-[var(--color-danger)]';
        return 'bg-[var(--color-text-tertiary)]';
    };

    return (
        <aside className={`
            relative z-20 shrink-0 self-stretch
            mat-lg-regular flex flex-col overflow-hidden
            transition-all duration-400 ease-[var(--ease-spring)] motion-reduce:transition-none
            rounded-[14px] border border-[var(--mat-border)] shadow-lg
            ${sidebarOpen ? 'w-[272px] opacity-100 mt-2 ml-2 mb-2 mr-2' : 'w-0 opacity-0 mt-0 ml-0 mb-0 mr-0 border-none'}
        `}>
            {/* Sidebar Header */}
            <div className="px-4 pb-4 pt-10 flex flex-col gap-4 shrink-0 relative w-[272px]">
                <Button
                    className="w-full h-9 mt-2 font-medium bg-[var(--mat-lg-clear-bg)] text-[var(--color-accent)] border border-[var(--mat-border)] hover:bg-[var(--mat-lg-regular-bg)] hover:border-[var(--mat-border-highlight)] transition-all flex items-center justify-center gap-2 group rounded-xl shadow-sm"
                    onClick={onNewChat}
                >
                    <IconNewChat />
                    <span className="text-[13px]">New Session</span>
                </Button>
            </div>

            <div className="px-5 pb-2 flex items-center justify-between text-[12px] font-medium text-[var(--color-text-secondary)] shrink-0 w-[272px]">
                <span>Sessions</span>
                <span className="opacity-50">{topics.length} Active</span>
            </div>

            <ScrollShadow className="flex-1 w-[272px] px-3 pb-6 overflow-y-auto scrollbar-hide">
                <div className="space-y-1" ref={menuRef}>
                    {sortedTopics.map(topic => {
                        const isActive = topic.id === activeTopicId;
                        const paused = getTopicPaused?.(topic.id) ?? false;
                        const state = getTopicState(topic.id);
                        const isPinned = pinnedIds.has(topic.id);
                        const isRenaming = renamingId === topic.id;
                        const menuOpen = openMenuId === topic.id;
                        const timeAgo = formatTimeAgo(topic.updatedAt ?? topic.createdAt);
                        return (
                            <div
                                key={topic.id}
                                className={`
                                    group relative w-full h-11 px-3 rounded-xl cursor-pointer border
                                    flex flex-col justify-center
                                    transition-colors duration-200
                                    ${isActive
                                        ? 'bg-[var(--mat-content-card-hover-bg)] border-[var(--mat-border-highlight)] shadow-sm'
                                        : 'bg-transparent border-transparent hover:bg-[var(--mat-content-card-hover-bg)] hover:border-[var(--mat-border)]'}
                                `}
                                onClick={() => !isRenaming && onSelectTopic(topic.id)}
                            >
                                {/* Row 1: Title + more button */}
                                <div className="flex items-center justify-between gap-1">
                                    {isRenaming ? (
                                        <input
                                            autoFocus
                                            className="flex-1 text-[13px] font-medium bg-transparent border-none outline-none text-[var(--color-text-primary)]"
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleRenameCommit(topic.id);
                                                if (e.key === 'Escape') setRenamingId(null);
                                                e.stopPropagation();
                                            }}
                                            onBlur={() => handleRenameCommit(topic.id)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className={`flex-1 truncate text-[13px] font-medium transition-colors ${
                                            isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'
                                        }`}>
                                            {isPinned && <IconPin className="inline w-3 h-3 mr-1 opacity-50" />}
                                            {topic.title}
                                        </span>
                                    )}
                                    <button
                                        data-testid={`more-btn-${topic.id}`}
                                        className="opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0 w-6 h-6 rounded-full flex items-center justify-center hover:bg-[var(--mat-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-opacity duration-150"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenMenuId(menuOpen ? null : topic.id);
                                        }}
                                        aria-label="More options"
                                    >
                                        <IconEllipsis />
                                    </button>
                                </div>

                                {/* Row 2: State dot + time ago */}
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${getDotClass(state, paused)}`} />
                                    {timeAgo && (
                                        <span className="text-[11px] text-[var(--color-text-tertiary)]">{timeAgo}</span>
                                    )}
                                </div>

                                {/* Inline dropdown menu */}
                                {menuOpen && (
                                    <div
                                        className="absolute right-2 top-8 z-50 min-w-[140px] mat-lg-regular rounded-xl shadow-lg border border-[var(--mat-border)] overflow-hidden"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-hover-bg)] hover:text-[var(--color-text-primary)] transition-colors"
                                            onClick={() => handlePin(topic.id)}
                                        >
                                            <IconPin />
                                            <span>{isPinned ? 'Unpin' : 'Pin'}</span>
                                        </button>
                                        <button
                                            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--mat-content-card-hover-bg)] hover:text-[var(--color-text-primary)] transition-colors"
                                            onClick={() => handleRenameStart(topic)}
                                        >
                                            <IconPencil />
                                            <span>Rename</span>
                                        </button>
                                        {onDeleteTopic && (
                                            <button
                                                className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition-colors"
                                                onClick={() => { onDeleteTopic(topic.id); setOpenMenuId(null); }}
                                            >
                                                <IconDelete />
                                                <span>Delete</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </ScrollShadow>

            {/* Sidebar Footer - Navigation & Settings */}
            <div className="p-3 border-t border-[var(--mat-border)] bg-[var(--mat-lg-clear-bg)] flex items-center justify-between w-[272px]">
                 <Tooltip content="Switch Project">
                     <Button
                         variant="light"
                         size="sm"
                         onClick={onSwitchProject}
                         className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors data-[hover=true]:bg-white/5 flex items-center gap-2 px-2"
                     >
                         <IconFolder className="w-4 h-4" />
                         <span className="text-[12px] font-medium">Projects</span>
                     </Button>
                 </Tooltip>

                 <div className="flex items-center gap-1">
                     {onOpenSettings && (
                         <Tooltip content="Settings">
                             <Button
                                 isIconOnly
                                 variant="light"
                                 size="sm"
                                 onClick={onOpenSettings}
                                 className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors data-[hover=true]:bg-transparent flex items-center justify-center"
                             >
                                 <IconSettings />
                             </Button>
                         </Tooltip>
                     )}

                     <Tooltip content={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}>
                        <Button
                            isIconOnly
                            variant="light"
                            size="sm"
                            onClick={toggleTheme}
                            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors data-[hover=true]:bg-transparent flex items-center justify-center"
                        >
                            {theme === 'dark' ? <IconSun /> : <IconMoon />}
                        </Button>
                    </Tooltip>
                 </div>
            </div>
        </aside>
    );
}
