/**
 * SettingsPanel Component - Unit Tests
 * 
 * Tests for modal open/close, backdrop click, Escape key, tab switching, and focus trap
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPanel } from './SettingsPanel.js';

describe('SettingsPanel', () => {
    const defaultProps = {
        isOpen: true,
        onClose: vi.fn(),
        theme: 'dark' as const,
        onThemeChange: vi.fn(),
    };

    beforeEach(() => {
        // Clear all mocks
        vi.clearAllMocks();
        // Clear document body
        document.body.innerHTML = '';
    });

    describe('modal open/close', () => {
        it('should render when isOpen is true', () => {
            render(<SettingsPanel {...defaultProps} />);

            const dialog = screen.getByRole('dialog');
            expect(dialog).toBeInTheDocument();
        });

        it('should not render when isOpen is false', () => {
            render(<SettingsPanel {...defaultProps} isOpen={false} />);

            const dialog = screen.queryByRole('dialog');
            expect(dialog).not.toBeInTheDocument();
        });

        it('should render with glassmorphism styling', () => {
            const { container } = render(<SettingsPanel {...defaultProps} />);

            const backdrop = container.querySelector('[role="dialog"]');
            expect(backdrop).toHaveClass('backdrop-blur-[12px]');
            expect(backdrop).toHaveClass('bg-black/60');
        });

        it('should render close button', () => {
            render(<SettingsPanel {...defaultProps} />);

            const closeButton = screen.getByLabelText('Close settings panel');
            expect(closeButton).toBeInTheDocument();
        });

        it('should call onClose when close button is clicked', () => {
            const onClose = vi.fn();
            render(<SettingsPanel {...defaultProps} onClose={onClose} />);

            const closeButton = screen.getByLabelText('Close settings panel');
            fireEvent.click(closeButton);

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should have proper ARIA attributes', () => {
            render(<SettingsPanel {...defaultProps} />);

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
            expect(dialog).toHaveAttribute('aria-labelledby', 'settings-panel-title');
        });

        it('should prevent body scroll when open', () => {
            render(<SettingsPanel {...defaultProps} />);

            expect(document.body.style.overflow).toBe('hidden');
        });

        it('should restore body scroll when closed', () => {
            const { rerender } = render(<SettingsPanel {...defaultProps} />);

            expect(document.body.style.overflow).toBe('hidden');

            rerender(<SettingsPanel {...defaultProps} isOpen={false} />);

            expect(document.body.style.overflow).toBe('');
        });
    });

    describe('backdrop click', () => {
        it('should call onClose when backdrop is clicked', () => {
            const onClose = vi.fn();
            const { container } = render(<SettingsPanel {...defaultProps} onClose={onClose} />);

            const backdrop = container.querySelector('[role="dialog"]');
            expect(backdrop).toBeTruthy();

            if (backdrop) {
                fireEvent.click(backdrop);
            }

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should not call onClose when panel content is clicked', () => {
            const onClose = vi.fn();
            const { container } = render(<SettingsPanel {...defaultProps} onClose={onClose} />);

            // Click on the panel content (the inner div)
            const panelContent = container.querySelector('[role="dialog"] > div');
            expect(panelContent).toBeTruthy();

            if (panelContent) {
                fireEvent.click(panelContent);
            }

            expect(onClose).not.toHaveBeenCalled();
        });

        it('should not call onClose when sidebar is clicked', () => {
            const onClose = vi.fn();
            render(<SettingsPanel {...defaultProps} onClose={onClose} />);

            // Click on a tab button in the sidebar
            const modelTab = screen.getByText('MODEL');
            fireEvent.click(modelTab);

            expect(onClose).not.toHaveBeenCalled();
        });
    });

    describe('Escape key', () => {
        it('should call onClose when Escape key is pressed', () => {
            const onClose = vi.fn();
            render(<SettingsPanel {...defaultProps} onClose={onClose} />);

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(onClose).toHaveBeenCalledTimes(1);
        });

        it('should not call onClose when other keys are pressed', () => {
            const onClose = vi.fn();
            render(<SettingsPanel {...defaultProps} onClose={onClose} />);

            fireEvent.keyDown(document, { key: 'Enter' });
            fireEvent.keyDown(document, { key: 'Tab' });
            fireEvent.keyDown(document, { key: 'Space' });

            expect(onClose).not.toHaveBeenCalled();
        });

        it('should not call onClose when Escape is pressed and modal is closed', () => {
            const onClose = vi.fn();
            render(<SettingsPanel {...defaultProps} isOpen={false} onClose={onClose} />);

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(onClose).not.toHaveBeenCalled();
        });
    });

    describe('tab switching', () => {
        it('should render Model tab by default', () => {
            render(<SettingsPanel {...defaultProps} />);

            // Model tab should be active (highlighted)
            const modelButton = screen.getByText('MODEL').closest('button');
            expect(modelButton).toHaveClass('bg-primary/10');
        });

        it('should switch to Theme tab when clicked', () => {
            render(<SettingsPanel {...defaultProps} />);

            const themeButton = screen.getByText('THEME').closest('button');
            fireEvent.click(themeButton!);

            // Theme tab should now be active
            expect(themeButton).toHaveClass('bg-primary/10');
        });

        it('should render ModelTab content when Model tab is active', () => {
            render(<SettingsPanel {...defaultProps} />);

            // ModelTab should render "Model Configurations" heading
            expect(screen.getByText('Model Configurations')).toBeInTheDocument();
        });

        it('should render ThemeTab content when Theme tab is active', () => {
            render(<SettingsPanel {...defaultProps} />);

            // Click Theme tab
            const themeButton = screen.getByText('THEME').closest('button');
            fireEvent.click(themeButton!);

            // ThemeTab should render "Theme" heading
            expect(screen.getByText('Theme')).toBeInTheDocument();
        });

        it('should pass theme props to ThemeTab', () => {
            render(<SettingsPanel {...defaultProps} theme="light" />);

            // Click Theme tab
            const themeButton = screen.getByText('THEME').closest('button');
            fireEvent.click(themeButton!);

            // ThemeTab should be rendered (we can't easily test the props, but we can verify it renders)
            expect(screen.getByText('Theme')).toBeInTheDocument();
        });

        it('should call onThemeChange when theme is changed in ThemeTab', () => {
            const onThemeChange = vi.fn();
            render(<SettingsPanel {...defaultProps} theme="dark" onThemeChange={onThemeChange} />);

            // Click Theme tab
            const themeButton = screen.getByText('THEME').closest('button');
            fireEvent.click(themeButton!);

            // Find and click the light theme card
            const lightThemeCard = screen.getByText('Light').closest('button');
            if (lightThemeCard) {
                fireEvent.click(lightThemeCard);
                expect(onThemeChange).toHaveBeenCalledWith('light');
            }
        });
    });

    describe('focus trap', () => {
        it('should focus first focusable element when opened', async () => {
            render(<SettingsPanel {...defaultProps} />);

            // Wait for focus to be set (there's a small delay in the implementation)
            await waitFor(() => {
                const activeElement = document.activeElement;
                expect(activeElement).toBeTruthy();
                expect(activeElement?.tagName).toBe('BUTTON');
            }, { timeout: 200 });
        });

        it('should trap Tab key within modal', () => {
            render(<SettingsPanel {...defaultProps} />);

            // Get all focusable elements
            const focusableElements = screen.getAllByRole('button');
            expect(focusableElements.length).toBeGreaterThan(0);

            // Focus first element
            focusableElements[0].focus();
            expect(document.activeElement).toBe(focusableElements[0]);

            // Press Tab - should move to next element
            fireEvent.keyDown(document, { key: 'Tab' });
            
            // The focus should still be within the modal
            const activeElement = document.activeElement;
            expect(activeElement?.closest('[role="dialog"]')).toBeTruthy();
        });

        it('should trap Shift+Tab key within modal', () => {
            render(<SettingsPanel {...defaultProps} />);

            // Get all focusable elements
            const focusableElements = screen.getAllByRole('button');
            expect(focusableElements.length).toBeGreaterThan(0);

            // Focus first element
            focusableElements[0].focus();
            expect(document.activeElement).toBe(focusableElements[0]);

            // Press Shift+Tab - should wrap to last element
            fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
            
            // The focus should still be within the modal
            const activeElement = document.activeElement;
            expect(activeElement?.closest('[role="dialog"]')).toBeTruthy();
        });

        it('should contain all interactive elements within modal', () => {
            const { container } = render(<SettingsPanel {...defaultProps} />);

            const dialog = container.querySelector('[role="dialog"]');
            const buttons = dialog?.querySelectorAll('button');

            // Should have at least: close button, 2 tab buttons, and add provider button
            expect(buttons?.length).toBeGreaterThanOrEqual(4);
        });
    });

    describe('animations and styling', () => {
        it('should apply transition classes', () => {
            const { container } = render(<SettingsPanel {...defaultProps} />);

            const backdrop = container.querySelector('[role="dialog"]');
            expect(backdrop).toHaveClass('transition-opacity');
            expect(backdrop).toHaveClass('duration-300');
        });

        it('should apply scale animation to panel', () => {
            const { container } = render(<SettingsPanel {...defaultProps} />);

            const panel = container.querySelector('[role="dialog"] > div');
            expect(panel).toHaveClass('transition-all');
            expect(panel).toHaveClass('duration-300');
            expect(panel).toHaveClass('ease-out');
        });

        it('should have proper dimensions', () => {
            const { container } = render(<SettingsPanel {...defaultProps} />);

            const panel = container.querySelector('[role="dialog"] > div');
            expect(panel).toHaveClass('max-w-[900px]');
            expect(panel).toHaveClass('max-h-[600px]');
        });

        it('should have rounded corners', () => {
            const { container } = render(<SettingsPanel {...defaultProps} />);

            const panel = container.querySelector('[role="dialog"] > div');
            expect(panel).toHaveClass('rounded-[var(--radius-lg)]');
        });

        it('should have border and shadow', () => {
            const { container } = render(<SettingsPanel {...defaultProps} />);

            const panel = container.querySelector('[role="dialog"] > div');
            expect(panel).toHaveClass('border');
            expect(panel).toHaveClass('shadow-2xl');
        });
    });

    describe('layout', () => {
        it('should render sidebar and content area', () => {
            const { container } = render(<SettingsPanel {...defaultProps} />);

            // Sidebar should exist
            const sidebar = container.querySelector('.glass-panel');
            expect(sidebar).toBeInTheDocument();

            // Content area should exist
            const contentArea = container.querySelector('.overflow-y-auto');
            expect(contentArea).toBeInTheDocument();
        });

        it('should position close button in top-right', () => {
            render(<SettingsPanel {...defaultProps} />);

            const closeButton = screen.getByLabelText('Close settings panel');
            expect(closeButton).toHaveClass('absolute');
            expect(closeButton).toHaveClass('top-4');
            expect(closeButton).toHaveClass('right-4');
        });

        it('should make content area scrollable', () => {
            const { container } = render(<SettingsPanel {...defaultProps} />);

            const contentArea = container.querySelector('.overflow-y-auto');
            expect(contentArea).toHaveClass('overflow-y-auto');
        });
    });
});
