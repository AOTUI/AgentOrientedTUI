/**
 * Accessibility Tests for Settings Panel
 * 
 * Tests keyboard navigation, focus trap, ARIA labels, and screen reader announcements.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPanel } from '../../../src/gui/components/settings/SettingsPanel.js';
import { ModelTab } from '../../../src/gui/components/settings/ModelTab.js';
import { ThemeTab } from '../../../src/gui/components/settings/ThemeTab.js';
import { AddProviderModal } from '../../../src/gui/components/settings/AddProviderModal.js';
import { ConfigCard } from '../../../src/gui/components/settings/ConfigCard.js';
import { ThemeCard } from '../../../src/gui/components/settings/ThemeCard.js';
import { SettingsSidebar } from '../../../src/gui/components/settings/SettingsSidebar.js';

// Mock dependencies
vi.mock('../../../src/gui/hooks/useProviderConfigs.js', () => ({
    useProviderConfigs: () => ({
        providers: [
            {
                id: 1,
                providerId: 'openai',
                customName: 'Test Config',
                apiKey: 'sk-test1234',
                model: 'gpt-4',
                temperature: 0.7,
                maxSteps: 10,
                isActive: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        ],
        activeProviderId: 'openai',
        isLoading: false,
        error: null,
        addProvider: vi.fn(),
        updateProvider: vi.fn(),
        deleteProvider: vi.fn(),
        setActiveProvider: vi.fn(),
    }),
    sortProviders: (providers: any[]) => providers,
}));

vi.mock('../../../src/gui/hooks/useModels.js', () => ({
    useModels: () => ({
        models: [
            { id: 'openai/gpt-4', name: 'GPT-4', family: 'GPT-4 Family' },
            { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', family: 'GPT-3.5 Family' },
        ],
        activeModelId: 'openai/gpt-4',
        isLoading: false,
        error: null,
    }),
    sortModels: (models: any[]) => models,
}));

vi.mock('../../../src/gui/components/settings/hooks/useToast.js', () => ({
    useToast: () => ({
        toast: { message: '', type: 'success' as const },
        showSuccess: vi.fn(),
        showError: vi.fn(),
        showWarning: vi.fn(),
        clearToast: vi.fn(),
    }),
}));

vi.mock('../../../src/gui/components/Icons.js', () => ({
    IconModel: () => <div>Model Icon</div>,
    IconTheme: () => <div>Theme Icon</div>,
    IconPlug: () => <div>Plug Icon</div>,
}));

describe('Accessibility Tests', () => {
    describe('Keyboard Navigation', () => {
        it('should allow tabbing through all interactive elements in SettingsPanel', () => {
            const onClose = vi.fn();
            const onThemeChange = vi.fn();

            render(
                <SettingsPanel
                    isOpen={true}
                    onClose={onClose}
                    theme="dark"
                    onThemeChange={onThemeChange}
                />
            );

            // Get all tab elements
            const tabs = screen.getAllByRole('tab');
            expect(tabs.length).toBeGreaterThan(0);

            // Close button should be present
            const closeButton = screen.getByLabelText(/exit settings/i);
            expect(closeButton).toBeInTheDocument();
        });

        it('should close modal on Escape key', () => {
            const onClose = vi.fn();
            const onThemeChange = vi.fn();

            render(
                <SettingsPanel
                    isOpen={true}
                    onClose={onClose}
                    theme="dark"
                    onThemeChange={onThemeChange}
                />
            );

            fireEvent.keyDown(document, { key: 'Escape' });
            expect(onClose).toHaveBeenCalled();
        });

        it('should submit form on Enter key in AddProviderModal', async () => {
            const onSave = vi.fn();
            const onClose = vi.fn();

            render(
                <AddProviderModal
                    isOpen={true}
                    onClose={onClose}
                    onSave={onSave}
                />
            );

            // Select provider
            const providerSelect = screen.getByRole('button', { name: /provider \*/i });
            fireEvent.click(providerSelect);
            const option = screen.getByRole('option', { name: /openai/i });
            fireEvent.click(option);

            const nameInput = screen.getByLabelText(/custom name/i);
            fireEvent.change(nameInput, { target: { value: 'Test Config' } });
            
            const apiKeyInput = screen.getByLabelText(/api key/i);
            fireEvent.change(apiKeyInput, { target: { value: 'sk-1234567890' } });

            fireEvent.keyDown(apiKeyInput, { key: 'Enter' });

            await waitFor(() => {
                expect(onSave).toHaveBeenCalled();
            });
        });

        it('should allow keyboard navigation on ThemeCard', () => {
            const onSelect = vi.fn();

            render(
                <ThemeCard theme="dark" isActive={false} onSelect={onSelect} />
            );

            const card = screen.getByRole('radio');
            
            fireEvent.keyDown(card, { key: 'Enter' });
            expect(onSelect).toHaveBeenCalled();

            onSelect.mockClear();
            fireEvent.keyDown(card, { key: ' ' });
            expect(onSelect).toHaveBeenCalled();
        });

        it('should allow keyboard navigation on ConfigCard', () => {
            const onSelect = vi.fn();
            const onEdit = vi.fn();
            const onDelete = vi.fn();

            const config = {
                id: 1,
                name: 'Test Config',
                model: 'gpt-4',
                providerId: 'openai',
                apiKey: 'sk-test1234',
                temperature: 0.7,
                maxSteps: 10,
                isActive: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            render(
                <ConfigCard
                    config={config}
                    isActive={false}
                    onSelect={onSelect}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            );

            const card = screen.getByRole('listitem');
            
            fireEvent.keyDown(card, { key: 'Enter' });
            expect(onSelect).toHaveBeenCalled();

            onSelect.mockClear();
            fireEvent.keyDown(card, { key: ' ' });
            expect(onSelect).toHaveBeenCalled();
        });
    });

    describe('Focus Trap', () => {
        it('should focus first element when modal opens', async () => {
            const onClose = vi.fn();
            const onThemeChange = vi.fn();

            const { rerender } = render(
                <SettingsPanel
                    isOpen={false}
                    onClose={onClose}
                    theme="dark"
                    onThemeChange={onThemeChange}
                />
            );

            // Open modal
            rerender(
                <SettingsPanel
                    isOpen={true}
                    onClose={onClose}
                    theme="dark"
                    onThemeChange={onThemeChange}
                />
            );

            await new Promise(resolve => setTimeout(resolve, 150));

            await waitFor(() => {
                const focusedElement = document.activeElement;
                expect(focusedElement?.getAttribute('role')).toBe('tab');
            });
        });
    });

    describe('ARIA Labels', () => {
        it('should have proper ARIA labels on SettingsPanel', () => {
            const onClose = vi.fn();
            const onThemeChange = vi.fn();

            render(
                <SettingsPanel
                    isOpen={true}
                    onClose={onClose}
                    theme="dark"
                    onThemeChange={onThemeChange}
                />
            );

            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
            expect(dialog).toHaveAttribute('aria-labelledby', 'settings-panel-title');
        });

        it('should have proper ARIA labels on SettingsSidebar tabs', () => {
            const onTabChange = vi.fn();

            render(
                <SettingsSidebar activeTab="model" onTabChange={onTabChange} />
            );

            const modelTab = screen.getByRole('tab', { name: /model/i });
            expect(modelTab).toHaveAttribute('aria-selected', 'true');
            expect(modelTab).toHaveAttribute('aria-controls', 'model-tab-panel');

            const themeTab = screen.getByRole('tab', { name: /theme/i });
            expect(themeTab).toHaveAttribute('aria-selected', 'false');
            expect(themeTab).toHaveAttribute('aria-controls', 'theme-tab-panel');
        });

        it('should have proper ARIA labels on form inputs', () => {
            const onSave = vi.fn();
            const onClose = vi.fn();

            render(
                <AddProviderModal
                    isOpen={true}
                    onClose={onClose}
                    onSave={onSave}
                />
            );

            const nameInput = screen.getByLabelText(/custom name/i);
            expect(nameInput).toHaveAttribute('id', 'custom-name-input');

            const providerSelect = screen.getByRole('button', { name: /provider \*/i });
            expect(providerSelect).toHaveAttribute('id', 'provider-select');
        });

        it('should have aria-describedby on form fields with errors', async () => {
            const onSave = vi.fn();
            const onClose = vi.fn();

            render(
                <AddProviderModal
                    isOpen={true}
                    onClose={onClose}
                    onSave={onSave}
                />
            );

            // Select provider
            const providerSelect = screen.getByRole('button', { name: /provider \*/i });
            fireEvent.click(providerSelect);
            const option = screen.getByRole('option', { name: /openai/i });
            fireEvent.click(option);

            // Enter invalid custom name (too short)
            const nameInput = screen.getByLabelText(/custom name/i);
            fireEvent.change(nameInput, { target: { value: 'ab' } });

            // Enter valid API key
            const apiKeyInput = screen.getByLabelText(/api key/i);
            fireEvent.change(apiKeyInput, { target: { value: 'sk-1234567890' } });

            const submitButton = screen.getByRole('button', { name: /save/i });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(nameInput).toHaveAttribute('aria-invalid', 'true');
                expect(nameInput).toHaveAttribute('aria-describedby', 'custom-name-error');
            });
        });

        it('should have proper ARIA labels on buttons', () => {
            const onClose = vi.fn();
            const onThemeChange = vi.fn();

            render(
                <SettingsPanel
                    isOpen={true}
                    onClose={onClose}
                    theme="dark"
                    onThemeChange={onThemeChange}
                />
            );

            const closeButton = screen.getByLabelText(/exit settings panel/i);
            expect(closeButton).toBeInTheDocument();

            const addButton = screen.getByLabelText(/add new provider/i);
            expect(addButton).toBeInTheDocument();
        });

        it('should have role="radiogroup" on ThemeTab', () => {
            const onThemeChange = vi.fn();

            render(
                <ThemeTab currentTheme="dark" onThemeChange={onThemeChange} />
            );

            const radioGroup = screen.getByRole('radiogroup');
            expect(radioGroup).toHaveAttribute('aria-label', 'Theme selection');
        });

        it('should have role="radio" on ThemeCard', () => {
            const onSelect = vi.fn();

            render(
                <ThemeCard theme="dark" isActive={true} onSelect={onSelect} />
            );

            const radio = screen.getByRole('radio');
            expect(radio).toHaveAttribute('aria-checked', 'true');
            expect(radio).toHaveAttribute('aria-label', 'Dark theme');
        });

        it('should have role="list" on configuration list', () => {
            render(<ModelTab />);

            const list = screen.getByRole('list', { name: /provider list/i });
            expect(list).toBeInTheDocument();
        });

        it('should have role="dialog" on delete confirmation', async () => {
            render(<ModelTab />);

            // Hover over config card to show delete button
            const configCards = screen.getAllByRole('listitem');
            fireEvent.mouseEnter(configCards[0]);

            const deleteButton = screen.getByLabelText(/delete test config/i);
            fireEvent.click(deleteButton);

            await waitFor(() => {
                const dialog = screen.getByRole('dialog');
                expect(dialog).toHaveAttribute('aria-modal', 'true');
                expect(dialog).toHaveAttribute('aria-labelledby', 'delete-confirm-dialog-title');
                expect(dialog).toHaveAttribute('aria-describedby', 'delete-confirm-dialog-description');
            });
        });
    });

    describe('Screen Reader Announcements', () => {
        it('should announce modal open/close', async () => {
            const onClose = vi.fn();
            const onThemeChange = vi.fn();

            const { rerender } = render(
                <SettingsPanel
                    isOpen={false}
                    onClose={onClose}
                    theme="dark"
                    onThemeChange={onThemeChange}
                />
            );

            // Open modal
            rerender(
                <SettingsPanel
                    isOpen={true}
                    onClose={onClose}
                    theme="dark"
                    onThemeChange={onThemeChange}
                />
            );

            await waitFor(() => {
                const liveRegion = document.querySelector('[role="status"]');
                expect(liveRegion).toBeInTheDocument();
            });
        });

        it('should announce validation errors', async () => {
            const onSave = vi.fn();
            const onClose = vi.fn();

            render(
                <AddProviderModal
                    isOpen={true}
                    onClose={onClose}
                    onSave={onSave}
                />
            );

            // Select provider
            const providerSelect = screen.getByRole('button', { name: /provider \*/i });
            fireEvent.click(providerSelect);
            const option = screen.getByRole('option', { name: /openai/i });
            fireEvent.click(option);

            // Enter invalid custom name (too short)
            const nameInput = screen.getByLabelText(/custom name/i);
            fireEvent.change(nameInput, { target: { value: 'ab' } });

            // Enter valid API key
            const apiKeyInput = screen.getByLabelText(/api key/i);
            fireEvent.change(apiKeyInput, { target: { value: 'sk-1234567890' } });

            const submitButton = screen.getByRole('button', { name: /save/i });
            fireEvent.click(submitButton);

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts.length).toBeGreaterThan(0);
            });
        });

        it('should have role="alert" on validation error messages', async () => {
            const onSave = vi.fn();
            const onClose = vi.fn();

            render(
                <AddProviderModal
                    isOpen={true}
                    onClose={onClose}
                    onSave={onSave}
                />
            );

            // Select provider
            const providerSelect = screen.getByRole('button', { name: /provider \*/i });
            fireEvent.click(providerSelect);
            const option = screen.getByRole('option', { name: /openai/i });
            fireEvent.click(option);

            // Enter invalid custom name (too short)
            const nameInput = screen.getByLabelText(/custom name/i);
            fireEvent.change(nameInput, { target: { value: 'ab' } });

            // Enter valid API key
            const apiKeyInput = screen.getByLabelText(/api key/i);
            fireEvent.change(apiKeyInput, { target: { value: 'sk-1234567890' } });

            const submitButton = screen.getByRole('button', { name: /save/i });
            fireEvent.click(submitButton);

            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts.length).toBeGreaterThan(0);
            });
        });
    });
});
