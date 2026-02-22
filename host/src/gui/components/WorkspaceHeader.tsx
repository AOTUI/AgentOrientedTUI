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
        <header className="absolute top-4 left-0 right-0 z-30 flex items-center justify-between px-6 pointer-events-none">
            {/* Left Island: Menu + Project Name */}
            <div className="flex items-center gap-3 mat-lg-regular rounded-full px-2 py-1.5 pointer-events-auto">
                <Tooltip content="Toggle Sidebar">
                    <Button
                        isIconOnly
                        variant="light"
                        size="sm"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-full min-w-8 w-8 h-8 flex items-center justify-center"
                    >
                        <IconMenu />
                    </Button>
                </Tooltip>

                <div className="flex items-center gap-2 pr-3 border-l border-[var(--mat-border)] pl-3">
                    <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-danger'}`} />
                    <h2 className="font-medium text-[13px] leading-tight truncate max-w-[200px] text-[var(--color-text-primary)]">
                        {activeTopic?.title || 'System Chat'}
                    </h2>
                </div>
            </div>

            {/* Center Island: View Mode Switcher */}
            {activeTopic && (
                <div className="flex items-center mat-lg-regular rounded-full p-1 pointer-events-auto">
                    <Button
                        size="sm"
                        variant="light"
                        onClick={() => setViewMode('chat')}
                        className={`h-7 text-[12px] font-medium px-4 min-w-0 rounded-full transition-all ${viewMode === 'chat' ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-base)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                    >
                        Chat
                    </Button>
                    <Button
                        size="sm"
                        variant="light"
                        onClick={() => setViewMode('tui')}
                        className={`h-7 text-[12px] font-medium px-4 min-w-0 rounded-full transition-all ${viewMode === 'tui' ? 'bg-[var(--color-text-primary)] text-[var(--color-bg-base)] shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                    >
                        TUI View
                    </Button>
                </div>
            )}

            {/* Right Island: Agent Status & Controls */}
            <div className="flex items-center gap-2 pointer-events-auto">
                {activeTopic && (
                    <div className="flex items-center gap-2 mat-lg-regular rounded-full px-3 py-1.5">
                        <div className="flex items-center gap-2 pr-2">
                            <span className={`text-[12px] font-medium ${
                                agentState === 'THINKING' ? 'text-[var(--color-text-secondary)]' : 
                                agentState === 'EXECUTING' ? 'text-success' : 
                                agentState === 'STOPPED' ? 'text-danger' : 
                                'text-[var(--color-text-tertiary)]'
                            }`}>
                                {agentPaused ? 'Paused' : (agentState === 'IDLE' ? 'Idle' : agentState.charAt(0) + agentState.slice(1).toLowerCase())}
                            </span>
                        </div>

                        <div className="flex items-center gap-1 border-l border-[var(--mat-border)] pl-2">
                            {agentPaused ? (
                                <Tooltip content="Resume Agent">
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        onClick={onResumeAgent}
                                        className="text-success hover:bg-success/10 rounded-full min-w-8 w-8 h-8"
                                    >
                                        <IconPlay />
                                    </Button>
                                </Tooltip>
                            ) : (
                                <Tooltip content="Pause Agent">
                                    <Button
                                        isIconOnly
                                        size="sm"
                                        variant="light"
                                        onClick={onPauseAgent}
                                        className="text-warning hover:bg-warning/10 rounded-full min-w-8 w-8 h-8"
                                    >
                                        <IconPause />
                                    </Button>
                                </Tooltip>
                            )}
                            <Tooltip content="Delete Session" color="danger">
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    onClick={onShowDeleteConfirm}
                                    className="text-danger hover:bg-danger/10 rounded-full min-w-8 w-8 h-8"
                                >
                                    <IconDelete />
                                </Button>
                            </Tooltip>
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
}
