/**
 * ConfigForm Component
 * 
 * Form for adding or editing model configurations.
 * Integrates with ModelRegistry for provider/model selection.
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { ConfigFormProps, ConfigFormData } from './types.js';
import type { ProviderInfo } from '../../../types/llm-config.js';
import type { ModelsDevModel } from '../../../services/index.js';
import { validateConfigForm } from './validation.js';
import { ProviderLogo } from './ProviderLogo.js';
import { Spinner } from './Spinner.js';
import { useProviders } from './hooks/useProviders.js';
import { useScreenReaderAnnouncement } from './hooks/useScreenReaderAnnouncement.js';

/**
 * ConfigForm Component
 * 
 * Displays a form for creating or editing LLM configurations
 */
export const ConfigForm: React.FC<ConfigFormProps> = ({
    editingConfig,
    providers,
    onSave,
    onCancel,
}) => {
    const { fetchModelsForProvider } = useProviders();
    const { announce } = useScreenReaderAnnouncement();

    // Form state
    const [formData, setFormData] = useState<ConfigFormData>({
        name: '',
        providerId: '',
        model: '',
        apiKey: '',
        baseUrl: '',
        temperature: 0.7,
        maxSteps: 10,
    });

    const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(null);
    const [availableModels, setAvailableModels] = useState<ModelsDevModel[]>([]);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Pre-fill form when editing
    useEffect(() => {
        if (editingConfig) {
            setFormData({
                name: editingConfig.name,
                providerId: editingConfig.providerId || '',
                model: editingConfig.model,
                apiKey: editingConfig.apiKey || '',
                baseUrl: editingConfig.baseUrl || '',
                temperature: editingConfig.temperature,
                maxSteps: editingConfig.maxSteps,
            });

            // Set selected provider
            if (editingConfig.providerId) {
                const provider = providers.find(p => p.id === editingConfig.providerId);
                if (provider) {
                    setSelectedProvider(provider);
                    // Load models for this provider
                    loadModelsForProvider(editingConfig.providerId);
                }
            }
        }
    }, [editingConfig, providers]);

    // Load models when provider is selected
    const loadModelsForProvider = useCallback(async (providerId: string) => {
        setIsLoadingModels(true);
        try {
            const models = await fetchModelsForProvider(providerId);
            setAvailableModels(models);
        } catch (err) {
            console.error('Error loading models:', err);
            setAvailableModels([]);
        } finally {
            setIsLoadingModels(false);
        }
    }, [fetchModelsForProvider]);

    // Handle provider selection
    const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const providerId = e.target.value;
        const provider = providers.find(p => p.id === providerId) || null;

        setFormData(prev => ({
            ...prev,
            providerId,
            model: '', // Reset model when provider changes
        }));
        setSelectedProvider(provider);
        setAvailableModels([]);

        if (providerId) {
            loadModelsForProvider(providerId);
        }
    };

    // Handle field changes
    const handleFieldChange = (field: keyof ConfigFormData, value: any) => {
        setFormData(prev => ({
            ...prev,
            [field]: value,
        }));

        // Clear validation error for this field
        if (validationErrors[field]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate form
        const validation = validateConfigForm(formData, selectedProvider);
        if (!validation.isValid) {
            setValidationErrors(validation.errors);
            // Announce validation errors
            const errorCount = Object.keys(validation.errors).length;
            const errorFields = Object.keys(validation.errors).join(', ');
            announce(`Form has ${errorCount} validation error${errorCount > 1 ? 's' : ''}: ${errorFields}`, 'assertive');
            return;
        }

        // Submit form
        setIsSaving(true);
        try {
            await onSave(formData);
        } catch (err) {
            console.error('Error saving configuration:', err);
            // Error handling is done by parent component
        } finally {
            setIsSaving(false);
        }
    };

    // Handle Enter key press on form inputs
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey && e.target instanceof HTMLInputElement) {
            e.preventDefault();
            handleSubmit(e as any);
        }
    };

    return (
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
            {/* Configuration Name */}
            <div>
                <label htmlFor="config-name" className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Configuration Name
                </label>
                <input
                    id="config-name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleFieldChange('name', e.target.value)}
                    placeholder="e.g., My GPT-4 Config"
                    disabled={isSaving}
                    aria-describedby={validationErrors.name ? "config-name-error" : undefined}
                    aria-invalid={!!validationErrors.name}
                    className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {validationErrors.name && (
                    <p id="config-name-error" className="mt-1 text-sm text-[var(--color-danger)]" role="alert">{validationErrors.name}</p>
                )}
            </div>

            {/* Provider Selection */}
            <div>
                <label htmlFor="provider" className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Provider
                </label>
                <div className="relative">
                    <select
                        id="provider"
                        value={formData.providerId}
                        onChange={handleProviderChange}
                        disabled={isSaving}
                        aria-describedby={validationErrors.providerId ? "provider-error" : undefined}
                        aria-invalid={!!validationErrors.providerId}
                        className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <option value="">Select a provider</option>
                        {providers.map(provider => (
                            <option key={provider.id} value={provider.id}>
                                {provider.name}
                            </option>
                        ))}
                    </select>
                    {selectedProvider && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ProviderLogo
                                providerId={selectedProvider.id}
                                providerName={selectedProvider.name}
                                size="sm"
                            />
                        </div>
                    )}
                </div>
                {validationErrors.providerId && (
                    <p id="provider-error" className="mt-1 text-sm text-[var(--color-danger)]" role="alert">{validationErrors.providerId}</p>
                )}
            </div>

            {/* Model Selection */}
            <div>
                <label htmlFor="model" className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Model
                </label>
                {isLoadingModels ? (
                    <div className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg flex items-center gap-2">
                        <Spinner size="sm" className="text-[var(--color-accent)]" />
                        <span className="text-[var(--color-text-tertiary)]">Loading models...</span>
                    </div>
                ) : availableModels.length > 0 ? (
                    <select
                        id="model"
                        value={formData.model}
                        onChange={(e) => handleFieldChange('model', e.target.value)}
                        className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                        disabled={!formData.providerId || isSaving}
                        aria-describedby={validationErrors.model ? "model-error" : undefined}
                        aria-invalid={!!validationErrors.model}
                    >
                        <option value="">Select a model</option>
                        {availableModels.map(model => (
                            <option key={model.id} value={model.id}>
                                {model.name || model.id}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        id="model"
                        type="text"
                        value={formData.model}
                        onChange={(e) => handleFieldChange('model', e.target.value)}
                        placeholder="Enter model ID (e.g., gpt-4)"
                        className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                        disabled={!formData.providerId || isSaving}
                        aria-describedby={validationErrors.model ? "model-error" : undefined}
                        aria-invalid={!!validationErrors.model}
                    />
                )}
                {validationErrors.model && (
                    <p id="model-error" className="mt-1 text-sm text-[var(--color-danger)]" role="alert">{validationErrors.model}</p>
                )}
            </div>

            {/* API Key (conditional) */}
            {selectedProvider?.requiresApiKey && (
                <div>
                    <label htmlFor="api-key" className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                        API Key
                    </label>
                    <input
                        id="api-key"
                        type="password"
                        value={formData.apiKey}
                        onChange={(e) => handleFieldChange('apiKey', e.target.value)}
                        placeholder="Enter your API key"
                        disabled={isSaving}
                        aria-describedby={validationErrors.apiKey ? "api-key-error" : undefined}
                        aria-invalid={!!validationErrors.apiKey}
                        className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {validationErrors.apiKey && (
                        <p id="api-key-error" className="mt-1 text-sm text-[var(--color-danger)]" role="alert">{validationErrors.apiKey}</p>
                    )}
                </div>
            )}

            {/* Base URL (optional) */}
            <div>
                <label htmlFor="base-url" className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Base URL <span className="text-[var(--color-text-tertiary)]">(Optional)</span>
                </label>
                <input
                    id="base-url"
                    type="text"
                    value={formData.baseUrl}
                    onChange={(e) => handleFieldChange('baseUrl', e.target.value)}
                    placeholder="https://api.example.com"
                    disabled={isSaving}
                    aria-describedby={validationErrors.baseUrl ? "base-url-error" : undefined}
                    aria-invalid={!!validationErrors.baseUrl}
                    className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {validationErrors.baseUrl && (
                    <p id="base-url-error" className="mt-1 text-sm text-[var(--color-danger)]" role="alert">{validationErrors.baseUrl}</p>
                )}
            </div>

            {/* Temperature Slider */}
            <div>
                <label htmlFor="temperature" className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Temperature: {formData.temperature.toFixed(1)}
                </label>
                <input
                    id="temperature"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => handleFieldChange('temperature', parseFloat(e.target.value))}
                    disabled={isSaving}
                    aria-describedby={validationErrors.temperature ? "temperature-error" : "temperature-help"}
                    aria-invalid={!!validationErrors.temperature}
                    aria-valuemin={0}
                    aria-valuemax={1}
                    aria-valuenow={formData.temperature}
                    aria-valuetext={`${formData.temperature.toFixed(1)} - ${formData.temperature < 0.5 ? 'Precise' : 'Creative'}`}
                    className="w-full h-2 bg-[var(--color-bg-elevated)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div id="temperature-help" className="flex justify-between text-xs text-[var(--color-text-tertiary)] mt-1">
                    <span>Precise (0.0)</span>
                    <span>Creative (1.0)</span>
                </div>
                {validationErrors.temperature && (
                    <p id="temperature-error" className="mt-1 text-sm text-[var(--color-danger)]" role="alert">{validationErrors.temperature}</p>
                )}
            </div>

            {/* Max Steps */}
            <div>
                <label htmlFor="max-steps" className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
                    Max Steps
                </label>
                <input
                    id="max-steps"
                    type="number"
                    min="1"
                    value={formData.maxSteps}
                    onChange={(e) => handleFieldChange('maxSteps', parseInt(e.target.value, 10))}
                    disabled={isSaving}
                    aria-describedby={validationErrors.maxSteps ? "max-steps-error" : undefined}
                    aria-invalid={!!validationErrors.maxSteps}
                    className="w-full px-4 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-accent)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {validationErrors.maxSteps && (
                    <p id="max-steps-error" className="mt-1 text-sm text-[var(--color-danger)]" role="alert">{validationErrors.maxSteps}</p>
                )}
            </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-6 py-2 bg-[var(--color-accent)] text-white rounded-full font-medium hover:bg-[var(--color-accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                    {isSaving && <Spinner size="sm" className="text-white" />}
                    {isSaving ? 'Saving...' : editingConfig ? 'Update Configuration' : 'Create Configuration'}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSaving}
                    className="px-6 py-2 bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border border-[var(--color-border)] rounded-lg font-medium hover:border-[var(--color-border-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    Cancel
                </button>
            </div>
        </form>
    );
};
