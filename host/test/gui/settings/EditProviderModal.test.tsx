/**
 * Settings Panel - EditProviderModal Unit Tests (V2)
 * 
 * Unit tests for EditProviderModal component
 * Requirements: 6.1-6.8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EditProviderModal } from '../../../src/gui/components/settings/EditProviderModal.js';
import type { ProviderConfig, ProviderUpdates } from '../../../src/gui/components/settings/types.js';

describe('EditProviderModal', () => {
    const mockProvider: ProviderConfig = {
        id: 1,
        providerId: 'openai',
        customName: 'My OpenAI Account',
        apiKey: 'sk-test1234567890abcdef',
        isActive: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    const mockHandlers = {
        onClose: vi.fn(),
        onSave: vi.fn().mockResolvedValue(undefined),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Modal rendering', () => {
        it('should not render when isOpen is false', () => {
            render(
                <EditProviderModal
                    isOpen={false}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('should not render when provider is null', () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={null}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('should render when isOpen is true and provider is provided', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });
        });

        it('should display modal title', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Edit Provider')).toBeInTheDocument();
            });
        });

        it('should have aria-modal attribute', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                const dialog = screen.getByRole('dialog');
                expect(dialog).toHaveAttribute('aria-modal', 'true');
            });
        });

        it('should have aria-labelledby attribute', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                const dialog = screen.getByRole('dialog');
                expect(dialog).toHaveAttribute('aria-labelledby', 'edit-provider-modal-title');
            });
        });

        it('should display close button', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
            });
        });
    });

    describe('Form pre-fill', () => {
        it('should pre-fill custom name with existing value', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                const customNameInput = screen.getByLabelText('Custom Name *') as HTMLInputElement;
                expect(customNameInput.value).toBe('My OpenAI Account');
            });
        });

        it('should pre-fill API key with masked value', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                const apiKeyInput = screen.getByLabelText('API Key *') as HTMLInputElement;
                // Should show masked key with last 4 characters
                expect(apiKeyInput.value).toMatch(/^•+cdef$/);
            });
        });

        it('should display provider ID as read-only', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('openai')).toBeInTheDocument();
                expect(screen.getByText('Provider cannot be changed')).toBeInTheDocument();
            });
        });

        it('should display provider logo', async () => {
            const { container } = render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                // Check for logo image or fallback
                const logos = container.querySelectorAll('img[alt*="logo"], [title*="OpenAI"]');
                expect(logos.length).toBeGreaterThan(0);
            });
        });

        it('should update form when provider changes', async () => {
            const { rerender } = render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                const customNameInput = screen.getByLabelText('Custom Name *') as HTMLInputElement;
                expect(customNameInput.value).toBe('My OpenAI Account');
            });

            // Change provider
            const newProvider: ProviderConfig = {
                ...mockProvider,
                id: 2,
                providerId: 'anthropic',
                customName: 'My Anthropic Account',
                apiKey: 'sk-ant-9876543210',
            };

            rerender(
                <EditProviderModal
                    isOpen={true}
                    provider={newProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                const customNameInput = screen.getByLabelText('Custom Name *') as HTMLInputElement;
                expect(customNameInput.value).toBe('My Anthropic Account');
                expect(screen.getByText('anthropic')).toBeInTheDocument();
            });
        });
    });

    describe('Input validation', () => {
        it('should show error when custom name is empty', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Clear custom name
            const customNameInput = screen.getByLabelText('Custom Name *') as HTMLInputElement;
            fireEvent.change(customNameInput, { target: { value: '' } });

            // Save button should be disabled
            const saveButton = screen.getByRole('button', { name: /save/i });
            expect(saveButton).toBeDisabled();
        });

        it('should show error when API key is empty', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Clear API key
            const apiKeyInput = screen.getByLabelText('API Key *') as HTMLInputElement;
            fireEvent.change(apiKeyInput, { target: { value: '' } });

            // Save button should be disabled
            const saveButton = screen.getByRole('button', { name: /save/i });
            expect(saveButton).toBeDisabled();
        });

        it('should enable save button when all fields are valid', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Fields are pre-filled, so save button should be enabled
            const saveButton = screen.getByRole('button', { name: /save/i });
            expect(saveButton).not.toBeDisabled();
        });

        it('should clear validation errors when input changes', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Clear custom name to trigger error
            const customNameInput = screen.getByLabelText('Custom Name *') as HTMLInputElement;
            fireEvent.change(customNameInput, { target: { value: '' } });

            // Type in custom name - error should clear
            fireEvent.change(customNameInput, { target: { value: 'Updated Name' } });

            // No error should be visible
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('should display helper text for API key', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Enter new API key or leave as-is to keep current key')).toBeInTheDocument();
            });
        });
    });

    describe('Save/Cancel handlers', () => {
        it('should call onSave with correct data when save button is clicked', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Update custom name
            const customNameInput = screen.getByLabelText('Custom Name *') as HTMLInputElement;
            fireEvent.change(customNameInput, { target: { value: 'Updated OpenAI Account' } });

            // Update API key
            const apiKeyInput = screen.getByLabelText('API Key *') as HTMLInputElement;
            fireEvent.change(apiKeyInput, { target: { value: 'sk-new1234567890abcdef' } });

            // Click save
            const saveButton = screen.getByRole('button', { name: /save/i });
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(mockHandlers.onSave).toHaveBeenCalledWith(1, {
                    customName: 'Updated OpenAI Account',
                    apiKey: 'sk-new1234567890abcdef',
                });
            });
        });

        it('should call onClose after successful save', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Click save (fields are already pre-filled)
            const saveButton = screen.getByRole('button', { name: /save/i });
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(mockHandlers.onClose).toHaveBeenCalled();
            });
        });

        it('should call onClose when cancel button is clicked', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            fireEvent.click(cancelButton);

            expect(mockHandlers.onClose).toHaveBeenCalled();
        });

        it('should call onClose when close button is clicked', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            const closeButton = screen.getByLabelText('Close modal');
            fireEvent.click(closeButton);

            expect(mockHandlers.onClose).toHaveBeenCalled();
        });

        it('should call onClose when backdrop is clicked', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            const backdrop = screen.getByRole('dialog');
            fireEvent.click(backdrop);

            expect(mockHandlers.onClose).toHaveBeenCalled();
        });

        it('should call onClose when Escape key is pressed', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(mockHandlers.onClose).toHaveBeenCalled();
        });

        it('should disable buttons while saving', async () => {
            const slowSave = vi.fn(() => new Promise(resolve => setTimeout(resolve, 1000)));
            
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    onClose={mockHandlers.onClose}
                    onSave={slowSave}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Click save
            const saveButton = screen.getByRole('button', { name: /save/i });
            fireEvent.click(saveButton);

            // Buttons should be disabled while saving
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
                expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
            });
        });

        it('should reset form when modal closes', async () => {
            const { rerender } = render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Update form
            const customNameInput = screen.getByLabelText('Custom Name *') as HTMLInputElement;
            fireEvent.change(customNameInput, { target: { value: 'Changed Name' } });

            // Close modal
            rerender(
                <EditProviderModal
                    isOpen={false}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            // Reopen modal
            rerender(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            // Form should be reset to original values
            await waitFor(() => {
                const input = screen.getByLabelText('Custom Name *') as HTMLInputElement;
                expect(input.value).toBe('My OpenAI Account');
            });
        });

        it('should not call onSave when validation fails', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Clear custom name to make form invalid
            const customNameInput = screen.getByLabelText('Custom Name *') as HTMLInputElement;
            fireEvent.change(customNameInput, { target: { value: '' } });

            // Try to save (button should be disabled)
            const saveButton = screen.getByRole('button', { name: /save/i });
            expect(saveButton).toBeDisabled();

            // onSave should not be called
            expect(mockHandlers.onSave).not.toHaveBeenCalled();
        });

        it('should trim whitespace from inputs before saving', async () => {
            render(
                <EditProviderModal
                    isOpen={true}
                    provider={mockProvider}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(screen.getByRole('dialog')).toBeInTheDocument();
            });

            // Add whitespace to inputs
            const customNameInput = screen.getByLabelText('Custom Name *') as HTMLInputElement;
            fireEvent.change(customNameInput, { target: { value: '  Trimmed Name  ' } });

            const apiKeyInput = screen.getByLabelText('API Key *') as HTMLInputElement;
            fireEvent.change(apiKeyInput, { target: { value: '  sk-trimmed123  ' } });

            // Click save
            const saveButton = screen.getByRole('button', { name: /save/i });
            fireEvent.click(saveButton);

            await waitFor(() => {
                expect(mockHandlers.onSave).toHaveBeenCalledWith(1, {
                    customName: 'Trimmed Name',
                    apiKey: 'sk-trimmed123',
                });
            });
        });
    });
});
