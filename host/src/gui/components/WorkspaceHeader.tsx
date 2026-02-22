import React from 'react';
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Tooltip } from "@heroui/tooltip";
import { IconMenu, IconPlay, IconPause, IconDelete } from './Icons.js';
import type { Topic } from '../../types.js';

interface WorkspaceHeaderProps {
    activeTopic: Topic | null;
    activeTopicId: string | null;
    connected: boolean;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    viewMode: 'chat' | 'tui';
    setViewMode: (mode: 'chat' | 'tui') => void;
    agentState: string;
    agentPaused: boolean;
    onResumeAgent: () => void;
    onPauseAgent: () => void;
    onShowDeleteConfirm: () => void;
}

export function WorkspaceHeader({
    activeTopic,
    activeTopicId,
    connected,
    sidebarOpen,
    setSidebarOpen,
    viewMode,
    setViewMode,
    agentState,
    agentPaused,
    onResumeAgent,
    onPauseAgent,
    onShowDeleteConfirm
}: WorkspaceHeaderProps) {
    return (
        <header className="h-16 flex items-center justify-between px-6 shrink-0 glass-card rounded-[var(--radius-lg)]">
            <div className="flex items-center gap-4 overflow-hidden">
                <Tooltip content="Toggle Sidebar">
                    <Button
                        isIconOnly
                        variant="light"
                        size="sm"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] data-[hover=true]:bg-white/5 flex items-center justify-center"
                    >
                        <IconMenu />
                    </Button>
                </Tooltip>

                <div className="flex flex-col">
                    <h2 className="font-medium text-base leading-tight truncate max-w-md text-[var(--color-text-primary)] tracking-wide">
                        {activeTopic?.title || 'System Chat'}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-success shadow-[0_0_8px_var(--color-success)]' : 'bg-danger shadow-[0_0_8px_var(--color-danger)]'}`} />
                        {/* Topic Summary if available */}
                        {activeTopic?.summary && (
                             <span className="text-[12px] text-[var(--color-text-tertiary)] border-l border-white/10 pl-2 ml-1 truncate max-w-[200px]">
                                {activeTopic.summary}
                             </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {activeTopic && (
                    <>
                        {/* View Mode Switcher - Segmented Control Style */}
                        <div className="flex bg-[var(--color-bg-highlight)] p-1 rounded-lg border border-[var(--color-border)]">
                            <Button
                                size="sm"
                                variant="light"
                                onClick={() => setViewMode('chat')}
                                className={`h-7 text-[12px] font-medium px-4 min-w-0 rounded-md transition-all ${viewMode === 'chat' ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'}`}
                            >
                                CHAT
                            </Button>
                            <Button
                                size="sm"
                                variant="light"
                                onClick={() => setViewMode('tui')}
                                className={`h-7 text-[12px] font-medium px-4 min-w-0 rounded-md transition-all ${viewMode === 'tui' ? 'bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] shadow-sm' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]'}`}
                            >
                                TUI VIEW
                            </Button>
                        </div>

                        <div className="h-6 w-px bg-[var(--color-border)]" />

                        {/* Agent Status & Controls */}
                        <div className="flex items-center gap-3">
                            <Chip
                                variant="flat"
                                size="sm"
                                className={`
                                    font-medium text-[13px] h-7 border border-transparent
                                    ${agentState === 'THINKING' ? 'bg-[var(--mat-lg-clear-bg)] text-[var(--color-text-secondary)] border-[var(--mat-border)]' : 
                                      agentState === 'EXECUTING' ? 'bg-success/10 text-success border-success/20' : 
                                      agentState === 'STOPPED' ? 'bg-[var(--color-danger)] bg-opacity-10 text-[var(--color-danger)] border-[var(--color-danger)] border-opacity-20' : 'bg-[var(--mat-lg-clear-bg)] text-[var(--color-text-tertiary)] border-[var(--mat-border)]'}
                                `}
                                startContent={
                                    <div className={`w-1.5 h-1.5 rounded-full mx-1 ${agentState === 'THINKING' || agentState === 'EXECUTING' ? 'animate-pulse bg-current' : 'bg-current'}`} />
                                }
                            >
                                {agentPaused ? 'PAUSED' : agentState}
                            </Chip>

                            <div className="flex items-center gap-1">
                                {agentPaused ? (
                                    <Tooltip content="Resume Agent">
                                        <Button isIconOnly size="sm" variant="light" onClick={onResumeAgent} className="text-success hover:bg-success/10 rounded-md flex items-center justify-center">
                                            <IconPlay />
                                        </Button>
                                    </Tooltip>
                                ) : (
                                    <Tooltip content="Pause Agent">
                                        <Button isIconOnly size="sm" variant="light" onClick={onPauseAgent} className="text-warning hover:bg-warning/10 rounded-md flex items-center justify-center">
                                            <IconPause />
                                        </Button>
                                    </Tooltip>
                                )}

                                <Tooltip content="Delete Topic">
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        color="danger"
                                        onClick={onShowDeleteConfirm}
                                        className="hover:bg-danger/10 rounded-md flex items-center justify-center"
                                    >
                                        <IconDelete />
                                    </Button>
                                </Tooltip>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </header>
    );
}
