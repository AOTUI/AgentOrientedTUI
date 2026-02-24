/**
 * SettingsSidebar Component
 * 
 * Left sidebar containing tab navigation buttons for the Settings Panel.
 * Displays "Model" and "Theme" tabs with icons and highlights the active tab.
 */

import React from 'react';
import { IconModel, IconTheme, IconPlug, IconFolder, IconTerminal } from '../Icons.js';
import type { SettingsSidebarProps } from './types.js';

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeTab, onTabChange }) => {
    // Shared button styles
    const baseBtnClass = `
        flex-1 md:flex-none flex items-center justify-center md:justify-start gap-2 md:gap-3 
        px-3 md:px-4 py-2 md:py-2.5 rounded-xl
        transition-all duration-300 text-left border cursor-pointer
    `;

    const activeBtnClass = `
        bg-[var(--mat-content-card-hover-bg)] border-[var(--mat-border-highlight)] text-[var(--color-text-primary)]
        shadow-[inset_0_1px_0_var(--mat-inset-highlight)]
    `;

    const inactiveBtnClass = `
        bg-transparent border-transparent
        text-[var(--color-text-secondary)] 
        hover:bg-[var(--mat-content-card-hover-bg)] hover:text-[var(--color-text-primary)] hover:border-[var(--mat-border)]
    `;

    return (
        <nav
            className="w-full md:w-[160px] flex flex-row md:flex-col gap-1 p-2"
            role="tablist"
            aria-label="Settings navigation"
        >
            {/* Model Tab Button */}
            <button
                onClick={() => onTabChange('model')}
                role="tab"
                aria-selected={activeTab === 'model'}
                aria-controls="model-tab-panel"
                id="model-tab"
                className={`${baseBtnClass} ${activeTab === 'model' ? activeBtnClass : inactiveBtnClass}`}
            >
                <IconModel
                    className={`w-4 h-4 ${activeTab === 'model' ? 'text-[var(--color-accent)]' : 'opacity-70'}`}
                    aria-hidden="true"
                />
                <span className={`text-[13px] ${activeTab === 'model' ? 'font-semibold text-[var(--color-text-primary)]' : 'font-medium text-[var(--color-text-secondary)]'}`}>Model</span>
            </button>

            {/* Theme Tab Button */}
            <button
                onClick={() => onTabChange('theme')}
                role="tab"
                aria-selected={activeTab === 'theme'}
                aria-controls="theme-tab-panel"
                id="theme-tab"
                className={`${baseBtnClass} ${activeTab === 'theme' ? activeBtnClass : inactiveBtnClass}`}
            >
                <IconTheme
                    className={`w-4 h-4 ${activeTab === 'theme' ? 'text-[var(--color-accent)]' : 'opacity-70'}`}
                    aria-hidden="true"
                />
                <span className={`text-[13px] ${activeTab === 'theme' ? 'font-semibold text-[var(--color-text-primary)]' : 'font-medium text-[var(--color-text-secondary)]'}`}>Theme</span>
            </button>

            {/* Apps Tab Button */}
            <button
                onClick={() => onTabChange('apps')}
                role="tab"
                aria-selected={activeTab === 'apps'}
                aria-controls="apps-tab-panel"
                id="apps-tab"
                className={`${baseBtnClass} ${activeTab === 'apps' ? activeBtnClass : inactiveBtnClass}`}
            >
                <IconFolder
                    className={`w-4 h-4 ${activeTab === 'apps' ? 'text-[var(--color-accent)]' : 'opacity-70'}`}
                    aria-hidden="true"
                />
                <span className={`text-[13px] ${activeTab === 'apps' ? 'font-semibold text-[var(--color-text-primary)]' : 'font-medium text-[var(--color-text-secondary)]'}`}>Apps</span>
            </button>

            {/* MCP Tab Button */}
            <button
                onClick={() => onTabChange('mcp')}
                role="tab"
                aria-selected={activeTab === 'mcp'}
                aria-controls="mcp-tab-panel"
                id="mcp-tab"
                className={`${baseBtnClass} ${activeTab === 'mcp' ? activeBtnClass : inactiveBtnClass}`}
            >
                <IconPlug
                    className={`w-4 h-4 ${activeTab === 'mcp' ? 'text-[var(--color-accent)]' : 'opacity-70'}`}
                    aria-hidden="true"
                />
                <span className={`text-[13px] ${activeTab === 'mcp' ? 'font-semibold text-[var(--color-text-primary)]' : 'font-medium text-[var(--color-text-secondary)]'}`}>MCP</span>
            </button>

            {/* Skills Tab Button */}
            <button
                onClick={() => onTabChange('skills')}
                role="tab"
                aria-selected={activeTab === 'skills'}
                aria-controls="skills-tab-panel"
                id="skills-tab"
                className={`${baseBtnClass} ${activeTab === 'skills' ? activeBtnClass : inactiveBtnClass}`}
            >
                <IconTerminal
                    className={`w-4 h-4 ${activeTab === 'skills' ? 'text-[var(--color-accent)]' : 'opacity-70'}`}
                    aria-hidden="true"
                />
                <span className={`text-[13px] ${activeTab === 'skills' ? 'font-semibold text-[var(--color-text-primary)]' : 'font-medium text-[var(--color-text-secondary)]'}`}>Skills</span>
            </button>
        </nav>
    );
};

