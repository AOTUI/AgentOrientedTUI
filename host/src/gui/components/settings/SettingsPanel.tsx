/**
 * SettingsPanel Component
 * 
 * Root modal container that manages tab navigation and content display.
 * Provides centralized configuration for LLM models and application themes.
 */

import React, { useState, useEffect, useRef } from 'react';
import { SettingsSidebar } from './SettingsSidebar.js';
import { ModelTab } from './ModelTab.js';
import { ThemeTab } from './ThemeTab.js';
import { McpTab } from './mcp/McpTab.js';
import { AppsTab } from './apps/AppsTab.js';
import { SkillsTab } from './skills/SkillsTab.js';
import { SettingsErrorBoundary } from './SettingsErrorBoundary.js';
import { useScreenReaderAnnouncement } from './hooks/useScreenReaderAnnouncement.js';
import type { SettingsPanelProps } from './types.js';

/**
 * Icon component for exit button
 */
const IconExit = (props: React.SVGProps<SVGSVGElement>) => (
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
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
);

/**
 * SettingsPanel Component
 * 
 * Modal overlay component for application settings
 */
export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    isOpen,
    onClose,
    theme,
    onThemeChange,
    currentProjectPath,
}) => {
    // State
    const [activeTab, setActiveTab] = useState<'model' | 'theme' | 'apps' | 'mcp' | 'skills'>('model');

    // Refs for focus trap
    const panelRef = useRef<HTMLDivElement>(null);
    const firstFocusableRef = useRef<HTMLButtonElement>(null);
    const exitButtonRef = useRef<HTMLButtonElement>(null);

    // Screen reader announcements
    const { announce } = useScreenReaderAnnouncement();

    /**
     * Announce modal open/close
     */
    useEffect(() => {
        if (isOpen) {
            announce('Settings panel opened', 'polite');
        } else {
            announce('Settings panel closed', 'polite');
        }
    }, [isOpen, announce]);

    /**
     * Handle Escape key press
     */
    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onClose]);

    /**
     * Handle backdrop click
     */
    const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
        // Only close if clicking the backdrop itself, not its children
        if (event.target === event.currentTarget) {
            onClose();
        }
    };

    /**
     * Focus trap implementation
     */
    useEffect(() => {
        if (!isOpen) return;

        const handleTabKey = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return;

            const focusableElements = panelRef.current?.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );

            if (!focusableElements || focusableElements.length === 0) return;

            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (event.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstElement) {
                    event.preventDefault();
                    lastElement.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastElement) {
                    event.preventDefault();
                    firstElement.focus();
                }
            }
        };

        document.addEventListener('keydown', handleTabKey);
        return () => document.removeEventListener('keydown', handleTabKey);
    }, [isOpen]);

    /**
     * Focus first element when panel opens
     */
    useEffect(() => {
        if (isOpen) {
            // Small delay to ensure animation starts
            setTimeout(() => {
                const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
                    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                firstFocusable?.focus();
            }, 100);
        }
    }, [isOpen]);

    /**
     * Prevent body scroll when modal is open
     */
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = '';
            };
        }
    }, [isOpen]);

    // Don't render if not open
    if (!isOpen) return null;

    return (
        <div
            className={`
                fixed inset-0 z-50 flex items-center justify-center no-drag
                bg-[var(--mat-overlay-bg)] backdrop-blur-md
                transition-opacity duration-300
                ${isOpen ? 'opacity-100' : 'opacity-0'}
            `}
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-panel-title"
        >
            {/* Settings Panel Container */}
            <div
                ref={panelRef}
                className={`
                    relative w-full no-drag
                    max-w-[1000px] min-w-[320px]
                    max-h-[720px] h-[85vh]
                    mx-4 sm:mx-6
                    mat-lg-regular
                    rounded-[20px]
                    flex flex-col md:flex-row overflow-hidden
                    transition-all duration-300 ease-[var(--ease-spring)] motion-reduce:transition-none
                    ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 motion-reduce:scale-100'}
                `}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Sidebar - horizontal on mobile, vertical on desktop */}
                <div className="relative z-10 flex-shrink-0 p-3 md:p-3 border-b md:border-b-0 md:border-r border-[var(--mat-border)] flex flex-col gap-3 md:h-full bg-transparent">
                    <SettingsSidebar
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />
                    <button
                        ref={exitButtonRef}
                        onClick={onClose}
                        className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full text-[13px] font-medium transition-all duration-200 md:mt-auto bg-[var(--color-danger)]/10 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/20 border border-transparent active:scale-95 motion-reduce:active:scale-100"
                        aria-label="Exit settings panel"
                    >
                        <IconExit className="w-4 h-4" />
                        <span>Exit</span>
                    </button>
                </div>

                {/* Content Area - scrollable */}
                <div className="relative z-10 flex-1 p-5 sm:p-6 overflow-hidden flex flex-col min-h-0">
                    {/* Hidden title for accessibility */}
                    <h1 id="settings-panel-title" className="sr-only">
                        Settings Panel
                    </h1>

                    {/* Tab Content with fade transition - wrapped in error boundary */}
                    <SettingsErrorBoundary>
                        <div
                            className="transition-opacity duration-200 ease-in-out min-h-0 flex-1 overflow-y-auto"
                            key={activeTab}
                        >
                            {activeTab === 'model' && <ModelTab />}
                            {activeTab === 'theme' && (
                                <ThemeTab
                                    currentTheme={theme}
                                    onThemeChange={onThemeChange}
                                />
                            )}
                            {activeTab === 'apps' && <AppsTab />}
                            {activeTab === 'mcp' && <McpTab />}
                            {activeTab === 'skills' && <SkillsTab projectPath={currentProjectPath} />}
                        </div>
                    </SettingsErrorBoundary>

                </div>
            </div>
        </div>
    );
};
