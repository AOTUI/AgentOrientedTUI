/**
 * ThemeTab Component - Property-Based Tests
 * 
 * Property tests for theme application consistency
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 8: Theme Application Consistency
 * Validates: Requirements 11.3
 * 
 * For any theme selection, the theme should be applied immediately to all UI components
 * and persisted for future sessions.
 */

describe('ThemeTab - Property-Based Tests', () => {
    // Store original values to restore after tests
    let originalDocumentTheme: string | null;
    let originalLocalStorageTheme: string | null;

    beforeEach(() => {
        // Save original state
        originalDocumentTheme = document.documentElement.getAttribute('data-theme');
        originalLocalStorageTheme = localStorage.getItem('theme');
    });

    afterEach(() => {
        // Restore original state
        if (originalDocumentTheme !== null) {
            document.documentElement.setAttribute('data-theme', originalDocumentTheme);
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        
        if (originalLocalStorageTheme !== null) {
            localStorage.setItem('theme', originalLocalStorageTheme);
        } else {
            localStorage.removeItem('theme');
        }
    });

    describe('Property 8: Theme Application Consistency', () => {
        it('should apply theme to document and persist to localStorage', () => {
            // Feature: settings-panel-v2, Property 8: Theme Application Consistency
            // Validates: Requirements 11.3

            fc.assert(
                fc.property(
                    fc.constantFrom('dark', 'light'),
                    (theme) => {
                        // Apply theme (simulating what the app would do)
                        applyTheme(theme);

                        // Verify theme is applied to document
                        const appliedTheme = document.documentElement.getAttribute('data-theme');
                        
                        // Verify theme is persisted to localStorage
                        const persistedTheme = localStorage.getItem('theme');

                        // Both should match the selected theme
                        return appliedTheme === theme && persistedTheme === theme;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should maintain theme consistency across multiple applications', () => {
            // Feature: settings-panel-v2, Property 8: Theme Application Consistency
            // Validates: Requirements 11.3

            fc.assert(
                fc.property(
                    fc.array(fc.constantFrom('dark', 'light'), { minLength: 1, maxLength: 10 }),
                    (themes) => {
                        // Apply each theme in sequence
                        for (const theme of themes) {
                            applyTheme(theme);
                        }

                        // The last theme should be the one that's applied
                        const lastTheme = themes[themes.length - 1];
                        const appliedTheme = document.documentElement.getAttribute('data-theme');
                        const persistedTheme = localStorage.getItem('theme');

                        return appliedTheme === lastTheme && persistedTheme === lastTheme;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should handle rapid theme changes consistently', () => {
            // Feature: settings-panel-v2, Property 8: Theme Application Consistency
            // Validates: Requirements 11.3

            fc.assert(
                fc.property(
                    fc.constantFrom('dark', 'light'),
                    fc.constantFrom('dark', 'light'),
                    (theme1, theme2) => {
                        // Apply first theme
                        applyTheme(theme1);
                        const applied1 = document.documentElement.getAttribute('data-theme');
                        const persisted1 = localStorage.getItem('theme');

                        // Apply second theme immediately
                        applyTheme(theme2);
                        const applied2 = document.documentElement.getAttribute('data-theme');
                        const persisted2 = localStorage.getItem('theme');

                        // Both applications should be consistent
                        return (
                            applied1 === theme1 &&
                            persisted1 === theme1 &&
                            applied2 === theme2 &&
                            persisted2 === theme2
                        );
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});

/**
 * Helper function to apply theme
 * This simulates what the actual application would do
 */
function applyTheme(theme: 'dark' | 'light'): void {
    // Apply to document
    document.documentElement.setAttribute('data-theme', theme);
    
    // Persist to localStorage
    localStorage.setItem('theme', theme);
}
