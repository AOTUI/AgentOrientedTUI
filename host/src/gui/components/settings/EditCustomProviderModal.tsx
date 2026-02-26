/**
 * EditCustomProviderModal
 *
 * A modal dialog for editing an existing Custom Provider's metadata
 * (name, baseUrl, protocol, apiKey).
 * Triggered when the user clicks the Edit button on a Custom Provider card.
 */

import React, { useState, useEffect } from 'react';
import type { CustomProviderRecord, CustomProviderProtocol, CustomProviderUpdates } from './types.js';

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconX = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const IconCheck = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

// ─── Protocol options ─────────────────────────────────────────────────────────

const PROTOCOL_OPTIONS: { value: CustomProviderProtocol; label: string }[] = [
    { value: 'openai', label: 'OpenAI API' },
    { value: 'anthropic', label: 'Anthropic API' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

export interface EditCustomProviderModalProps {
    isOpen: boolean;
    provider: CustomProviderRecord | null;
    onClose: () => void;
    onSave: (id: string, updates: CustomProviderUpdates) => Promise<void>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const EditCustomProviderModal: React.FC<EditCustomProviderModalProps> = ({
    isOpen,
    provider,
    onClose,
    onSave,
}) => {
    const [name, setName] = useState('');
    const [baseUrl, setBaseUrl] = useState('');
    const [protocol, setProtocol] = useState<CustomProviderProtocol>('openai');
    const [apiKey, setApiKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    // Populate form when provider changes or modal opens
    useEffect(() => {
        if (provider && isOpen) {
            setName(provider.name);
            setBaseUrl(provider.baseUrl);
            setProtocol(provider.protocol);
            setApiKey('');   // never pre-fill secrets
            setError('');
        }
    }, [provider, isOpen]);

    if (!isOpen || !provider) return null;

    const canSave = name.trim().length > 0 && baseUrl.trim().length > 0 && !isSaving;

    const handleSave = async () => {
        if (!canSave) return;
        setError('');
        setIsSaving(true);
        try {
            const updates: CustomProviderUpdates = {
                name: name.trim(),
                baseUrl: baseUrl.trim(),
                protocol,
            };
            if (apiKey.trim()) {
                updates.apiKey = apiKey.trim();
            }
            await onSave(provider.id, updates);
            onClose();
        } catch (err) {
            setError('Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    };

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center no-drag
                bg-[var(--mat-overlay-bg)] backdrop-blur-md"
            onClick={handleBackdropClick}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-custom-provider-title"
        >
            <div
                className="relative w-full max-w-[480px] mx-4
                    mat-lg-regular rounded-[20px] overflow-hidden
                    transition-all duration-200 ease-[var(--ease-spring)]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[var(--mat-border)]">
                    <div>
                        <h2 id="edit-custom-provider-title"
                            className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--color-text-primary)]">
                            Edit Custom Provider
                        </h2>
                        <p className="text-[12px] text-[var(--color-text-tertiary)] mt-0.5">
                            {provider.name}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-[var(--color-text-secondary)]
                            hover:bg-[var(--mat-content-card-hover-bg)] hover:text-[var(--color-text-primary)]
                            transition-all duration-150"
                        aria-label="Close"
                    >
                        <IconX />
                    </button>
                </div>

                {/* Form */}
                <div className="px-6 py-5 flex flex-col gap-4">
                    {/* Provider Name */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
                            Provider Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My Custom Provider"
                            className="lg-input h-9 text-[13px]"
                            autoFocus
                        />
                    </div>

                    {/* Base URL */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
                            Base URL
                        </label>
                        <input
                            type="url"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder="https://api.example.com/v1"
                            className="lg-input h-9 text-[13px] font-mono"
                        />
                    </div>

                    {/* API Protocol */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
                            API Protocol
                        </label>
                        <div className="flex gap-2">
                            {PROTOCOL_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setProtocol(opt.value)}
                                    className={`flex-1 py-2 rounded-lg border text-[12px] font-medium transition-all
                                        ${protocol === opt.value
                                            ? 'border-[var(--color-accent)] bg-[var(--mat-lg-clear-accent-bg)] text-[var(--color-accent)]'
                                            : 'border-[var(--mat-border)] text-[var(--color-text-secondary)] hover:border-[var(--mat-border-highlight)]'
                                        }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* API Key */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
                            API Key
                            <span className="ml-1 normal-case font-normal text-[var(--color-text-tertiary)]">
                                (leave blank to keep existing)
                            </span>
                        </label>
                        <input
                            type="password"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="sk-… (leave blank to keep existing)"
                            className="lg-input h-9 text-[13px] font-mono"
                            autoComplete="new-password"
                        />
                    </div>

                    {/* Error message */}
                    {error && (
                        <p className="text-[12px] text-[var(--color-danger)]">{error}</p>
                    )}
                </div>

                {/* Footer actions */}
                <div className="flex items-center justify-end gap-2 px-6 pb-5">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-lg text-[13px] font-medium
                            text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
                            hover:bg-[var(--mat-content-card-hover-bg)]
                            transition-all duration-150 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!canSave}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium
                            bg-[var(--color-accent)] text-white
                            hover:bg-[var(--color-accent)]/90
                            transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                            active:scale-95"
                    >
                        <IconCheck />
                        {isSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};
