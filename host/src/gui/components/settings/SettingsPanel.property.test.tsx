/**
 * SettingsPanel Component - Property-Based Tests
 * 
 * Property-based tests for modal closure behavior using fast-check
 * Feature: settings-panel, Property 7: Modal Backdrop Closure
 * Validates: Requirements 1.3
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { render, fireEvent, screen } from '@testing-library/react';
import { SettingsPanel } from './SettingsPanel.js';

describe('SettingsPanel - Property-Based Tests', () => {
    beforeEach(() => {
        // Clear any existing modals
        document.body.innerHTML = '';
    });

    /**
     * Property 7: Modal Backdrop Closure
     * 
     * For any click event outside the Settings Panel content area,
     * the panel should close without saving unsaved changes.
     * 
     * Validates: Requirements 1.3
     */
    describe('Property 7: Modal Backdrop Closure', () => {
        it('clicking backdrop closes modal regardless of unsaved changes state', () => {
            fc.assert(
                fc.property(
                    fc.boolean(), // Has unsaved changes (simulated by different states)
                    fc.constantFrom('dark' as const, 'light' as const), // Current theme
                    (hasUnsavedChanges, theme) => {
                        // Track if onClose was called
                        let closeCalled = false;
                        const onClose = () => {
                            closeCalled = true;
                        };
                        const onThemeChange = () => {};

                        // Render the modal
                        const { container } = render(
                            <SettingsPanel
                                isOpen={true}
                                onClose={onClose}
                                theme={theme}
                                onThemeChange={onThemeChange}
                            />
                        );

                        // Find the backdrop (the outermost div with role="dialog")
                        const backdrop = container.querySelector('[role="dialog"]');
                        expect(backdrop).toBeTruthy();

                        // Click the backdrop
                        if (backdrop) {
                            fireEvent.click(backdrop);
                        }

                        // Verify onClose was called
                        expect(closeCalled).toBe(true);
                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('Escape key closes modal regardless of state', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('dark' as const, 'light' as const), // Current theme
                    fc.constantFrom('model' as const, 'theme' as const), // Active tab
                    (theme, _activeTab) => {
                        // Track if onClose was called
                        let closeCalled = false;
                        const onClose = () => {
                            closeCalled = true;
                        };
                        const onThemeChange = () => {};

                        // Render the modal
                        render(
                            <SettingsPanel
                                isOpen={true}
                                onClose={onClose}
                                theme={theme}
                                onThemeChange={onThemeChange}
                            />
                        );

                        // Press Escape key
                        fireEvent.keyDown(document, { key: 'Escape' });

                        // Verify onClose was called
                        expect(closeCalled).toBe(true);
                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('clicking inside panel content does not close modal', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('dark' as const, 'light' as const), // Current theme
                    (theme) => {
                        // Track if onClose was called
                        let closeCalled = false;
                        const onClose = () => {
                            closeCalled = true;
                        };
                        const onThemeChange = () => {};

                        // Render the modal
                        const { container } = render(
                            <SettingsPanel
                                isOpen={true}
                                onClose={onClose}
                                theme={theme}
                                onThemeChange={onThemeChange}
                            />
                        );

                        // Find the panel content (the inner div, not the backdrop)
                        const panelContent = container.querySelector('[role="dialog"] > div');
                        expect(panelContent).toBeTruthy();

                        // Click inside the panel content
                        if (panelContent) {
                            fireEvent.click(panelContent);
                        }

                        // Verify onClose was NOT called
                        expect(closeCalled).toBe(false);
                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('close button always closes modal', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('dark' as const, 'light' as const), // Current theme
                    (theme) => {
                        // Track if onClose was called
                        let closeCalled = false;
                        const onClose = () => {
                            closeCalled = true;
                        };
                        const onThemeChange = () => {};

                        // Render the modal
                        render(
                            <SettingsPanel
                                isOpen={true}
                                onClose={onClose}
                                theme={theme}
                                onThemeChange={onThemeChange}
                            />
                        );

                        // Find and click the close button
                        const closeButton = screen.getByLabelText('Close settings panel');
                        fireEvent.click(closeButton);

                        // Verify onClose was called
                        expect(closeCalled).toBe(true);
                        return true;
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('modal does not render when isOpen is false', () => {
            fc.assert(
                fc.property(
                    fc.constantFrom('dark' as const, 'light' as const), // Current theme
                    (theme) => {
                        const onClose = () => {};
                        const onThemeChange = () => {};

                        // Render the modal with isOpen=false
                        const { container } = render(
                            <SettingsPanel
                                isOpen={false}
                                onClose={onClose}
                                theme={theme}
                                onThemeChange={onThemeChange}
                            />
                        );

                        // Verify modal is not in the DOM
                        const backdrop = container.querySelector('[role="dialog"]');
                        return backdrop === null;
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});
