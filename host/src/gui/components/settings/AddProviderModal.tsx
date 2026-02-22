/**
 * AddProviderModal Component (V2)
 * 
 * Modal for adding new provider configuration.
 * Fetches available providers from models.dev and validates inputs.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useChatBridge } from '../../ChatBridge.js';
import { ProviderLogo } from './ProviderLogo.js';
import { validateProviderConfig } from './validation.js';
import { useScreenReaderAnnouncement } from './hooks/useScreenReaderAnnouncement.js';
import type { AddProviderModalProps, NewProviderConfig, ProviderConfig } from './types.js';


/**
 * Icon component for close
 */
const IconClose = (props: React.SVGProps<SVGSVGElement>) => (
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
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

/**
 * Icon component for chevron down
 */
const IconChevronDown = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
        className={`w-4 h-4 ${props.className || ''}`}
    >
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

/**
 * Available provider info from models.dev
 */
interface AvailableProvider {
    id: string;
    name: string;
    baseURL: string;
    modelCount: number;
}

/**
 * AddProviderModal Component
 * 
 * Displays a modal for adding new provider configurations.
 * Fetches available providers from models.dev and validates all inputs.
 */
export const AddProviderModal: React.FC<AddProviderModalProps> = ({
    isOpen,
    onClose,
    onSave,
}) => {
    const bridge = useChatBridge();
    const [availableProviders, setAvailableProviders] = useState<AvailableProvider[]>([]);
    const [selectedProviderId, setSelectedProviderId] = useState('');
    const [customName, setCustomName] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('');
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showProviderDropdown, setShowProviderDropdown] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [providerSearchQuery, setProviderSearchQuery] = useState('');
    const [modelSearchQuery, setModelSearchQuery] = useState('');
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const providerDropdownRef = useRef<HTMLDivElement>(null);
    const modelDropdownRef = useRef<HTMLDivElement>(null);

    // Screen reader announcements hook
    const { announce } = useScreenReaderAnnouncement();

    /**
     * Fetch available providers from models.dev on mount
     */
    useEffect(() => {
        if (isOpen) {
            fetchProviders();
        }
    }, [isOpen]);

    /**
     * Reset form when modal closes
     */
    useEffect(() => {
        if (!isOpen) {
            setSelectedProviderId('');
            setCustomName('');
            setApiKey('');
            setModel('');
            setAvailableModels([]);
            setValidationErrors({});
            setShowProviderDropdown(false);
            setShowModelDropdown(false);
            setProviderSearchQuery('');
            setModelSearchQuery('');
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handleOutsideClick = (event: MouseEvent) => {
            const target = event.target as Node;
            if (providerDropdownRef.current && !providerDropdownRef.current.contains(target)) {
                setShowProviderDropdown(false);
            }
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(target)) {
                setShowModelDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [isOpen]);

    const filteredProviders = useMemo(() => {
        const query = providerSearchQuery.trim().toLowerCase();
        if (!query) return availableProviders;
        return availableProviders.filter((provider) =>
            provider.name.toLowerCase().includes(query) ||
            provider.id.toLowerCase().includes(query)
        );
    }, [availableProviders, providerSearchQuery]);

    const filteredModels = useMemo(() => {
        const query = modelSearchQuery.trim().toLowerCase();
        if (!query) return availableModels;
        return availableModels.filter((modelId) => modelId.toLowerCase().includes(query));
    }, [availableModels, modelSearchQuery]);

    /**
     * Fetch models when provider is selected
     */
    useEffect(() => {
        if (selectedProviderId) {
            fetchModelsForProvider(selectedProviderId);
        } else {
            setAvailableModels([]);
            setModel('');
        }
    }, [selectedProviderId]);

    /**
     * Fetch available providers from models.dev
     */
    const fetchProviders = async () => {
        setIsLoading(true);
        try {
            const providers = await bridge.getTrpcClient().modelRegistry.getProviders.query();
            setAvailableProviders(providers);
        } catch (error) {
            console.error('Failed to fetch providers:', error);
            // Use fallback providers if fetch fails
            setAvailableProviders([
                { id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', modelCount: 0 },
                { id: 'anthropic', name: 'Anthropic', baseURL: 'https://api.anthropic.com', modelCount: 0 },
                { id: 'google', name: 'Google', baseURL: 'https://generativelanguage.googleapis.com/v1beta', modelCount: 0 },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Fetch models for selected provider
     */
    const fetchModelsForProvider = async (providerId: string) => {
        setIsLoadingModels(true);
        try {
            const models = await bridge.getTrpcClient().modelRegistry.getModels.query({ providerId });
            
            // Remove provider prefix only when the model id is exactly "providerId/..."
            // Keep vendor/model style ids (e.g. "z-ai/glm-4.5-air:free") intact.
            const modelIds = models.map((m) => {
                const providerPrefix = `${providerId}/`;
                return m.id.startsWith(providerPrefix)
                    ? m.id.slice(providerPrefix.length)
                    : m.id;
            });
            
            setAvailableModels(modelIds);
            setModelSearchQuery('');
            
            // Auto-select first model if available
            if (modelIds.length > 0 && !model) {
                setModel(modelIds[0]);
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
            setAvailableModels([]);
        } finally {
            setIsLoadingModels(false);
        }
    };

    /**
     * Validate form and return whether it's valid
     */
    const validateForm = (existingProviders: ProviderConfig[] = []): boolean => {
        const config: NewProviderConfig = {
            providerId: selectedProviderId,
            customName,
            apiKey,
        };

        const result = validateProviderConfig(config, existingProviders);
        setValidationErrors(result.errors);
        
        // Announce validation errors to screen readers
        if (!result.isValid) {
            const errorMessages = Object.values(result.errors).join('. ');
            announce(`Validation errors: ${errorMessages}`, 'assertive');
        }
        
        return result.isValid;
    };

    /**
     * Handle provider selection
     */
    const handleProviderSelect = (providerId: string) => {
        setSelectedProviderId(providerId);
        setShowProviderDropdown(false);
        setProviderSearchQuery('');
        setShowModelDropdown(false);
        
        // Auto-fill custom name if empty
        if (!customName) {
            const provider = availableProviders.find(p => p.id === providerId);
            if (provider) {
                setCustomName(provider.name);
            }
        }

        // Clear provider ID error if it exists
        if (validationErrors.providerId) {
            setValidationErrors(prev => {
                const { providerId, ...rest } = prev;
                return rest;
            });
        }
    };

    const handleModelSelect = (modelId: string) => {
        setModel(modelId);
        setShowModelDropdown(false);
        setModelSearchQuery('');
    };

    /**
     * Handle custom name change
     */
    const handleCustomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCustomName(e.target.value);
        
        // Clear custom name error if it exists
        if (validationErrors.customName) {
            setValidationErrors(prev => {
                const { customName, ...rest } = prev;
                return rest;
            });
        }
    };

    /**
     * Handle API key change
     */
    const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setApiKey(e.target.value);
        
        // Clear API key error if it exists
        if (validationErrors.apiKey) {
            setValidationErrors(prev => {
                const { apiKey, ...rest } = prev;
                return rest;
            });
        }
    };

    /**
     * Handle save button click
     */
    const handleSave = async () => {
        // Validate form (we don't have access to existing providers here, 
        // so validation will be done in the parent component)
        if (!validateForm()) {
            return;
        }

        setIsSaving(true);
        try {
            const config: NewProviderConfig = {
                providerId: selectedProviderId,
                customName: customName.trim(),
                apiKey: apiKey.trim(),
                model: model.trim() || undefined,
            };

            await onSave(config);
            onClose();
        } catch (error) {
            console.error('Failed to save provider:', error);
            // Error handling is done by parent component
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Handle cancel button click
     */
    const handleCancel = () => {
        onClose();
    };

    /**
     * Handle backdrop click
     */
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const selectedProvider = availableProviders.find(p => p.id === selectedProviderId);
    const isSaveDisabled = !selectedProviderId || !customName.trim() || !apiKey.trim() || isSaving;

    /**
     * Handle Escape key and Enter key
     */
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'Enter' && !isSaveDisabled) {
                // Only submit if not in dropdown or textarea
                const target = e.target as HTMLElement;
                if (target.tagName !== 'BUTTON' && target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    handleSave();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, isSaveDisabled, handleSave]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-provider-modal-title"
        >
            <div className="w-full max-w-[560px] border border-[var(--lg-border)] bg-[var(--lg-bg-strong)] backdrop-blur-[var(--lg-blur)] rounded-[var(--r-window)] shadow-[var(--lg-outer-shadow)] flex flex-col overflow-hidden max-h-[90vh]">
                <div className="flex flex-col gap-5 p-6 sm:p-7 overflow-y-auto custom-scrollbar">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h2 
                            id="add-provider-modal-title"
                            className="text-[17px] font-semibold text-[var(--tx-primary)]"
                        >
                            Add New Provider
                        </h2>
                        <button
                            onClick={onClose}
                            className="lg-icon-btn lg-clear text-[var(--tx-secondary)] hover:text-[var(--tx-primary)]"
                            aria-label="Close modal"
                        >
                            <IconClose />
                        </button>
                    </div>

                    {/* Provider Dropdown */}
                    <div className="flex flex-col gap-2" ref={providerDropdownRef}>
                        <label 
                            htmlFor="provider-select"
                            className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]"
                        >
                            Provider *
                        </label>
                        <div className="relative">
                            <button
                                id="provider-select"
                                onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                                disabled={isLoading || isSaving}
                                className={`lg-input flex items-center justify-between gap-3 h-auto min-h-[44px] ${
                                    validationErrors.providerId 
                                        ? 'border-[var(--ac-red)] ring-1 ring-[var(--ac-red-subtle)]' 
                                        : ''
                                } disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--lg-bg-hover)] cursor-pointer`}

                                aria-haspopup="listbox"
                                aria-expanded={showProviderDropdown}
                            >
                                {selectedProvider ? (
                                    <div className="flex items-center gap-3">
                                        <ProviderLogo
                                            providerId={selectedProvider.id}
                                            providerName={selectedProvider.name}
                                            size="sm"
                                        />
                                        <span className="text-sm">{selectedProvider.name}</span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-[var(--color-text-tertiary)]">
                                        {isLoading ? 'Loading providers...' : 'Select a provider'}
                                    </span>
                                )}
                                <IconChevronDown className={`transition-transform ${showProviderDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Dropdown Menu */}
                            {showProviderDropdown && !isLoading && (
                                <div 
                                    className="absolute top-full left-0 right-0 mt-2 rounded-[var(--r-panel)] border border-[var(--lg-border)] bg-[var(--lg-bg)] backdrop-blur-xl shadow-xl z-[70] overflow-hidden"

                                    role="listbox"
                                >
                                    <div className="p-2 border-b border-[var(--color-border)]">
                                        <input
                                            type="text"
                                            value={providerSearchQuery}
                                            onChange={(e) => setProviderSearchQuery(e.target.value)}
                                            placeholder="Search provider..."
                                            className="w-full h-8 px-3 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]"
                                        />
                                    </div>
                                    <div className="max-h-[168px] overflow-y-auto">
                                        {filteredProviders.length === 0 && (
                                            <div className="px-3 py-2 text-xs text-[var(--color-text-tertiary)]">No providers found</div>
                                        )}
                                        {filteredProviders.map((provider) => (
                                            <button
                                                key={provider.id}
                                                onClick={() => handleProviderSelect(provider.id)}
                                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-bg-surface)] text-left transition-colors"
                                                role="option"
                                                aria-selected={selectedProviderId === provider.id}
                                            >
                                                <ProviderLogo
                                                    providerId={provider.id}
                                                    providerName={provider.name}
                                                    size="sm"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                                                        {provider.name}
                                                    </div>
                                                    <div className="text-xs text-[var(--color-text-tertiary)]">
                                                        {provider.modelCount} models
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        {validationErrors.providerId && (
                            <p className="text-xs text-[var(--color-danger)]" role="alert">
                                {validationErrors.providerId}
                            </p>
                        )}
                    </div>

                    {/* Custom Name Input */}
                    <div className="flex flex-col gap-2">
                        <label 
                            htmlFor="custom-name-input"
                            className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]"
                        >
                            Custom Name *
                        </label>
                        <input
                            id="custom-name-input"
                            type="text"
                            value={customName}
                            onChange={handleCustomNameChange}
                            disabled={isSaving}
                            placeholder="e.g., My OpenAI Account"
                            className={`lg-input h-[44px] ${
                                validationErrors.customName 
                                    ? 'border-[var(--ac-red)] ring-1 ring-[var(--ac-red-subtle)]' 
                                    : ''
                            } disabled:opacity-50 disabled:cursor-not-allowed`}

                            aria-invalid={!!validationErrors.customName}
                            aria-describedby={validationErrors.customName ? 'custom-name-error' : undefined}
                        />
                        {validationErrors.customName && (
                            <p id="custom-name-error" className="text-xs text-[var(--color-danger)]" role="alert">
                                {validationErrors.customName}
                            </p>
                        )}
                    </div>

                    {/* API Key Input */}
                    <div className="flex flex-col gap-2">
                        <label 
                            htmlFor="api-key-input"
                            className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]"
                        >
                            API Key *
                        </label>
                        <input
                            id="api-key-input"
                            type="password"
                            value={apiKey}
                            onChange={handleApiKeyChange}
                            disabled={isSaving}
                            placeholder="sk-..."
                            className={`lg-input h-[44px] font-mono text-sm ${
                                validationErrors.apiKey 
                                    ? 'border-[var(--ac-red)] ring-1 ring-[var(--ac-red-subtle)]' 
                                    : ''
                            } disabled:opacity-50 disabled:cursor-not-allowed`}

                            aria-invalid={!!validationErrors.apiKey}
                            aria-describedby={validationErrors.apiKey ? 'api-key-error' : undefined}
                        />
                        {validationErrors.apiKey && (
                            <p id="api-key-error" className="text-xs text-[var(--color-danger)]" role="alert">
                                {validationErrors.apiKey}
                            </p>
                        )}
                    </div>

                    {/* Model Input */}
                    {selectedProviderId && (
                        <div className="flex flex-col gap-2" ref={modelDropdownRef}>
                            <label 
                                htmlFor="model-input"
                                className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]"
                            >
                                Model (Optional)
                            </label>
                            {isLoadingModels ? (
                                <div className="px-4 py-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-text-tertiary)] text-sm">
                                    Loading models...
                                </div>
                            ) : availableModels.length > 0 ? (
                                <div className="relative">
                                    <button
                                        id="model-input"
                                        onClick={() => setShowModelDropdown(!showModelDropdown)}
                                        disabled={isSaving}
                                        className="lg-input flex items-center justify-between gap-3 h-[44px] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:bg-[var(--lg-bg-hover)]"

                                        aria-haspopup="listbox"
                                        aria-expanded={showModelDropdown}
                                    >
                                        <span className={`text-sm truncate ${model ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-tertiary)]'}`}>
                                            {model || 'Select a model'}
                                        </span>
                                        <IconChevronDown className={`transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showModelDropdown && (
                                        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-[var(--r-panel)] border border-[var(--lg-border)] bg-[var(--lg-bg)] backdrop-blur-xl shadow-xl z-[70] overflow-hidden">

                                            <div className="p-2 border-b border-[var(--color-border)]">
                                                <input
                                                    type="text"
                                                    value={modelSearchQuery}
                                                    onChange={(e) => setModelSearchQuery(e.target.value)}
                                                    placeholder="Search model..."
                                                    className="w-full h-8 px-3 rounded-md bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]"
                                                />
                                            </div>
                                            <div className="max-h-[168px] overflow-y-auto">
                                                <button
                                                    onClick={() => handleModelSelect('')}
                                                    className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] transition-colors"
                                                >
                                                    No default model
                                                </button>
                                                {filteredModels.length === 0 && (
                                                    <div className="px-3 py-2 text-xs text-[var(--color-text-tertiary)]">No models found</div>
                                                )}
                                                {filteredModels.map((modelId) => (
                                                    <button
                                                        key={modelId}
                                                        onClick={() => handleModelSelect(modelId)}
                                                        className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)] transition-colors"
                                                    >
                                                        {modelId}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <input
                                    id="model-input"
                                    type="text"
                                    value={model}
                                    onChange={(e) => setModel(e.target.value)}
                                    disabled={isSaving}
                                    placeholder="e.g., gpt-4o"
                                    className="lg-input h-[44px] disabled:opacity-50 disabled:cursor-not-allowed"

                                />
                            )}
                            <p className="text-xs text-[var(--color-text-tertiary)]">
                                Leave empty to configure later in the Model tab
                            </p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 mt-4">
                        <button 
                            onClick={handleCancel}
                            disabled={isSaving}
                            className="lg-btn hover:bg-[var(--lg-bg-hover)] disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={isSaveDisabled}
                            className="lg-btn lg-btn-accent rounded-[var(--r-control)] px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
};
