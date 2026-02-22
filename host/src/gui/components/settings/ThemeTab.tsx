/**
 * ThemeTab Component
 * 
 * Displays theme selection cards for dark and light themes.
 * Handles theme selection with smooth transition animations.
 */

import React from 'react';
import { ThemeCard } from './ThemeCard.js';
import { useScreenReaderAnnouncement } from './hooks/useScreenReaderAnnouncement.js';
import type { ThemeTabProps } from './types.js';

export const ThemeTab: React.FC<ThemeTabProps> = ({ currentTheme, onThemeChange }) => {
    // Screen reader announcements hook
    const { announce } = useScreenReaderAnnouncement();

    const handleThemeChange = (theme: 'dark' | 'light') => {
        onThemeChange(theme);
        announce(`${theme.charAt(0).toUpperCase() + theme.slice(1)} theme applied`, 'polite');
    };

    return (
        <div className="flex flex-col h-full p-2 max-w-[800px] mx-auto">
            {/* Header */}
            <div className="mb-6 text-center sm:text-left">
                <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">
                    Appearance
                </h2>
                <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
                    Choose your preferred interface theme
                </p>
            </div>

            {/* Theme Cards */}
            <div 
                className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                role="radiogroup"
                aria-label="Theme selection"
            >
                <ThemeCard
                    theme="dark"
                    isActive={currentTheme === 'dark'}
                    onSelect={() => handleThemeChange('dark')}
                />
                <ThemeCard
                    theme="light"
                    isActive={currentTheme === 'light'}
                    onSelect={() => handleThemeChange('light')}
                />
            </div>
        </div>
    );
};

