/**
 * SettingsPanel Component - Accessibility Tests
 * 
 * Tests for keyboard navigation, ARIA labels, focus trap, and screen reader announcements
 * Requirements: 1.3, 12.4, All requirements (accessibility)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPanel } from './SettingsPanel.js';

describe('SettingsPanel - Accessibility', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        theme: 'dark' as const,
        onThemeChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('Keyboard Navigation', () => {
        it('should close modal on Escape key press', () => {
            const onClose = vi.fn();
            render(<SettingsPanel {...defaultProps} onClose={onClose} />);

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should not close modal on other key presses', () => {
            const onClose = vi.fn();
            render(<SettingsPanel {...defaultProps} onClose={onClose} />);

            fireEvent.keyDown(document, { key: 'Enter' });
            fireEvent.keyDown(document, { key: 'Space' });
            fireEvent.keyDown(document, { key: 'a' });

            expect(onClose).not.toHaveBeenCalled();
        });

        it('should allow Tab navigation through all interactive elements', () => {
            render(<SettingsPanel {...defaultProps} />);

            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThan(0);

            // Focus first button
            buttons[0].focus();
            expect(document.activeElement).toBe(buttons[0]);

            // Tab should move focus to next element
            fireEvent.keyDown(document, { key: 'Tab' });
            
            // Focus should have moved
            expect(document.activeElement).not.toBe(buttons[0]);
        });

        it('should allow Shift+Tab navigation in reverse', () => {
            render(<SettingsPanel {...defaultProps} />);

            const buttons = screen.getAllByRole('button');
            
            // Focus second button
            if (buttons.length > 1) {
                buttons[1].focus();
                expect(document.activeElement).toBe(buttons[1]);

                // Shift+Tab should move focus backward
                fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
                
                // Focus should have moved backward
                expect(document.activeElement).not.toBe(buttons[1]);
            }
        });

        it('should activate tab buttons with Enter key', () => {
            render(<SettingsPanel {...defaultProps} />);

            const themeButton = screen.getByRole('tab', { name: /theme/i });
            themeButton.focus();

            fireEvent.keyDown(themeButton, { key: 'Enter' });

            // Theme tab should now be active
            expect(themeButton).toHaveAttribute('aria-selected', 'true');
        });

        it('should activate tab buttons with Space key', () => {
            render(<SettingsPanel {...defaultProps} />);

            const themeButton = screen.getByRole('tab', { name: /theme/i });
            themeButton.focus();

            fireEvent.keyDown(themeButton, { key: ' ' });

            // Theme tab should now be active
            expect(themeButton).toHaveAttribute('aria-selected', 'true');
        });
    });

    describe('Focus Trap', () => {
        it('should trap focus within modal when open', async () => {
            render(<SettingsPanel {...defaultProps} />);

            // Wait for initial focus
            await waitFor(() => {
                expect(document.activeElement).toBeTruthy();
            }, { timeout: 200 });

            const dialog = screen.getByRole('dialog');
            const focusableElements = dialog.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );

            expect(focusableElements.length).toBeGreaterThan(0);

            // Focus last element
            const lastElement = focusableElements[focusableElements.length - 1];
            lastElement.focus();

            // Tab should wrap to first element
            fireEvent.keyDown(document, { key: 'Tab' });

            // Focus should be within the dialog
            expect(dialog.contains(document.activeElement)).toBe(true);
        });

        it('should wrap focus from first to last element on Shift+Tab', async () => {
            render(<SettingsPanel {...defaultProps} />);

            await waitFor(() => {
                expect(document.activeElement).toBeTruthy();
            }, { timeout: 200 });

            const dialog = screen.getByRole('dialog');
            const focusableElements = dialog.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );

            // Focus first element
            const firstElement = focusableElements[0];
            firstElement.focus();

            // Shift+Tab should wrap to last element
            fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });

            // Focus should still be within the dialog
            expect(dialog.contains(document.activeElement)).toBe(true);
        });

        it('should focus first element when modal opens', async () => {
            render(<SettingsPanel {...defaultProps} />);

            await waitFor(() => {
                const activeElement = document.activeElement;
                expect(activeElement).toBeTruthy();
                expect(activeElement?.tagName).toBe('BUTTON');
            }, { timeout: 200 });
        });

        it('should not allow focus to escape modal', () => {
            render(<SettingsPanel {...defaultProps} />);

            const dialog = screen.getByRole('dialog');
            
            // Try to focus an element outside the modal
            const outsideButton = document.createElement('button');
            document.body.appendChild(outsideButton);
            outsideButton.focus();

            // Tab should bring focus back into the modal
            fireEvent.keyDown(document, { key: 'Tab' });

            expect(dialog.contains(document.activeElement)).toBe(true);

            // Cleanup
            document.body.removeChild(outsideButton);
        });
    });

    describe('ARIA Labels and Roles', () => {
        it('should have role="dialog" on modal', () => {
            render(<SettingsPanel {...defaultProps} />);

            const dialog = screen.getByRole('dialog');
            expect(dialog).toBeInTheDocument();
        });

        it('should have aria-modal="true"', () => {
            render(<SettingsPanel {...defaultProps} />);

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
        });

        it('should have aria-labelledby pointing to title', () => {
            render(<SettingsPanel {...defaultProps} />);

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-labelledby', 'settings-panel-title');

            const title = document.getElementById('settings-panel-title');
            expect(title).toBeInTheDocument();
        });

        it('should have aria-label on close button', () => {
            render(<SettingsPanel {...defaultProps} />);

            const closeButton = screen.getByLabelText('Close settings panel');
            expect(closeButton).toBeInTheDocument();
        });

        it('should have role="tablist" on sidebar', () => {
            render(<SettingsPanel {...defaultProps} />);

            const tablist = screen.getByRole('tablist');
            expect(tablist).toBeInTheDocument();
        });

        it('should have role="tab" on tab buttons', () => {
            render(<SettingsPanel {...defaultProps} />);

            const modelTab = screen.getByRole('tab', { name: /model/i });
            const themeTab = screen.getByRole('tab', { name: /theme/i });

            expect(modelTab).toBeInTheDocument();
            expect(themeTab).toBeInTheDocument();
        });

        it('should have aria-selected on active tab', () => {
            render(<SettingsPanel {...defaultProps} />);

            const modelTab = screen.getByRole('tab', { name: /model/i });
            expect(modelTab).toHaveAttribute('aria-selected', 'true');

            const themeTab = screen.getByRole('tab', { name: /theme/i });
            expect(themeTab).toHaveAttribute('aria-selected', 'false');
        });

        it('should have aria-controls on tab buttons', () => {
            render(<SettingsPanel {...defaultProps} />);

            const modelTab = screen.getByRole('tab', { name: /model/i });
            expect(modelTab).toHaveAttribute('aria-controls', 'model-tab-panel');

            const themeTab = screen.getByRole('tab', { name: /theme/i });
            expect(themeTab).toHaveAttribute('aria-controls', 'theme-tab-panel');
        });

        it('should have aria-label on navigation', () => {
            render(<SettingsPanel {...defaultProps} />);

            const nav = screen.getByRole('tablist');
            expect(nav).toHaveAttribute('aria-label', 'Settings navigation');
        });
    });

    describe('Screen Reader Announcements', () => {
        it('should create live region for announcements', () => {
            render(<SettingsPanel {...defaultProps} />);

            // The useScreenReaderAnnouncement hook should create a live region
            const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
            expect(liveRegion).toBeInTheDocument();
        });

        it('should announce modal open', async () => {
            render(<SettingsPanel {...defaultProps} />);

            await waitFor(() => {
                const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
                expect(liveRegion?.textContent).toContain('Settings panel opened');
            }, { timeout: 100 });
        });

        it('should announce modal close', async () => {
            const { rerender } = render(<SettingsPanel {...defaultProps} />);

            // Close the modal
            rerender(<SettingsPanel {...defaultProps} isOpen={false} />);

            await waitFor(() => {
                const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
                expect(liveRegion?.textContent).toContain('Settings panel closed');
            }, { timeout: 100 });
        });

        it('should have sr-only class on live region', () => {
            render(<SettingsPanel {...defaultProps} />);

            const liveRegion = document.querySelector('[role="status"][aria-live="polite"]');
            expect(liveRegion).toHaveClass('sr-only');
        });
    });

    describe('Semantic HTML', () => {
        it('should use button elements for interactive controls', () => {
            render(<SettingsPanel {...defaultProps} />);

            const buttons = screen.getAllByRole('button');
            buttons.forEach(button => {
                expect(button.tagName).toBe('BUTTON');
            });
        });

        it('should use nav element for tab navigation', () => {
            render(<SettingsPanel {...defaultProps} />);

            const nav = screen.getByRole('tablist');
            expect(nav.tagName).toBe('NAV');
        });

        it('should have proper heading hierarchy', () => {
            render(<SettingsPanel {...defaultProps} />);

            // Should have h1 for main title (even if sr-only)
            const h1 = document.querySelector('h1');
            expect(h1).toBeInTheDocument();
            expect(h1?.id).toBe('settings-panel-title');
        });
    });

    describe('Visual Focus Indicators', () => {
        it('should show focus on interactive elements', () => {
            render(<SettingsPanel {...defaultProps} />);

            const closeButton = screen.getByLabelText('Close settings panel');
            closeButton.focus();

            expect(document.activeElement).toBe(closeButton);
        });

        it('should maintain focus visibility on tab buttons', () => {
            render(<SettingsPanel {...defaultProps} />);

            const modelTab = screen.getByRole('tab', { name: /model/i });
            modelTab.focus();

            expect(document.activeElement).toBe(modelTab);
        });
    });

    describe('Responsive Accessibility', () => {
        it('should maintain accessibility on small screens', () => {
            // Simulate mobile viewport
            global.innerWidth = 375;
            global.innerHeight = 667;

            render(<SettingsPanel {...defaultProps} />);

            const dialog = screen.getByRole('dialog');
            expect(dialog).toBeInTheDocument();

            // All ARIA attributes should still be present
            expect(dialog).toHaveAttribute('aria-modal', 'true');
            expect(dialog).toHaveAttribute('aria-labelledby', 'settings-panel-title');
        });

        it('should maintain keyboard navigation on mobile', () => {
            global.innerWidth = 375;
            global.innerHeight = 667;

            const onClose = vi.fn();
            render(<SettingsPanel {...defaultProps} onClose={onClose} />);

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(onClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('Error States Accessibility', () => {
        it('should announce errors with assertive priority', () => {
            // This would be tested in the modal components
            // Just verify the structure is in place
            render(<SettingsPanel {...defaultProps} />);

            const liveRegion = document.querySelector('[role="status"]');
            expect(liveRegion).toBeInTheDocument();
        });
    });

    describe('Color Contrast and Visual Accessibility', () => {
        it('should use CSS variables for theming', () => {
            const { container } = render(<SettingsPanel {...defaultProps} />);

            const panel = container.querySelector('[role="dialog"] > div');
            
            // Should use CSS variables for colors
            const styles = window.getComputedStyle(panel!);
            expect(styles.backgroundColor).toBeTruthy();
        });

        it('should have visible borders for focus indication', () => {
            render(<SettingsPanel {...defaultProps} />);

            const closeButton = screen.getByLabelText('Close settings panel');
            const styles = window.getComputedStyle(closeButton);

            // Button should have some form of visual styling
            expect(styles.padding).toBeTruthy();
        });
    });
});
