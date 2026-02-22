import React from 'react';
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { IconNewChat, IconSun, IconMoon, IconFolder, IconSettings } from './Icons.js';
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
    getTopicPaused
}: SidebarProps) {
    const getStateClass = (state: string, paused: boolean) => {
        if (paused) return 'text-warning';
        if (state === 'THINKING') return 'text-[var(--color-text-secondary)]';
        if (state === 'EXECUTING') return 'text-success';
        if (state === 'STOPPED') return 'text-danger';
        return 'text-[var(--color-text-tertiary)]';
    };

    const getDotClass = (state: string, paused: boolean) => {
        if (paused) return 'bg-warning';
        if (state === 'THINKING') return 'bg-secondary';
        if (state === 'EXECUTING') return 'bg-success';
        if (state === 'STOPPED') return 'bg-danger';
        return 'bg-[var(--color-text-tertiary)]';
    };

    return (
        <aside className={`
            absolute left-0 top-0 bottom-0 w-[260px] z-20
            mat-lg-regular flex flex-col overflow-hidden
            transition-transform duration-400 ease-[var(--ease-spring)]
            rounded-r-[16px] border-r border-[var(--mat-border)]
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
            {/* Sidebar Header */}
            <div className="px-6 pb-6 pt-10 flex flex-col gap-6 shrink-0 relative">
                <Button
                    className="w-full h-10 font-medium bg-[var(--mat-lg-clear-bg)] text-[var(--color-accent)] border border-[var(--mat-border)] hover:bg-[var(--mat-lg-regular-bg)] hover:border-[var(--mat-border-highlight)] transition-all flex items-center justify-center gap-2 group rounded-lg"
                    onClick={onNewChat}
                >
                    <IconNewChat />
                    <span>New Session</span>
                </Button>
            </div>

            <div className="px-6 pb-2 flex items-center justify-between text-[12px] font-medium text-[var(--color-text-secondary)] shrink-0">
                <span>Sessions</span>
                <span className="opacity-50">{topics.length} Active</span>
            </div>

            {/* Topic List */}
            <ScrollShadow className="flex-1 w-full px-4 pb-6 overflow-y-auto scrollbar-hide">
                <div className="space-y-2">
                    {topics.map(topic => {
                        const isActive = topic.id === activeTopicId;
                        const paused = getTopicPaused?.(topic.id) ?? false;
                        const state = getTopicState(topic.id);
                        const stateLabel = paused ? 'Paused' : (state ? state.charAt(0) + state.slice(1).toLowerCase() : 'Idle');
                        return (
                            <div
                                key={topic.id}
                                onClick={() => onSelectTopic(topic.id)}
                                className={`
                                    group flex items-center gap-3 w-full p-3 rounded-xl cursor-pointer 
                                    transition-all duration-300 border backdrop-blur-md
                                    ${isActive
                                        ? 'bg-[var(--mat-lg-clear-bg)] border-[var(--mat-border-highlight)] shadow-[0_4px_12px_rgba(0,0,0,0.1)] translate-x-1'
                                        : 'bg-[var(--color-bg-highlight)]/30 border-transparent hover:bg-[var(--color-bg-highlight)] hover:border-[var(--color-border)] hover:translate-x-1'}
                                `}
                            >
                                <div className="flex-1 min-w-0 flex flex-col gap-1">
                                    <span className={`
                                        truncate text-[13px] font-medium transition-colors
                                        ${isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'}
                                    `}>
                                        {topic.title}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-system text-[var(--color-text-tertiary)]">
                                            {formatTimeAgo(topic.updatedAt)}
                                        </span>
                                        <span className={`text-[10px] font-medium tracking-[0.05em] ${getStateClass(state, paused)}`}>
                                            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${getDotClass(state, paused)}`} />
                                            {stateLabel}
                                        </span>
                                        {isActive && <span className="text-[9px] text-[var(--color-accent)]">●</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollShadow>

            {/* Sidebar Footer - Navigation & Settings */}
            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-surface)]/50 flex items-center justify-between">
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
