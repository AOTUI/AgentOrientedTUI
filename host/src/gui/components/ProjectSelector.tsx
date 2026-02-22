/**
 * ProjectSelector \u2014 Liquid Glass Design (macOS 26 Tahoe \u98ce\u683c)
 *
 * \u8bbe\u8ba1\u539f\u5219:
 * \u2022 Liquid Glass Regular \u6750\u8d28\u5361\u7247
 * \u2022 \u540c\u5fc3\u5706\u89d2\u4f53\u7cfb (Window 20px \u2192 Card 16px \u2192 Icon 10px)
 * \u2022 5\u8272\u9879\u76ee\u56fe\u6807\u989c\u8272(\u786e\u5b9a\u6027\u6620\u5c04)
 * \u2022 \u6d41\u4f53\u5c45\u4e2d\u6eda\u52a8\u5bb9\u5668\uff0c\u5185\u5bb9\u900f\u8fc7\u73bb\u7483
 * \u2022 macOS Traffic Light \u5b89\u5168\u533a\u57df (topleft 28px)
 */
import React, { useState, useEffect } from 'react';
import { useChatBridge } from '../ChatBridge.js';
import type { Project } from '../../types.js';
import { IconFolder, IconSun, IconMoon, IconSettings } from './Icons.js';

interface ProjectSelectorProps {
    onSelectProject: (projectId: string) => void;
    toggleTheme: () => void;
    theme: 'dark' | 'light';
    onOpenSettings?: () => void;
}

// \u786e\u5b9a\u6027\u9879\u76ee\u989c\u8272\uff0c\u57fa\u4e8e\u9879\u76ee\u540d\u5b57\u9996\u5b57\u6bcd charCode
const ICON_COLOR_COUNT = 5;
function getIconColorIndex(name: string): number {
    if (!name) return 0;
    return name.charCodeAt(0) % ICON_COLOR_COUNT;
}

function formatDate(ts: number | undefined): string {
    if (!ts) return 'NEW';
    const d = new Date(ts);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// \u2500\u2500 \u9879\u76ee\u5361\u7247 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

interface ProjectCardProps {
    project: Project;
    onSelect: () => void;
    onDelete: (e: React.MouseEvent) => void;
}

function ProjectCard({ project, onSelect, onDelete }: ProjectCardProps) {
    const colorIdx = getIconColorIndex(project.name);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault(); // Prevent page scroll on Space
            onSelect();
        }
    };

    return (
        <div
            onClick={onSelect}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="button"
            aria-label={`Open project ${project.name}`}
            className="group relative text-left w-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-[var(--radius-lg)]"
        >
            {/* Card body — Liquid Glass Regular */}
            <div
                className="mat-content relative flex items-center gap-4 p-4 overflow-hidden cursor-pointer rounded-[var(--radius-lg)] hover:bg-[var(--mat-content-card-hover-bg)] transition-colors"
            >
                {/* 项目图标 — 同心圆角小方块 */}
                <div
                    className={`proj-icon-${colorIdx} shrink-0 w-10 h-10 rounded-[var(--radius-sm)] border flex items-center justify-center`}
                >
                    <span
                        className="text-[15px] font-semibold leading-none font-system"
                    >
                        {project.name.charAt(0).toUpperCase()}
                    </span>
                </div>

                {/* 内容区 */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center justify-between gap-3">
                        <h3
                            className="text-[15px] font-semibold truncate text-[var(--color-text-primary)] font-system"
                        >
                            {project.name}
                        </h3>
                        <span
                            className="text-[12px] font-medium text-[var(--color-text-tertiary)] font-system shrink-0"
                        >
                            {formatDate(project.lastOpenedAt)}
                        </span>
                    </div>
                    <p
                        className="mt-1 mb-0 text-[12px] truncate leading-none text-[var(--color-text-tertiary)] font-system"
                        style={{ letterSpacing: '0.01em' }}
                        title={project.path}
                    >
                        {project.path}
                    </p>
                </div>

                {/* 删除按钮 — hover 时显现 */}
                <button
                    onClick={onDelete}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] rounded-[var(--radius-sm)] p-1.5"
                    title="Remove project"
                    aria-label="Remove project"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

// \u2500\u2500 \u4e3b\u7ec4\u4ef6 \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

export function ProjectSelector({ onSelectProject, toggleTheme, theme, onOpenSettings }: ProjectSelectorProps) {
    const bridge = useChatBridge();
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const isDark = theme === 'dark';

    const overlayFilter = isDark
        ? 'blur(56px) saturate(120%) brightness(0.72)'
        : 'blur(56px) saturate(170%) brightness(1.02)';

    const panelBackdropFilter = isDark
        ? 'blur(36px) saturate(120%) brightness(0.86)'
        : 'blur(40px) saturate(180%) brightness(1.02)';

    useEffect(() => {
        loadProjects();
        const unsubscribe = bridge.subscribe((event) => {
            if (event.type === 'init') loadProjects();
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
        if (!path) return;
        const existing = projects.find(p => p.path === path);
        if (existing) {
            await handleSelect(existing.id);
        } else {
            const name = path.split('/').pop() || 'Untitled Project';
            const project = await bridge.createProject(path, name);
            await handleSelect(project.id);
        }
    };

    const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Remove this project from the list?')) {
            await bridge.deleteProject(id);
            loadProjects();
        }
    };

    const handleSelect = async (id: string) => {
        await bridge.openProject(id);
        onSelectProject(id);
    };

    return (
        <div
            className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden bg-transparent text-[var(--color-text-primary)] font-system"
        >
            {/* 真实的 macOS 壁纸模糊效果 */}
            <div 
                className="absolute inset-0 z-0 bg-[var(--mat-overlay-bg)]"
                style={{
                    backdropFilter: overlayFilter,
                    WebkitBackdropFilter: overlayFilter
                }}
            />

            {/* 居中对话框 */}
            <div
                className="mat-lg-regular flex flex-col w-full max-w-[480px] max-h-[80vh] rounded-[20px] shadow-2xl overflow-hidden relative z-10"
                style={{
                    background: isDark ? 'rgba(24, 24, 28, 0.78)' : 'var(--mat-lg-regular-bg)',
                    backdropFilter: panelBackdropFilter,
                    WebkitBackdropFilter: panelBackdropFilter,
                }}
            >
                {/* Traffic Light 拖动区域 */}
                <div
                    className="drag-region shrink-0 w-full"
                    style={{ height: 40 }}
                />

                {/* 内容区域 */}
                <div className="no-drag relative z-10 flex-1 flex flex-col overflow-hidden px-8 pb-8">

                {/* 头部: title + 操作按钮 */}
                <header className="shrink-0 flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        {/* 微型 AOTUI Logomark */}
                        <div
                            className={`w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center border ${
                                theme === 'light'
                                    ? 'bg-[var(--mat-content-card-hover-bg)] border-[var(--mat-border-highlight)]'
                                    : 'bg-[var(--color-accent-muted)] border-[var(--color-accent-ring)]'
                            }`}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="text-[var(--color-accent)]">
                                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                                <path d="M17.5 14v6M14 17h7" />
                            </svg>
                        </div>
                        <h1
                            className="text-[17px] font-semibold  text-[var(--color-text-primary)]"
                            style={{ letterSpacing: '-0.02em' }}
                        >
                            Projects
                        </h1>
                        {projects.length > 0 && (
                            <span
                                className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] text-[var(--color-text-tertiary)]"
                            >
                                {projects.length}
                            </span>
                        )}
                    </div>

                    {/* 操作按钮组 */}
                    <div className="flex items-center gap-2">
                        {onOpenSettings && (
                            <button
                                onClick={onOpenSettings}
                                className={`p-2 rounded-full transition-colors ${
                                    theme === 'light'
                                        ? 'cursor-pointer text-[var(--color-text-primary)] bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] shadow-[inset_0_1px_0_var(--mat-inset-highlight)] hover:bg-[var(--mat-content-card-hover-bg)] hover:border-[var(--mat-border-highlight)]'
                                        : 'cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--mat-content-card-hover-bg)]'
                                }`}
                                title="Settings"
                            >
                                <IconSettings />
                            </button>
                        )}
                        <button
                            onClick={toggleTheme}
                            className={`p-2 rounded-full transition-colors ${
                                theme === 'light'
                                    ? 'cursor-pointer text-[var(--color-text-primary)] bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] shadow-[inset_0_1px_0_var(--mat-inset-highlight)] hover:bg-[var(--mat-content-card-hover-bg)] hover:border-[var(--mat-border-highlight)]'
                                    : 'cursor-pointer text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--mat-content-card-hover-bg)]'
                            }`}
                            title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
                        >
                            {theme === 'dark' ? <IconSun /> : <IconMoon />}
                        </button>

                        {/* 分隔线 */}
                        <div
                            className="h-4 w-px mx-1 bg-[var(--mat-border)]"
                        />

                        <button
                            onClick={handleOpenFolder}
                            className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium text-[var(--color-text-primary)] bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] shadow-[inset_0_1px_0_var(--mat-inset-highlight)] hover:bg-[var(--mat-content-card-hover-bg)] hover:border-[var(--mat-border-highlight)] transition-all active:scale-95 motion-reduce:active:scale-100"
                        >
                            <IconFolder className="w-3.5 h-3.5" />
                            <span>Open Folder</span>
                        </button>
                    </div>
                </header>

                {/* \u9879\u76ee\u6570\u91cf\u548c\u63cf\u8ff0 */}
                {projects.length > 0 && (
                    <div className="shrink-0 mb-5">
                        <p
                            className="text-[12px]"
                            style={{ color: 'var(--tx-tertiary)', fontFamily: 'var(--font-system)' }}
                        >
                            {projects.length === 1 ? '1 workspace' : `${projects.length} workspaces`}
                             — click to open
                        </p>
                    </div>
                )}

                {/* \u9879\u76ee\u5361\u7247\u7f51\u683c */}
                <div
                    className="flex-1 overflow-y-auto -mx-3 px-3 -mt-2 pt-2"
                    style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'var(--bd-default) transparent',
                    }}
                >
                    {isLoading ? (
                        /* \u52a0\u8f7d\u72b6\u6001: \u5361\u7247\u9aa8\u67b6\u5c4f */
                        <div className="grid grid-cols-1 gap-3">
                            {[1, 2, 3].map(i => (
                                <div
                                    key={i}
                                    className="min-h-[148px] rounded-[var(--radius-lg)] animate-pulse bg-[var(--mat-lg-clear-bg)] border border-[var(--mat-border)]"
                                />
                            ))}
                        </div>
                    ) : projects.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3 pb-4">
                            {projects.map(project => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    onSelect={() => handleSelect(project.id)}
                                    onDelete={(e) => handleDeleteProject(project.id, e)}
                                />
                            ))}
                        </div>
                    ) : (
                        /* \u7a7a\u72b6\u6001 */
                        <div
                            className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] min-h-[280px] border-2 border-dashed border-[var(--mat-border)] bg-transparent"
                        >
                            {/* 框图标 */}
                            <div
                                className="w-14 h-14 rounded-[var(--radius-md)] flex items-center justify-center mb-5 bg-[var(--mat-lg-clear-bg)] border border-[var(--mat-border)]"
                            >
                                <IconFolder
                                    className="w-6 h-6 text-[var(--color-text-tertiary)]"
                                />
                            </div>

                            <p
                                className="text-[13px] font-medium mb-1 text-[var(--color-text-secondary)]"
                            >
                                No projects yet
                            </p>
                            <p
                                className="text-[12px] mb-6 text-[var(--color-text-tertiary)]"
                            >
                                Open a folder to get started
                            </p>

                            <button
                                onClick={handleOpenFolder}
                                className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-medium text-[var(--color-text-primary)] bg-[var(--mat-content-card-bg)] border border-[var(--mat-border)] shadow-[inset_0_1px_0_var(--mat-inset-highlight)] hover:bg-[var(--mat-content-card-hover-bg)] hover:border-[var(--mat-border-highlight)] transition-all active:scale-95 motion-reduce:active:scale-100"
                            >
                                <IconFolder className="w-3.5 h-3.5" />
                                <span>Open Folder</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
            </div>
        </div>
    );
}
