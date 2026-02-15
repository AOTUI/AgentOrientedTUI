/**
 * ThemeCard Component
 * 
 * Displays a single theme option with preview colors.
 * Shows checkmark icon when active and applies primary border.
 */

import React from 'react';
import { MagicCard } from '../ui/MagicCard.js';
import type { ThemeCardProps } from './types.js';

/**
 * Icon component for checkmark
 */
const IconCheck = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
        className={`w-5 h-5 ${props.className || ''}`}
    >
        <path d="M20 6L9 17l-5-5" />
    </svg>
);

/**
 * Theme preview colors for each theme
 */
const THEME_COLORS = {
    dark: {
        background: '#0A0A0A',
        surface: '#1A1A1A',
        text: '#E5E5E5',
        accent: '#3B82F6',
    },
    light: {
        background: '#FFFFFF',
        surface: '#F5F5F5',
        text: '#1A1A1A',
        accent: '#8B5CF6',
    },
};

export const ThemeCard: React.FC<ThemeCardProps> = ({ theme, isActive, onSelect }) => {
    const colors = THEME_COLORS[theme];
    const themeName = theme.charAt(0).toUpperCase() + theme.slice(1);

    return (
        <MagicCard
            className={`cursor-pointer transition-all duration-300 ${
                isActive ? 'border-2 border-[var(--color-primary)]' : 'border border-[var(--color-border)]'
            }`}
            onClick={onSelect}
            role="radio"
            aria-checked={isActive}
            aria-label={`${themeName} theme`}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect();
                }
            }}
        >
            <div className="flex flex-col h-full">
                {/* Header with theme name and checkmark */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-medium text-[var(--color-text-primary)]">
                        {themeName}
                    </h3>
                    {isActive && (
                        <IconCheck className="text-[var(--color-primary)]" aria-hidden="true" />
                    )}
                </div>

                {/* Theme preview */}
                <div 
                    className="flex-1 rounded-lg p-4 flex flex-col gap-2 transition-all duration-300"
                    style={{ backgroundColor: colors.background }}
                >
                    {/* Preview surface */}
                    <div 
                        className="h-12 rounded-md flex items-center px-3"
                        style={{ backgroundColor: colors.surface }}
                    >
                        <div 
                            className="text-xs font-medium"
                            style={{ color: colors.text }}
                        >
                            Preview Text
                        </div>
                    </div>

                    {/* Preview accent */}
                    <div className="flex gap-2">
                        <div 
                            className="h-6 flex-1 rounded"
                            style={{ backgroundColor: colors.accent }}
                        />
                        <div 
                            className="h-6 w-16 rounded"
                            style={{ backgroundColor: colors.surface }}
                        />
                    </div>
                </div>
            </div>
        </MagicCard>
    );
};
