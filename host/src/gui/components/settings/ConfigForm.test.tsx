/**
 * Settings Panel - ConfigForm Unit Tests
 * 
 * Unit tests for ConfigForm component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfigForm } from './ConfigForm.js';
import type { LLMConfigRecord, ProviderInfo } from '../../../types/llm-config.js';
import type { ModelsDevModel } from '../../../services/index.js';
import * as useProvidersModule from './hooks/useProviders.js';

// Mock the useProviders hook
vi.mock('./hooks/useProviders.js', () => ({
    useProviders: vi.fn(),
}));

describe('ConfigForm', () => {
    const mockProviders: ProviderInfo[] = [
        { id: 'openai', name: 'OpenAI', requiresApiKey: true },
        { id: 'anthropic', name: 'Anthropic', requiresApiKey: true },
        { id: 'ollama', name: 'Ollama', requiresApiKey: false },
    ];

    const mockModels: ModelsDevModel[] = [
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ];

    const mockEditingConfig: LLMConfigRecord = {
        id: 1,
        name: 'Test Config',
        model: 'gpt-4',
        providerId: 'openai',
        apiKey: 'sk-test1234567890abcdef',
        baseUrl: 'https://api.openai.com',
        temperature: 0.7,
        maxSteps: 10,
        isActive: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    const mockHandlers = {
        onSave: vi.fn().mockResolvedValue(undefined),
        onCancel: vi.fn(),
    };

    const mockFetchModels = vi.fn().mockResolvedValue(mockModels);

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mock implementation
        vi.mocked(useProvidersModule.useProviders).mockReturnValue({
            providers: mockProviders,
            loading: false,
            error: null,
            fetchModelsForProvider: mockFetchModels,
            refresh: vi.fn(),
        });
    });

    describe('Form rendering', () => {
        it('should render all form fields', () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            expect(screen.getByLabelText(/Configuration Name/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Provider/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Model/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Base URL/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Temperature/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/Max Steps/i)).toBeInTheDocument();
        });

        it('should render submit and cancel buttons', () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            expect(screen.getByRole('button', { name: /Create Configuration/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
        });

        it('should show "Update Configuration" button when editing', () => {
            render(
                <ConfigForm
                    editingConfig={mockEditingConfig}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            expect(screen.getByRole('button', { name: /Update Configuration/i })).toBeInTheDocument();
        });

        it('should not show API key field when provider does not require it', () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            // Initially no provider selected, so no API key field
            expect(screen.queryByLabelText(/API Key/i)).not.toBeInTheDocument();
        });
    });

    describe('Provider selection with logo display', () => {
        it('should display all providers in dropdown', () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const providerSelect = screen.getByLabelText(/Provider/i) as HTMLSelectElement;

            expect(providerSelect.options).toHaveLength(4); // 3 providers + "Select a provider"
            expect(providerSelect.options[0].text).toBe('Select a provider');
            expect(providerSelect.options[1].text).toBe('OpenAI');
            expect(providerSelect.options[2].text).toBe('Anthropic');
            expect(providerSelect.options[3].text).toBe('Ollama');
        });

        it('should show ProviderLogo when provider is selected', async () => {
            const { container } = render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const providerSelect = screen.getByLabelText(/Provider/i);
            fireEvent.change(providerSelect, { target: { value: 'openai' } });

            await waitFor(() => {
                const logo = container.querySelector('img[alt="openai logo"]') ||
                    container.querySelector('[title="OpenAI"]');
                expect(logo).toBeInTheDocument();
            });
        });

        it('should show API key field when provider requires it', async () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const providerSelect = screen.getByLabelText(/Provider/i);
            fireEvent.change(providerSelect, { target: { value: 'openai' } });

            await waitFor(() => {
                expect(screen.getByLabelText(/API Key/i)).toBeInTheDocument();
            });
        });

        it('should not show API key field when provider does not require it', async () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const providerSelect = screen.getByLabelText(/Provider/i);
            fireEvent.change(providerSelect, { target: { value: 'ollama' } });

            await waitFor(() => {
                expect(screen.queryByLabelText(/API Key/i)).not.toBeInTheDocument();
            });
        });
    });

    describe('Model loading', () => {
        it('should fetch models when provider is selected', async () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const providerSelect = screen.getByLabelText(/Provider/i);
            fireEvent.change(providerSelect, { target: { value: 'openai' } });

            await waitFor(() => {
                expect(mockFetchModels).toHaveBeenCalledWith('openai');
            });
        });

        it('should show loading state while fetching models', async () => {
            mockFetchModels.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockModels), 100)));

            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const providerSelect = screen.getByLabelText(/Provider/i);
            fireEvent.change(providerSelect, { target: { value: 'openai' } });

            expect(screen.getByText(/Loading models.../i)).toBeInTheDocument();

            await waitFor(() => {
                expect(screen.queryByText(/Loading models.../i)).not.toBeInTheDocument();
            });
        });

        it('should display model dropdown when models are loaded', async () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const providerSelect = screen.getByLabelText(/Provider/i);
            fireEvent.change(providerSelect, { target: { value: 'openai' } });

            await waitFor(() => {
                const modelSelect = screen.getByLabelText(/Model/i) as HTMLSelectElement;
                expect(modelSelect.tagName).toBe('SELECT');
                expect(modelSelect.options).toHaveLength(3); // 2 models + "Select a model"
            });
        });

        it('should display text input when no models are available', async () => {
            mockFetchModels.mockResolvedValue([]);

            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const providerSelect = screen.getByLabelText(/Provider/i);
            fireEvent.change(providerSelect, { target: { value: 'openai' } });

            await waitFor(() => {
                const modelInput = screen.getByLabelText(/Model/i) as HTMLInputElement;
                expect(modelInput.tagName).toBe('INPUT');
                expect(modelInput.type).toBe('text');
            });
        });

        it('should reset model field when provider changes', async () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const providerSelect = screen.getByLabelText(/Provider/i);

            // Select first provider
            fireEvent.change(providerSelect, { target: { value: 'openai' } });

            await waitFor(() => {
                const modelSelect = screen.getByLabelText(/Model/i) as HTMLSelectElement;
                fireEvent.change(modelSelect, { target: { value: 'gpt-4' } });
            });

            // Change provider
            fireEvent.change(providerSelect, { target: { value: 'anthropic' } });

            await waitFor(() => {
                const modelSelect = screen.getByLabelText(/Model/i) as HTMLSelectElement;
                expect(modelSelect.value).toBe('');
            });
        });
    });

    describe('Validation display', () => {
        it('should show validation error for empty name', async () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const submitButton = screen.getByRole('button', { name: /Create Configuration/i });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/Configuration name is required/i)).toBeInTheDocument();
            });
        });

        it('should show validation error for missing provider', async () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const nameInput = screen.getByLabelText(/Configuration Name/i);
            fireEvent.change(nameInput, { target: { value: 'Test Config' } });

            const submitButton = screen.getByRole('button', { name: /Create Configuration/i });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/Provider is required/i)).toBeInTheDocument();
            });
        });

        it('should show validation error for missing model', async () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const nameInput = screen.getByLabelText(/Configuration Name/i);
            fireEvent.change(nameInput, { target: { value: 'Test Config' } });

            const providerSelect = screen.getByLabelText(/Provider/i);
            fireEvent.change(providerSelect, { target: { value: 'openai' } });

            const submitButton = screen.getByRole('button', { name: /Create Configuration/i });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/Model is required/i)).toBeInTheDocument();
            });
        });

        it('should show validation error for missing API key when required', async () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const nameInput = screen.getByLabelText(/Configuration Name/i);
            fireEvent.change(nameInput, { target: { value: 'Test Config' } });

            const providerSelect = screen.getByLabelText(/Provider/i);
            fireEvent.change(providerSelect, { target: { value: 'openai' } });

            await waitFor(() => {
                const modelInput = screen.getByLabelText(/Model/i);
                fireEvent.change(modelInput, { target: { value: 'gpt-4' } });
            });

            const submitButton = screen.getByRole('button', { name: /Create Configuration/i });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/API key is required for this provider/i)).toBeInTheDocument();
            });
        });

        it('should clear validation error when field is corrected', async () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const submitButton = screen.getByRole('button', { name: /Create Configuration/i });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/Configuration name is required/i)).toBeInTheDocument();
            });

            const nameInput = screen.getByLabelText(/Configuration Name/i);
            fireEvent.change(nameInput, { target: { value: 'Test Config' } });

            await waitFor(() => {
                expect(screen.queryByText(/Configuration name is required/i)).not.toBeInTheDocument();
            });
        });
    });

    describe('Submit and cancel handlers', () => {
        it('should call onSave with form data when valid', async () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            // Fill form
            const nameInput = screen.getByLabelText(/Configuration Name/i);
            fireEvent.change(nameInput, { target: { value: 'Test Config' } });

            const providerSelect = screen.getByLabelText(/Provider/i);
            fireEvent.change(providerSelect, { target: { value: 'ollama' } });

            await waitFor(() => {
                const modelInput = screen.getByLabelText(/Model/i);
                fireEvent.change(modelInput, { target: { value: 'llama2' } });
            });

            const submitButton = screen.getByRole('button', { name: /Create Configuration/i });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(mockHandlers.onSave).toHaveBeenCalledWith({
                    name: 'Test Config',
                    providerId: 'ollama',
                    model: 'llama2',
                    apiKey: '',
                    baseUrl: '',
                    temperature: 0.7,
                    maxSteps: 10,
                });
            });
        });

        it('should call onCancel when cancel button is clicked', () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const cancelButton = screen.getByRole('button', { name: /Cancel/i });
            fireEvent.click(cancelButton);

            expect(mockHandlers.onCancel).toHaveBeenCalledTimes(1);
        });

        it('should not call onSave when form is invalid', async () => {
            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            const submitButton = screen.getByRole('button', { name: /Create Configuration/i });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/Configuration name is required/i)).toBeInTheDocument();
            });

            expect(mockHandlers.onSave).not.toHaveBeenCalled();
        });

        it('should disable buttons while saving', async () => {
            mockHandlers.onSave.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

            render(
                <ConfigForm
                    editingConfig={null}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            // Fill form
            const nameInput = screen.getByLabelText(/Configuration Name/i);
            fireEvent.change(nameInput, { target: { value: 'Test Config' } });

            const providerSelect = screen.getByLabelText(/Provider/i);
            fireEvent.change(providerSelect, { target: { value: 'ollama' } });

            await waitFor(() => {
                const modelInput = screen.getByLabelText(/Model/i);
                fireEvent.change(modelInput, { target: { value: 'llama2' } });
            });

            const submitButton = screen.getByRole('button', { name: /Create Configuration/i });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(submitButton).toBeDisabled();
                expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
            });
        });
    });

    describe('Edit mode pre-fill', () => {
        it('should pre-fill form with editing config data', () => {
            render(
                <ConfigForm
                    editingConfig={mockEditingConfig}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            expect((screen.getByLabelText(/Configuration Name/i) as HTMLInputElement).value).toBe('Test Config');
            expect((screen.getByLabelText(/Provider/i) as HTMLSelectElement).value).toBe('openai');
            expect((screen.getByLabelText(/Base URL/i) as HTMLInputElement).value).toBe('https://api.openai.com');
            expect((screen.getByLabelText(/Temperature/i) as HTMLInputElement).value).toBe('0.7');
            expect((screen.getByLabelText(/Max Steps/i) as HTMLInputElement).value).toBe('10');
        });

        it('should load models for editing config provider', async () => {
            render(
                <ConfigForm
                    editingConfig={mockEditingConfig}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                expect(mockFetchModels).toHaveBeenCalledWith('openai');
            });
        });

        it('should pre-fill API key when editing', async () => {
            render(
                <ConfigForm
                    editingConfig={mockEditingConfig}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                const apiKeyInput = screen.getByLabelText(/API Key/i) as HTMLInputElement;
                expect(apiKeyInput.value).toBe('sk-test1234567890abcdef');
            });
        });

        it('should pre-select model when editing', async () => {
            render(
                <ConfigForm
                    editingConfig={mockEditingConfig}
                    providers={mockProviders}
                    {...mockHandlers}
                />
            );

            await waitFor(() => {
                const modelSelect = screen.getByLabelText(/Model/i) as HTMLSelectElement;
                expect(modelSelect.value).toBe('gpt-4');
            });
        });
    });
});
