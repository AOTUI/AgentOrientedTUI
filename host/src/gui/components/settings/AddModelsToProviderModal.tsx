/**
 * AddModelsToProviderModal
 *
 * Follow-up dialog shown right after a Custom Provider is created.
 * Lets the user add one or more model IDs before entering the detail panel.
 */

import React, { useState, useRef, useEffect } from 'react';
import type { CustomProviderRecord } from './types.js';

// ── Icons ────────────────────────────────────────────────────────────────────

const IconPlus = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);
const IconCheck = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);
const IconArrowRight = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
    </svg>
);

// ── Props ────────────────────────────────────────────────────────────────────

export interface AddModelsToProviderModalProps {
    isOpen: boolean;
    provider: CustomProviderRecord;
    /** Called once per model ID as the user adds them */
    onAddModel: (modelId: string) => Promise<void>;
    /** Called when user clicks Done / finishes */
    onDone: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export const AddModelsToProviderModal: React.FC<AddModelsToProviderModalProps> = ({
    isOpen,
    provider,
    onAddModel,
    onDone,
}) => {
    const [inputValue, setInputValue] = useState('');
    const [addedModels, setAddedModels] = useState<string[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when modal opens
    useEffect(() => {
        if (isOpen) {
            setInputValue('');
            setAddedModels([]);
            setError('');
            setTimeout(() => inputRef.current?.focus(), 80);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleAdd = async () => {
        const modelId = inputValue.trim();
        if (!modelId) { setError('Please enter a model ID.'); return; }
        if (addedModels.includes(modelId)) { setError('Already added.'); return; }
        setError('');
        setIsAdding(true);
        try {
            await onAddModel(modelId);
            setAddedModels(prev => [...prev, modelId]);
            setInputValue('');
            // Keep focus in input for rapid entry
            setTimeout(() => inputRef.current?.focus(), 50);
        } catch {
            setError('Failed to add model. Please try again.');
        } finally {
            setIsAdding(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); void handleAdd(); }
        if (e.key === 'Escape') { onDone(); }
    };

    return (
        /* Backdrop */
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label={`Add models to ${provider.name}`}
        >
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onDone}
            />

            {/* Panel */}
            <div className="relative z-10 w-full max-w-[480px] mx-4 flex flex-col gap-0
                rounded-[20px] border border-[var(--mat-border)]
                bg-[var(--mat-content-bg)] shadow-2xl
                overflow-hidden">

                {/* ── Header ── */}
                <div className="px-6 pt-6 pb-4 flex flex-col gap-1.5">
                    {/* Step indicator */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--color-accent)] text-white text-[10px] font-bold">2</span>
                        <span className="text-[11px] uppercase tracking-[0.06em] font-bold text-[var(--color-text-tertiary)]">Step 2 of 2</span>
                    </div>
                    <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[var(--color-text-primary)]">
                        Add Models
                    </h2>
                    <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                        Add one or more model IDs for{' '}
                        <span className="font-semibold text-[var(--color-text-primary)]">{provider.name}</span>
                        . You can always add more later.
                    </p>
                </div>

                {/* ── Provider chip ── */}
                <div className="px-6 pb-3">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                        bg-[var(--mat-content-card-hover-bg)] border border-[var(--mat-border)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
                        <span className="text-[12px] font-medium text-[var(--color-text-primary)]">{provider.name}</span>
                        <span className="text-[10px] font-bold uppercase tracking-[0.04em]
                            bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/20
                            px-1.5 py-0.5 rounded-full">
                            {provider.protocol === 'openai' ? 'OpenAI API' : 'Anthropic API'}
                        </span>
                    </div>
                </div>

                {/* ── Divider ── */}
                <div className="h-px bg-[var(--mat-border)]" />

                {/* ── Input area ── */}
                <div className="px-6 py-5 flex flex-col gap-3">
                    <label className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">
                        Model ID
                    </label>
                    <div className="flex gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => { setInputValue(e.target.value); setError(''); }}
                            onKeyDown={handleKeyDown}
                            placeholder="e.g. llama-3.3-70b-instruct"
                            className="flex-1 h-10 px-3.5 rounded-[10px] font-mono
                                bg-[var(--mat-lg-clear-bg)] border border-[var(--mat-border)]
                                text-[13px] text-[var(--color-text-primary)]
                                placeholder:text-[var(--color-text-tertiary)]
                                focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/15
                                transition-all"
                            disabled={isAdding}
                        />
                        <button
                            type="button"
                            onClick={handleAdd}
                            disabled={isAdding || !inputValue.trim()}
                            className="h-10 px-4 rounded-[10px] flex items-center gap-1.5
                                bg-[var(--color-accent)] text-white text-[13px] font-semibold
                                disabled:opacity-40 active:scale-95 transition-all duration-150"
                        >
                            {isAdding ? (
                                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            ) : (
                                <IconPlus />
                            )}
                            <span>Add</span>
                        </button>
                    </div>

                    {error && (
                        <p className="text-[12px] text-[var(--color-danger)]">{error}</p>
                    )}

                    <p className="text-[11px] text-[var(--color-text-tertiary)]">
                        Press <kbd className="px-1 py-0.5 rounded bg-[var(--mat-border)] text-[10px] font-mono">↵ Enter</kbd> to add quickly.
                    </p>
                </div>

                {/* ── Added models chips ── */}
                {addedModels.length > 0 && (
                    <div className="px-6 pb-4 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <IconCheck />
                            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">
                                Added · {addedModels.length}
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {addedModels.map((m) => (
                                <span key={m}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                                        bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/25
                                        text-[12px] font-mono text-[var(--color-accent)]">
                                    {m}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Divider ── */}
                <div className="h-px bg-[var(--mat-border)]" />

                {/* ── Footer ── */}
                <div className="px-6 py-4 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onDone}
                        className="text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]
                            transition-colors px-3 py-2 rounded-[8px] hover:bg-[var(--mat-content-card-hover-bg)]"
                    >
                        {addedModels.length === 0 ? 'Skip for now' : 'Done'}
                    </button>

                    <button
                        type="button"
                        onClick={onDone}
                        className="flex items-center gap-2 h-9 px-5 rounded-[10px]
                            bg-[var(--color-accent)] text-white text-[13px] font-semibold
                            disabled:opacity-50 active:scale-95 transition-all duration-150"
                    >
                        <span>Open Provider</span>
                        <IconArrowRight />
                    </button>
                </div>
            </div>
        </div>
    );
};
