/**
 * Settings Panel - DeleteConfirmDialog Unit Tests (V2)
 * 
 * Unit tests for DeleteConfirmDialog component
 * Requirements: 6.9, 6.10, 6.11
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DeleteConfirmDialog } from '../../../src/gui/components/settings/DeleteConfirmDialog.js';

describe('DeleteConfirmDialog', () => {
    const mockHandlers = {
        onClose: vi.fn(),
        onConfirm: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Dialog rendering', () => {
        it('should not render when isOpen is false', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={false}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('should render when isOpen is true', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('should display dialog title', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByRole('heading', { name: 'Delete Provider' })).toBeInTheDocument();
        });

        it('should have aria-modal attribute', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
        });

        it('should have aria-labelledby attribute', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-labelledby', 'delete-confirm-dialog-title');
        });

        it('should have aria-describedby attribute', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-describedby', 'delete-confirm-dialog-description');
        });

        it('should display warning icon', () => {
            const { container } = render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // Check for SVG icon
            const icon = container.querySelector('svg');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('Warning messages', () => {
        it('should display provider name in warning message', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="My OpenAI Account"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText(/My OpenAI Account/)).toBeInTheDocument();
        });

        it('should display confirmation question', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
        });

        it('should display warning about permanent deletion', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
            expect(screen.getByText(/permanently removed/)).toBeInTheDocument();
        });

        it('should not display active provider warning when isActive is false', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByText(/This is your active provider/)).not.toBeInTheDocument();
        });

        it('should display active provider warning when isActive is true', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={true}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText(/This is your active provider/)).toBeInTheDocument();
        });

        it('should display warning about clearing active model when isActive is true', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={true}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText(/clear your active model selection/)).toBeInTheDocument();
        });

        it('should display warning about needing to select new provider when isActive is true', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={true}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText(/select a new provider and model/)).toBeInTheDocument();
        });

        it('should display warning emoji when isActive is true', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={true}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText(/⚠️/)).toBeInTheDocument();
        });

        it('should style active provider warning differently', () => {
            const { container } = render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={true}
                    {...mockHandlers}
                />
            );

            // Check for danger color styling
            const warningBox = container.querySelector('[class*="danger"]');
            expect(warningBox).toBeInTheDocument();
        });
    });

    describe('Action buttons', () => {
        it('should display cancel button', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
        });

        it('should display delete button', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByRole('button', { name: /delete provider/i })).toBeInTheDocument();
        });

        it('should call onClose when cancel button is clicked', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            fireEvent.click(cancelButton);

            expect(mockHandlers.onClose).toHaveBeenCalledTimes(1);
            expect(mockHandlers.onConfirm).not.toHaveBeenCalled();
        });

        it('should call onConfirm and onClose when delete button is clicked', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const deleteButton = screen.getByRole('button', { name: /delete provider/i });
            fireEvent.click(deleteButton);

            expect(mockHandlers.onConfirm).toHaveBeenCalledTimes(1);
            expect(mockHandlers.onClose).toHaveBeenCalledTimes(1);
        });

        it('should call onConfirm before onClose', () => {
            const callOrder: string[] = [];
            const trackingHandlers = {
                onClose: vi.fn(() => callOrder.push('close')),
                onConfirm: vi.fn(() => callOrder.push('confirm')),
            };

            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...trackingHandlers}
                />
            );

            const deleteButton = screen.getByRole('button', { name: /delete provider/i });
            fireEvent.click(deleteButton);

            expect(callOrder).toEqual(['confirm', 'close']);
        });

        it('should have danger color on delete button', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const deleteButton = screen.getByRole('button', { name: /delete provider/i });
            // Check that the button has danger styling via class
            expect(deleteButton.className).toContain('bg-danger');
        });
    });

    describe('Backdrop and keyboard interactions', () => {
        it('should call onClose when backdrop is clicked', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const backdrop = screen.getByRole('dialog');
            fireEvent.click(backdrop);

            expect(mockHandlers.onClose).toHaveBeenCalledTimes(1);
        });

        it('should not call onClose when dialog content is clicked', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const title = screen.getByRole('heading', { name: 'Delete Provider' });
            fireEvent.click(title);

            expect(mockHandlers.onClose).not.toHaveBeenCalled();
        });

        it('should call onClose when Escape key is pressed', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(mockHandlers.onClose).toHaveBeenCalledTimes(1);
        });

        it('should not call onClose when other keys are pressed', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            fireEvent.keyDown(document, { key: 'Enter' });
            fireEvent.keyDown(document, { key: 'Space' });
            fireEvent.keyDown(document, { key: 'Tab' });

            expect(mockHandlers.onClose).not.toHaveBeenCalled();
        });

        it('should not call onClose when Escape is pressed and dialog is closed', () => {
            const { rerender } = render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // Close the dialog
            rerender(
                <DeleteConfirmDialog
                    isOpen={false}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // Clear previous calls
            mockHandlers.onClose.mockClear();

            // Press Escape
            fireEvent.keyDown(document, { key: 'Escape' });

            // Should not call onClose since dialog is already closed
            expect(mockHandlers.onClose).not.toHaveBeenCalled();
        });
    });

    describe('Different provider scenarios', () => {
        it('should handle provider with special characters in name', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="My Provider (Test) & Co."
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText(/My Provider \(Test\) & Co\./)).toBeInTheDocument();
        });

        it('should handle very long provider names', () => {
            const longName = 'A'.repeat(100);
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName={longName}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText(new RegExp(longName))).toBeInTheDocument();
        });

        it('should handle empty provider name gracefully', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName=""
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // Dialog should still render
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('should display different warning for active vs non-active providers', () => {
            const { rerender } = render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // Non-active: no special warning
            expect(screen.queryByText(/active provider/)).not.toBeInTheDocument();

            // Rerender as active
            rerender(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={true}
                    {...mockHandlers}
                />
            );

            // Active: special warning should appear
            expect(screen.getByText(/active provider/)).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA attributes', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
            expect(dialog).toHaveAttribute('aria-labelledby');
            expect(dialog).toHaveAttribute('aria-describedby');
        });

        it('should have accessible button labels', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /delete provider/i })).toBeInTheDocument();
        });

        it('should be keyboard navigable', () => {
            render(
                <DeleteConfirmDialog
                    isOpen={true}
                    providerName="OpenAI"
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            const deleteButton = screen.getByRole('button', { name: /delete provider/i });

            // Both buttons should be focusable
            cancelButton.focus();
            expect(document.activeElement).toBe(cancelButton);

            deleteButton.focus();
            expect(document.activeElement).toBe(deleteButton);
        });
    });
});
