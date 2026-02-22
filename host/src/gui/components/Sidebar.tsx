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
            relative h-full z-20 shrink-0
            mat-lg-regular flex flex-col overflow-hidden
            transition-all duration-400 ease-[var(--ease-spring)]
            rounded-[14px] border border-[var(--mat-border)] shadow-lg
            ${sidebarOpen ? 'w-[272px] opacity-100 mr-2' : 'w-0 opacity-0 mr-0 border-none'}
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

            {/* Topic List */}
            <ScrollShadow className="flex-1 w-[272px] px-3 pb-6 overflow-y-auto scrollbar-hide">
                <div className="space-y-1">
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
                                    group flex items-center justify-between gap-2 w-full px-3 py-2 rounded-xl cursor-pointer 
                                    transition-all duration-300 border
                                    ${isActive
                                        ? 'bg-[var(--mat-content-card-hover-bg)] border-[var(--mat-border-highlight)] shadow-sm'
                                        : 'bg-transparent border-transparent hover:bg-[var(--mat-content-card-hover-bg)] hover:border-[var(--mat-border)]'}
                                `}
                            >
                                <span className={`
                                    flex-1 truncate text-[13px] font-medium transition-colors
                                    ${isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'}
                                `}>
                                    {topic.title}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`inline-block w-2 h-2 rounded-full ${getDotClass(state, paused)}`} title={stateLabel} />
                                </div>
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
