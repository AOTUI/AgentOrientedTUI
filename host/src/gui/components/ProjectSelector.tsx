import React, { useState, useEffect } from 'react';
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import { useChatBridge } from '../ChatBridge.js';
import type { Project } from '../../types.js';
import { Spotlight } from './ui/Spotlight.js';
import { BentoGrid } from './ui/BentoGrid.js';
import { MagicCard } from './ui/MagicCard.js';
import { IconFolder, IconSun, IconMoon, IconSettings } from './Icons.js';

interface ProjectSelectorProps {
    onSelectProject: (projectId: string) => void;
    toggleTheme: () => void;
    theme: 'dark' | 'light';
    onOpenSettings?: () => void;
}

export function ProjectSelector({ onSelectProject, toggleTheme, theme, onOpenSettings }: ProjectSelectorProps) {
    const bridge = useChatBridge();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadProjects();
        const unsubscribe = bridge.subscribe((event) => {
            if (event.type === 'init') {
                loadProjects();
            }
        });
        return unsubscribe;
    }, [bridge]);

    const loadProjects = () => {
        const list = bridge.getProjects();
        setProjects(list);
        setIsLoading(false);
    };

    const handleOpenFolder = async () => {
        const path = await bridge.pickProjectFolder();
        if (path) {
            const existing = projects.find(p => p.path === path);
            if (existing) {
                await handleSelect(existing.id);
            } else {
                const name = path.split('/').pop() || 'Untitled Project';
                const project = await bridge.createProject(path, name);
                await handleSelect(project.id);
            }
        }
    };

    const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Delete project reference?')) {
            await bridge.deleteProject(id);
        }
    };

    const handleSelect = async (id: string) => {
        await bridge.openProject(id);
        onSelectProject(id);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg-base)] overflow-hidden text-[var(--color-text-primary)] font-sans antialiased selection:bg-[var(--color-primary)]/20">
            {/* Ambient Border Glow - All Edges */}
            <div className="absolute inset-x-0 top-0 h-[20px] z-0 pointer-events-none bg-gradient-to-b from-[var(--color-primary-glow)] to-transparent opacity-30" />
            <div className="absolute inset-x-0 bottom-0 h-[20px] z-0 pointer-events-none bg-gradient-to-t from-[var(--color-primary-glow)] to-transparent opacity-30" />
            <div className="absolute inset-y-0 left-0 w-[20px] z-0 pointer-events-none bg-gradient-to-r from-[var(--color-primary-glow)] to-transparent opacity-30" />
            <div className="absolute inset-y-0 right-0 w-[20px] z-0 pointer-events-none bg-gradient-to-l from-[var(--color-primary-glow)] to-transparent opacity-30" />
            <div className="absolute inset-0 z-0 pointer-events-none border border-[var(--color-primary)]/20" />

            <div className="relative z-10 w-full max-w-5xl p-8 flex flex-col h-full max-h-[90vh]">
                {/* Minimal Header */}
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-[var(--color-bg-surface)] flex items-center justify-center border border-[var(--color-border)] shadow-[0_0_15px_rgba(0,0,0,0.2)]">
                            <div className="w-3 h-3 bg-[var(--color-primary)] rounded-full shadow-[0_0_8px_var(--color-primary)]" />
                        </div>
                        <h1 className="text-2xl font-medium tracking-tight text-[var(--color-text-primary)]">
                            Projects
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        {onOpenSettings && (
                            <Tooltip content="Settings">
                                <Button
                                    isIconOnly
                                    variant="light"
                                    size="sm"
                                    onClick={onOpenSettings}
                                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors data-[hover=true]:bg-transparent flex items-center justify-center"
                                >
                                    <IconSettings />
                                </Button>
                            </Tooltip>
                        )}
                        <Button
                            isIconOnly
                            variant="light"
                            size="sm"
                            onClick={toggleTheme}
                            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors data-[hover=true]:bg-transparent flex items-center justify-center"
                        >
                            {theme === 'dark' ? <IconSun /> : <IconMoon />}
                        </Button>
                        <Button 
                            onClick={handleOpenFolder}
                            className="bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-highlight)] hover:border-[var(--color-border-hover)] font-medium text-sm h-9 px-4 rounded-md border border-[var(--color-border)] transition-all group flex items-center gap-2"
                        >
                            <IconFolder className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-colors" />
                            <span>Open Folder</span>
                        </Button>
                    </div>
                </div>

                {/* Projects Grid */}
                <div className="flex-1 overflow-y-auto pr-2 -mr-2 custom-scrollbar">
                     <BentoGrid className="pb-10 gap-4 md:auto-rows-[11rem]">
                        {projects.map((project, index) => (
                            <MagicCard 
                                key={project.id} 
                                className="cursor-pointer group md:col-span-1 min-h-[160px] border border-[var(--color-border)]"
                                gradientColor="var(--color-border-hover)"
                                onClick={() => handleSelect(project.id)}
                            >
                                <div className="flex flex-col h-full justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded flex items-center justify-center bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] group-hover:border-[var(--color-border-hover)] transition-all">
                                                <span className="text-xs font-mono font-bold">
                                                    {project.name.charAt(0).toUpperCase()}
                                                </span>
                                            </div>
                                            <h3 className="font-medium text-[var(--color-text-primary)]/90 group-hover:text-[var(--color-text-primary)] transition-colors tracking-tight truncate max-w-[140px]">
                                                {project.name}
                                            </h3>
                                        </div>
                                         <button 
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-[var(--color-bg-highlight)] rounded"
                                            onClick={(e) => handleDeleteProject(project.id, e)}
                                        >
                                            <span className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] text-lg leading-none">×</span>
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <div className="font-mono text-[10px] text-[var(--color-text-muted)] truncate group-hover:text-[var(--color-text-secondary)] transition-colors">
                                             {project.path}
                                        </div>
                                        <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)] group-hover:border-[var(--color-border-hover)] transition-colors">
                                            <span className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
                                                {project.lastOpenedAt 
                                                    ? new Date(project.lastOpenedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) 
                                                    : 'NEW'}
                                            </span>
                                            <span className="text-[10px] text-[var(--color-text-muted)] group-hover:translate-x-1 group-hover:text-[var(--color-primary)] transition-all duration-300">
                                                Open →
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </MagicCard>
                        ))}

                        {/* Minimal Empty State */}
                        {projects.length === 0 && !isLoading && (
                            <div className="col-span-full h-[200px] flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-transparent hover:border-[var(--color-border-hover)] transition-colors">
                                <p className="text-[var(--color-text-muted)] text-sm mb-4">No projects yet</p>
                                <Button 
                                    size="sm" 
                                    variant="flat" 
                                    onClick={handleOpenFolder} 
                                    className="bg-[var(--color-bg-highlight)] text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]"
                                    startContent={<IconFolder className="w-3.5 h-3.5" />}
                                >
                                    Open Folder
                                </Button>
                            </div>
                        )}
                     </BentoGrid>
                </div>
            </div>
        </div>
    );
}
