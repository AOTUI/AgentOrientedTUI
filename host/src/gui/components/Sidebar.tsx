import React, { useMemo, useState } from 'react';
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { IconNewChat, IconSun, IconMoon, IconFolder, IconSettings, IconChat } from './Icons.js';
import type { Topic } from '../../types.js';

interface SidebarProps {
    sidebarOpen: boolean;
    topics: Topic[];
    activeTopicId: string | null;
    showDraftCurrent?: boolean;
    currentProjectPath?: string | null;
    theme: 'dark' | 'light';
    onNewChat: () => void;
    onSelectTopic: (topicId: string) => void;
    toggleTheme: () => void;
    onSwitchProject: () => void;
    onOpenSettings?: (tab?: 'model' | 'prompt' | 'theme' | 'apps' | 'mcp' | 'skills') => void;
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
    showDraftCurrent = false,
    currentProjectPath,
    theme,
    onNewChat,
    onSelectTopic,
    toggleTheme,
    onSwitchProject,
    onOpenSettings,
}: SidebarProps) {
    const [recentExpanded, setRecentExpanded] = useState(false);
    const [otherExpanded, setOtherExpanded] = useState(false);

    const {
        currentTopic,
        recentTopics,
        otherTopics,
    } = useMemo(() => {
        const sortedTopics = [...topics].sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0));
        const current = sortedTopics.find((topic) => topic.id === activeTopicId) ?? null;
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        const remaining = sortedTopics.filter((topic) => topic.id !== activeTopicId);
        const recent = remaining.filter((topic) => (topic.updatedAt ?? topic.createdAt ?? 0) >= weekAgo);
        const other = remaining.filter((topic) => (topic.updatedAt ?? topic.createdAt ?? 0) < weekAgo);

        return {
            currentTopic: current,
            recentTopics: recent,
            otherTopics: other,
        };
    }, [topics, activeTopicId]);

    const visibleRecentTopics = recentExpanded ? recentTopics : recentTopics.slice(0, 3);
    const visibleOtherTopics = otherExpanded ? otherTopics : otherTopics.slice(0, 3);

    const recentMoreCount = Math.max(0, recentTopics.length - 3);
    const otherMoreCount = Math.max(0, otherTopics.length - 3);

    const renderTopicRow = (topic: Topic, isCurrent: boolean = false) => {
        const isActive = topic.id === activeTopicId;
        const timeAgo = formatTimeAgo(topic.updatedAt ?? topic.createdAt);

        return (
            <div
                key={topic.id}
                className={`
                    relative w-full h-8 px-2 rounded-[8px] cursor-pointer
                    flex items-center justify-between
                    transition-colors duration-200
                    ${isActive ? 'bg-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.1)]' : 'bg-transparent'}
                `}
                onClick={() => onSelectTopic(topic.id)}
            >
                <span className={`truncate text-[13px] font-medium ${
                    isActive
                        ? 'text-[var(--color-accent)]'
                        : 'text-[var(--color-text-secondary)]'
                }`}>
                    {topic.title}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                    {isCurrent ? (
                        <span className="text-[11px] text-[var(--color-accent)]">Current</span>
                    ) : (
                        timeAgo && (
                            <span className="text-[11px] text-[var(--color-text-tertiary)]">{timeAgo}</span>
                        )
                    )}
                </div>
            </div>
        );
    };

    return (
        <aside className={`
            relative z-20 shrink-0 self-stretch
            mat-lg-clear flex flex-col overflow-hidden
            transition-all duration-400 ease-[var(--ease-spring)] motion-reduce:transition-none
            rounded-[18px]
            ${sidebarOpen ? 'w-[260px] opacity-100 mt-2 ml-2 mb-2 mr-2' : 'w-0 opacity-0 m-0 border-none'}
        `}>
            {/* Sidebar Header */}
            <div className="px-3 pb-2 pt-10 shrink-0 w-[260px]">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                        <IconChat className="w-4 h-4" />
                        <span className="text-[12px] font-bold uppercase tracking-[0.02em]">Sessions</span>
                    </div>
                    <Button
                        className="h-7 min-w-0 px-2.5 font-medium bg-[var(--mat-lg-clear-bg)] text-[var(--color-accent)] border border-[var(--mat-border)] hover:bg-[var(--mat-lg-regular-bg)] hover:border-[var(--mat-border-highlight)] transition-all flex items-center justify-center gap-1.5 rounded-full"
                        onClick={onNewChat}
                    >
                        <IconNewChat className="w-3.5 h-3.5" />
                        <span className="text-[12px] leading-none">New</span>
                    </Button>
                </div>
            </div>

            <ScrollShadow className="flex-1 w-[260px] px-2 pb-6 overflow-y-auto scrollbar-hide">
                <div className="space-y-3">
                    {(currentTopic || showDraftCurrent) && (
                        <div>
                            <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.03em] text-[var(--color-text-tertiary)]">
                                Current
                            </div>
                            <div className="space-y-1">
                                {currentTopic ? (
                                    renderTopicRow(currentTopic, true)
                                ) : (
                                    <div
                                        className="relative w-full h-8 px-2 rounded-[8px] flex items-center justify-between bg-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
                                    >
                                        <span className="truncate text-[13px] font-medium text-[var(--color-accent)]">New Session</span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="text-[11px] text-[var(--color-accent)]">Current</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {recentTopics.length > 0 && (
                        <div>
                            <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.03em] text-[var(--color-text-tertiary)]">
                                Recent
                            </div>
                            <div
                                data-testid="recent-list"
                                className={`space-y-1 ${recentExpanded && recentTopics.length > 5 ? 'max-h-[11rem] overflow-y-auto pr-1' : ''}`}
                            >
                                {visibleRecentTopics.map((topic) => renderTopicRow(topic))}
                            </div>
                            {!recentExpanded && recentMoreCount > 0 && (
                                <button
                                    type="button"
                                    className="mt-1 px-2 text-[12px] text-[var(--color-accent)] hover:text-[var(--color-text-primary)] transition-colors"
                                    onClick={() => setRecentExpanded(true)}
                                >
                                    Show {recentMoreCount} More
                                </button>
                            )}
                        </div>
                    )}

                    {otherTopics.length > 0 && (
                        <div>
                            <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.03em] text-[var(--color-text-tertiary)]">
                                Other
                            </div>
                            <div
                                data-testid="other-list"
                                className={`space-y-1 ${otherExpanded && otherTopics.length > 5 ? 'max-h-[11rem] overflow-y-auto pr-1' : ''}`}
                            >
                                {visibleOtherTopics.map((topic) => renderTopicRow(topic))}
                            </div>
                            {!otherExpanded && otherMoreCount > 0 && (
                                <button
                                    type="button"
                                    className="mt-1 px-2 text-[12px] text-[var(--color-accent)] hover:text-[var(--color-text-primary)] transition-colors"
                                    onClick={() => setOtherExpanded(true)}
                                >
                                    Show {otherMoreCount} More
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </ScrollShadow>

            {currentProjectPath && (
                <div className="px-3 pb-2 shrink-0 w-[260px]">
                    <div className="w-full rounded-[8px] bg-[var(--mat-content-card-hover-bg)] px-2 py-1.5">
                        <div className="text-[10px] uppercase tracking-[0.03em] text-[var(--color-text-tertiary)] mb-1">
                            Project Directory
                        </div>
                        <div className="text-[11px] leading-4 text-[var(--color-text-secondary)] break-all whitespace-normal" title={currentProjectPath}>
                            {currentProjectPath}
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar Footer */}
            <div className="p-2 border-t border-[var(--mat-border)] flex items-center justify-between w-[260px]">
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
                                onClick={() => onOpenSettings('model')}
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
