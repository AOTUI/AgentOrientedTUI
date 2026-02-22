/**
 * SettingsSidebar Component
 * 
 * Left sidebar containing tab navigation buttons for the Settings Panel.
 * Displays "Model" and "Theme" tabs with icons and highlights the active tab.
 */

import React from 'react';
import { IconModel, IconTheme, IconPlug } from '../Icons.js';
import type { SettingsSidebarProps } from './types.js';

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeTab, onTabChange }) => {
    // Shared button styles
    const baseBtnClass = `
        flex-1 md:flex-none flex items-center justify-center md:justify-start gap-2 md:gap-3 
        px-3 md:px-4 py-2 md:py-2.5 rounded-[var(--radius-sm)]
        transition-all duration-300 text-left border
    `;

    const activeBtnClass = `
        bg-[var(--mat-content-card-hover-bg)] border-[var(--mat-border)] text-[var(--color-text-primary)]
        shadow-[inset_0_1px_0_var(--mat-inset-highlight)]
    `;

    const inactiveBtnClass = `
        bg-transparent border-transparent
        text-[var(--color-text-secondary)] 
        hover:bg-[var(--mat-content-card-hover-bg)] hover:text-[var(--color-text-primary)]
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
                <span className="text-[13px] font-medium">Model</span>
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
                <span className="text-[13px] font-medium">Theme</span>
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
                <span className="text-[13px] font-medium">MCP</span>
            </button>
        </nav>
    );
};

