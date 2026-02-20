/**
 * EditProviderModal Component (V2)
 * 
 * Modal for editing existing provider configuration.
 * Pre-fills form with existing values and validates inputs.
 */

import React, { useState, useEffect } from 'react';
import { ProviderLogo } from './ProviderLogo.js';
import { validateProviderConfig } from './validation.js';
import { useScreenReaderAnnouncement } from './hooks/useScreenReaderAnnouncement.js';
import type { EditProviderModalProps, ProviderConfig, ProviderUpdates } from './types.js';

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
 * EditProviderModal Component
 * 
 * Displays a modal for editing existing provider configurations.
 * Pre-fills form with existing values and validates all inputs.
 */
export const EditProviderModal: React.FC<EditProviderModalProps> = ({
    isOpen,
    provider,
    onClose,
    onSave,
}) => {
    const [customName, setCustomName] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    // Screen reader announcements hook
    const { announce } = useScreenReaderAnnouncement();

    /**
     * Pre-fill form when provider changes
     */
    useEffect(() => {
        if (isOpen && provider) {
            setCustomName(provider.customName);
            // Mask API key - show only last 4 characters
            const maskedKey = provider.apiKey.length > 4 
                ? '•'.repeat(provider.apiKey.length - 4) + provider.apiKey.slice(-4)
                : provider.apiKey;
            setApiKey(maskedKey);
            setValidationErrors({});
        }
    }, [isOpen, provider]);

    /**
     * Reset form when modal closes
     */
    useEffect(() => {
        if (!isOpen) {
            setCustomName('');
            setApiKey('');
            setValidationErrors({});
        }
    }, [isOpen]);

    /**
     * Validate form and return whether it's valid
     */
    const validateForm = (existingProviders: ProviderConfig[] = []): boolean => {
        if (!provider) return false;

        const config = {
            providerId: provider.providerId,
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
        if (!provider) return;

        // Validate form
        if (!validateForm()) {
            return;
        }

        setIsSaving(true);
        try {
            const updates: ProviderUpdates = {
                customName: customName.trim(),
                apiKey: apiKey.trim(),
            };

            await onSave(provider.id, updates);
            onClose();
        } catch (error) {
            console.error('Failed to update provider:', error);
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

    /**
     * Handle Escape key and Enter key
     */
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'Enter' && !isSaveDisabled) {
                // Only submit if not in button or textarea
                const target = e.target as HTMLElement;
                if (target.tagName !== 'BUTTON' && target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    handleSave();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !provider) return null;

    const isSaveDisabled = !customName.trim() || !apiKey.trim() || isSaving;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-provider-modal-title"
        >
            <div className="w-full max-w-[500px] border border-[var(--lg-border)] bg-[var(--lg-bg-strong)] backdrop-blur-[var(--lg-blur)] rounded-[var(--r-window)] shadow-[var(--lg-outer-shadow)] flex flex-col overflow-hidden">
                <div className="flex flex-col gap-5 p-6 overflow-y-auto custom-scrollbar">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h2
                            id="edit-provider-modal-title"
                            className="text-[17px] font-semibold text-[var(--tx-primary)]"
                        >
                            Edit Provider
                        </h2>
                        <button
                            onClick={onClose}
                            className="lg-icon-btn lg-clear text-[var(--tx-secondary)] hover:text-[var(--tx-primary)]"
                            aria-label="Close modal"
                        >
                            <IconClose />
                        </button>
                    </div>

                    {/* Provider Display (Read-only) */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-medium uppercase tracking-wide text-[var(--tx-tertiary)]">
                            Provider
                        </label>
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-control)] border border-[var(--lg-clear-border)] bg-[var(--lg-clear-bg)]">
                            <ProviderLogo
                                providerId={provider.providerId}
                                providerName={provider.customName}
                                size="sm"
                            />
                            <span className="text-[13px] text-[var(--tx-primary)] capitalize">
                                {provider.providerId}
                            </span>
                        </div>
                        <p className="text-[11px] text-[var(--tx-tertiary)]">
                            Provider cannot be changed
                        </p>
                    </div>

                    {/* Custom Name Input */}
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="edit-custom-name-input"
                            className="text-[11px] font-medium uppercase tracking-wide text-[var(--tx-tertiary)]"
                        >
                            Custom Name *
                        </label>
                        <input
                            id="edit-custom-name-input"
                            type="text"
                            value={customName}
                            onChange={handleCustomNameChange}
                            disabled={isSaving}
                            placeholder="e.g., My OpenAI Account"
                            className={`lg-input !h-[44px] !py-0 ${
                                validationErrors.customName
                                    ? '!border-[var(--ac-red)] ring-1 ring-[var(--ac-red-subtle)]'
                                    : ''
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            aria-invalid={!!validationErrors.customName}
                            aria-describedby={validationErrors.customName ? 'edit-custom-name-error' : undefined}
                        />
                        {validationErrors.customName && (
                            <p id="edit-custom-name-error" className="text-[11px] text-[var(--ac-red)]" role="alert">
                                {validationErrors.customName}
                            </p>
                        )}
                    </div>

                    {/* API Key Input */}
                    <div className="flex flex-col gap-1.5">
                        <label
                            htmlFor="edit-api-key-input"
                            className="text-[11px] font-medium uppercase tracking-wide text-[var(--tx-tertiary)]"
                        >
                            API Key *
                        </label>
                        <input
                            id="edit-api-key-input"
                            type="password"
                            value={apiKey}
                            onChange={handleApiKeyChange}
                            disabled={isSaving}
                            placeholder="sk-..."
                            className={`lg-input !h-[44px] !py-0 font-mono text-sm ${
                                validationErrors.apiKey
                                    ? '!border-[var(--ac-red)] ring-1 ring-[var(--ac-red-subtle)]'
                                    : ''
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            aria-invalid={!!validationErrors.apiKey}
                            aria-describedby={validationErrors.apiKey ? 'edit-api-key-error' : undefined}
                        />
                        {validationErrors.apiKey && (
                            <p id="edit-api-key-error" className="text-[11px] text-[var(--ac-red)]" role="alert">
                                {validationErrors.apiKey}
                            </p>
                        )}
                        <p className="text-[11px] text-[var(--tx-tertiary)]">
                            Enter new API key or leave as-is to keep current key
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-4">
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
