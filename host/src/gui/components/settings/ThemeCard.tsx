/**
 * ThemeCard Component
 * 
 * Displays a single theme option with preview colors.
 * Shows checkmark icon when active and applies primary border.
 */

import React from 'react';
import type { ThemeCardProps } from './types.js';

/**
 * Icon component for checkmark
 */
const IconCheck = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth={2.5} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
        className={`w-5 h-5 ${props.className || ''}`}
    >
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

/**
 * Theme preview colors for each theme
 */
const THEME_COLORS = {
    dark: {
        background: '#1c1c1e', // macOS Dark Window
        surface: 'rgba(255, 255, 255, 0.1)',
        border: 'rgba(255, 255, 255, 0.12)',
        text: '#ffffff',
        accent: '#0A84FF',
    },
    light: {
        background: '#f5f5f7', // macOS Light Window
        surface: 'rgba(255, 255, 255, 0.8)',
        border: 'rgba(0, 0, 0, 0.08)',
        text: '#1d1d1f',
        accent: '#007AFF',
    },
};

export const ThemeCard: React.FC<ThemeCardProps> = ({ theme, isActive, onSelect }) => {
    const colors = THEME_COLORS[theme];
    const themeName = theme.charAt(0).toUpperCase() + theme.slice(1);

    return (
        <button
            className={`
                group relative w-full text-left outline-none
                rounded-[16px] border transition-all duration-200 ease-[var(--ease-spring)]
                flex flex-col p-4 gap-4 h-[180px]
                ${isActive 
                    ? 'border-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent)]' 
                    : 'mat-content hover:bg-[var(--mat-content-card-hover-bg)] border-[var(--mat-border)]'
                }
            `}
            onClick={onSelect}
            role="radio"
            aria-checked={isActive}
            aria-label={`${themeName} theme`}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect();
                }
            }}
        >
            {/* Preview Area */}
            <div 
                className="flex-1 w-full rounded-[8px] border shadow-sm overflow-hidden relative"
                style={{ 
                    backgroundColor: colors.background,
                    borderColor: colors.border
                }}
            >
                {/* Mock UI */}
                <div className="absolute top-3 left-3 right-3 flex flex-col gap-2">
                    <div className="h-2 w-1/3 rounded-full opacity-20 bg-current" style={{ color: colors.text }} />
                    <div 
                        className="h-8 rounded-md w-full border flex items-center px-2"
                        style={{ 
                            backgroundColor: colors.surface,
                            borderColor: colors.border
                        }}
                    >
                        <div className="h-1.5 w-1/2 rounded-full opacity-40 bg-current" style={{ color: colors.text }} />
                    </div>
                    <div className="flex gap-2 mt-1">
                        <div className="h-6 w-12 rounded-md" style={{ backgroundColor: colors.accent }} />
                        <div className="h-6 w-12 rounded-md border" style={{ borderColor: colors.border }} />
                    </div>
                </div>
            </div>

            {/* Label */}
            <div className="flex items-center justify-between w-full">
                <span className={`text-[13px] font-medium ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
                    {themeName}
                </span>
                {isActive && (
                    <div className="text-[var(--color-accent)]">
                        <IconCheck />
                    </div>
                )}
            </div>
        </button>
    );
};

