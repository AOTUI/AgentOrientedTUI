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
    getTopicPaused,
}: SidebarProps) {
    const getDotClass = (state: string, paused: boolean) => {
        if (paused) return 'bg-[var(--color-warning)]';
        if (state === 'THINKING') return 'bg-[var(--color-accent)]';
        if (state === 'EXECUTING') return 'bg-[var(--color-success)]';
        if (state === 'STOPPED') return 'bg-[var(--color-danger)]';
        return 'bg-[var(--color-text-tertiary)]';
    };

    const sortedTopics = [...topics].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

    return (
        <aside className={`
            relative z-20 shrink-0 self-stretch
            mat-lg-regular flex flex-col overflow-hidden
            transition-all duration-400 ease-[var(--ease-spring)] motion-reduce:transition-none
            rounded-[18px]
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

            {/* Sessions Label */}
            <div className="px-5 pb-2 shrink-0 w-[272px]">
                <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">Sessions</span>
            </div>

            <ScrollShadow className="flex-1 w-[272px] px-3 pb-6 overflow-y-auto scrollbar-hide">
                <div className="space-y-1">
                    {sortedTopics.map(topic => {
                        const isActive = topic.id === activeTopicId;
                        const paused = getTopicPaused?.(topic.id) ?? false;
                        const state = getTopicState(topic.id);
                        const timeAgo = formatTimeAgo(topic.updatedAt ?? topic.createdAt);
                        return (
                            <div
                                key={topic.id}
                                className={`
                                    relative w-full h-11 px-3 rounded-[10px] cursor-pointer
                                    flex flex-col justify-center
                                    transition-colors duration-200
                                    ${isActive ? 'bg-[var(--mat-content-card-hover-bg)]' : ''}
                                `}
                                onClick={() => onSelectTopic(topic.id)}
                            >
                                {/* Title */}
                                <span className={`truncate text-[13px] font-medium ${
                                    isActive
                                        ? 'text-[var(--color-text-primary)]'
                                        : 'text-[var(--color-text-secondary)]'
                                }`}>
                                    {topic.title}
                                </span>

                                {/* Status dot + time ago */}
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${getDotClass(state, paused)}`} />
                                    {timeAgo && (
                                        <span className="text-[11px] text-[var(--color-text-tertiary)]">{timeAgo}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollShadow>

            {/* Sidebar Footer */}
            <div className="p-3 border-t border-[var(--mat-border)] flex items-center justify-between w-[272px]">
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
