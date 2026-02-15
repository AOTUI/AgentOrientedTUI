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
        <div className="flex flex-col h-full p-4 sm:p-6 md:p-8">
            {/* Header */}
            <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl md:text-2xl font-medium tracking-tight text-[var(--color-text-primary)]">
                    Theme Selection
                </h2>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                    Choose your preferred color scheme
                </p>
            </div>

            {/* Theme Cards */}
            <div 
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6 transition-all duration-300 ease-in-out"
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
