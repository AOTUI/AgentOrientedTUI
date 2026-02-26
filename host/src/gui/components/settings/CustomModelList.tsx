/**
 * CustomModelList
 *
 * Renders the list of manually-added models for a Custom Provider.
 * Each model is represented as a `ProviderConfig` row (from SQLite).
 * Shows model ID, active state, and activate / delete actions.
 *
 * Designed to be visually consistent with `ModelList` while handling
 * sparse data gracefully (no pricing, context-length, capabilities, etc.).
 */

import React, { useState } from 'react';
import type { ProviderConfig } from './types.js';

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconTrash = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
);

const IconPlus = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CustomModelListProps {
    /** Linked ProviderConfig rows for this custom provider */
    configs: ProviderConfig[];
    /** Activate a model config by its DB id */
    onActivate: (configId: number) => Promise<void>;
    /** Delete a model config by its DB id */
    onDelete: (configId: number) => Promise<void>;
    /** Open the "Add Model" input form */
    onAddModel: () => void;
}

// ─── Single row ───────────────────────────────────────────────────────────────

const CustomModelCard: React.FC<{
    config: ProviderConfig;
    onActivate: () => void;
    onDelete: () => void;
}> = ({ config, onActivate, onDelete }) => {
    const [activating, setActivating] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const handleActivate = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (config.isActive || activating) return;
        setActivating(true);
        try { await onActivate(); } finally { setActivating(false); }
    };

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (deleting) return;
        setDeleting(true);
        try { await onDelete(); } finally { setDeleting(false); }
    };

    // Derive a human-friendly display name
    const displayName = config.customName || config.model || '(unnamed model)';
    const modelId = config.model || '';

    return (
        <div
            className={`
                group relative w-full text-left outline-none
                p-3.5 rounded-[14px] border transition-all duration-200 ease-[var(--ease-spring)]
                flex items-center gap-3 overflow-hidden
                mat-content hover:bg-[var(--mat-content-card-hover-bg)]
                border-[var(--mat-border)]
            `}
            role="listitem"
            aria-label={`${displayName} model${config.isActive ? ' (active)' : ''}`}
        >
            {/* Active stripe */}
            {config.isActive && (
                <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full bg-[var(--color-success)]" />
            )}

            {/* Text */}
            <div className="flex-1 min-w-0 pl-1">
                <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate leading-tight">
                    {displayName}
                </p>
                {modelId && modelId !== displayName && (
                    <p className="text-[11px] text-[var(--color-text-tertiary)] font-mono truncate mt-0.5">
                        {modelId}
                    </p>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
                {config.isActive ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-[0.05em]
                        bg-[var(--color-success)/15] text-[var(--color-success)] border border-[var(--color-success)/15]">
                        Active
                    </span>
                ) : (
                    <button
                        onClick={handleActivate}
                        disabled={activating}
                        className="
                            px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-200
                            bg-[var(--color-bg-surface)] hover:bg-[var(--color-accent)]/15
                            text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]
                            border border-[var(--color-border)] hover:border-[var(--color-accent)]/30
                            opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto
                            disabled:opacity-50 disabled:cursor-not-allowed
                        "
                    >
                        {activating ? '…' : 'Activate'}
                    </button>
                )}

                <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="
                        p-1.5 rounded-lg transition-all duration-150
                        text-[var(--color-text-tertiary)]
                        hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10
                        opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto
                        disabled:opacity-40 disabled:cursor-not-allowed
                    "
                    aria-label={`Delete ${displayName}`}
                    title="Delete model"
                >
                    <IconTrash />
                </button>
            </div>
        </div>
    );
};

// ─── Container list ───────────────────────────────────────────────────────────

export const CustomModelList: React.FC<CustomModelListProps> = ({
    configs,
    onActivate,
    onDelete,
    onAddModel,
}) => {
    // Sort: active model first
    const sorted = [...configs].sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return 0;
    });

    return (
        <div className="flex flex-col gap-2 h-full min-h-0">
            {/* Scrollable model cards */}
            {sorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3
                    text-[var(--color-text-tertiary)]">
                    <p className="text-[13px]">No models added yet.</p>
                    <button
                        onClick={onAddModel}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium
                            border border-[var(--mat-border)]
                            text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]
                            hover:border-[var(--color-accent)]/40
                            transition-all duration-150"
                    >
                        <IconPlus />
                        Add First Model
                    </button>
                </div>
            ) : (
                <div
                    className="flex flex-col gap-2 overflow-y-auto pr-1"
                    role="list"
                    aria-label="Custom provider models"
                >
                    {sorted.map((config) => (
                        <CustomModelCard
                            key={config.id}
                            config={config}
                            onActivate={() => onActivate(config.id)}
                            onDelete={() => onDelete(config.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
