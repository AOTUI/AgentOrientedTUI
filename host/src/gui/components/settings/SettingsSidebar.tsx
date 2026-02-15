/**
 * SettingsSidebar Component
 * 
 * Left sidebar containing tab navigation buttons for the Settings Panel.
 * Displays "Model" and "Theme" tabs with icons and highlights the active tab.
 */

import React from 'react';
import { IconModel, IconTheme } from '../Icons.js';
import type { SettingsSidebarProps } from './types.js';

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ activeTab, onTabChange }) => {
    return (
        <nav 
            className="w-full md:w-[132px] flex flex-row md:flex-col gap-2"
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
                className={`
                    flex-1 md:flex-none flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg
                    transition-all duration-300 text-left
                    ${activeTab === 'model'
                        ? 'bg-primary/10 border border-primary/30 text-primary'
                        : 'bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-highlight)] hover:text-[var(--color-text-primary)]'
                    }
                `}
            >
                <IconModel className={`w-4 h-4 ${activeTab === 'model' ? 'text-primary' : ''}`} aria-hidden="true" />
                <span className="text-xs md:text-[13px] font-medium uppercase tracking-wide">Model</span>
            </button>

            {/* Theme Tab Button */}
            <button
                onClick={() => onTabChange('theme')}
                role="tab"
                aria-selected={activeTab === 'theme'}
                aria-controls="theme-tab-panel"
                id="theme-tab"
                className={`
                    flex-1 md:flex-none flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 rounded-lg
                    transition-all duration-300 text-left
                    ${activeTab === 'theme'
                        ? 'bg-primary/10 border border-primary/30 text-primary'
                        : 'bg-transparent border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-highlight)] hover:text-[var(--color-text-primary)]'
                    }
                `}
            >
                <IconTheme className={`w-4 h-4 ${activeTab === 'theme' ? 'text-primary' : ''}`} aria-hidden="true" />
                <span className="text-xs md:text-[13px] font-medium uppercase tracking-wide">Theme</span>
            </button>
        </nav>
    );
};
