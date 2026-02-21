/**
 * ModelCard Component (V2)
 * 
 * Displays detailed model information including capabilities, pricing, and context length.
 * Shows active badge and handles model selection.
 */

import React from 'react';
import type { ModelCardProps } from './types.js';

/**
 * Format context length in human-readable format
 * @param context - Context length in tokens
 * @returns Formatted string (e.g., "128K", "1M")
 */
const formatContextLength = (context: number | undefined): string => {
    if (!context) return 'N/A';
    
    if (context >= 1_000_000) {
        return `${(context / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    }
    if (context >= 1_000) {
        return `${(context / 1_000).toFixed(0)}K`;
    }
    return `${context}`;
};

/**
 * Format pricing in human-readable format
 * @param cost - Cost per token
 * @returns Formatted string (e.g., "$0.01/1K", "$0.50/1M")
 */
const formatPricing = (cost: number | undefined): string => {
    if (cost === undefined || cost === null) return 'N/A';
    
    // Convert to cost per 1K tokens
    const costPer1K = cost * 1000;
    
    if (costPer1K >= 1) {
        return `$${costPer1K.toFixed(2)}/1K`;
    }
    
    // For very small costs, show per 1M tokens
    const costPer1M = cost * 1_000_000;
    return `$${costPer1M.toFixed(2)}/1M`;
};

/**
 * Check if model has vision capability
 * @param model - Model to check
 * @returns True if model supports vision
 */
const hasVisionCapability = (model: { modalities?: { input?: string[] } }): boolean => {
    return model.modalities?.input?.includes('image') ?? false;
};

/**
 * ModelCard Component
 * 
 * Displays a model with detailed information including:
 * - Model name and family
 * - Capability badges (tool_call, reasoning, vision)
 * - Context length
 * - Pricing (input/output)
 * - Active badge
 */
export const ModelCard: React.FC<ModelCardProps> = ({
    model,
    isActive,
    onSelect,
}) => {
    const handleCardClick = () => {
        onSelect();
    };

    const hasToolCall = model.tool_call ?? false;
    const hasReasoning = model.reasoning ?? false;
    const hasVision = hasVisionCapability(model);

    return (
        <div
            className={`
                group relative w-full text-left outline-none
                p-3 rounded-[var(--r-panel)] border transition-all duration-200 min-h-[160px]
                flex flex-col gap-2.5 overflow-hidden
                bg-[var(--lg-bg)] border-[var(--lg-border)] hover:bg-[var(--lg-bg-hover)] hover:border-[var(--lg-border-hover)]
            `}
            role="listitem"
            aria-label={`${model.name} model${isActive ? ' (active)' : ''}`}
        >
            <div className="flex flex-col gap-1 w-full">
                {/* Header: Model Name and Active Badge/Activate Button */}
                <div className="flex items-start justify-between gap-2 w-full">
                    <h3 className={`text-[13px] font-medium leading-tight line-clamp-2 text-[var(--tx-primary)]`}>
                        {model.name}
                    </h3>
                    {isActive ? (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--ac-green-subtle)] text-[var(--ac-green)] border border-[var(--ac-green-subtle)]">
                            ACTIVE
                        </span>
                    ) : (
                         <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect();
                            }}
                            className="
                                shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-200
                                bg-[var(--lg-bg-alt)] hover:bg-[var(--ac-blue-subtle)] text-[var(--tx-secondary)] hover:text-[var(--ac-blue)]
                                border border-[var(--lg-border)] hover:border-[var(--ac-blue-muted)]
                                opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto
                                focus:opacity-100 focus:pointer-events-auto
                            "
                        >
                            Activate
                        </button>
                    )}
                </div>

                {/* Family */}
                {model.family && (
                    <div className="text-[11px] text-[var(--tx-tertiary)] truncate">
                        {model.family}
                    </div>
                )}

                {!model.family && (
                    <div className="text-[11px] text-[var(--tx-tertiary)] truncate opacity-80">
                        {model.id}
                    </div>
                )}
            </div>

            {/* Separator */}
            <div className="h-px w-full bg-[var(--lg-border)]" />

            {/* Capability Badges */}
            {(hasToolCall || hasReasoning || hasVision) && (
                <div className="flex flex-wrap gap-1.5">
                    {hasToolCall && (
                        <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium border bg-[var(--lg-bg-alt)] border-[var(--lg-border-subtle)] text-[var(--tx-secondary)]">
                            Tools
                        </span>
                    )}
                    {hasReasoning && (
                        <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium border bg-[var(--lg-bg-alt)] border-[var(--lg-border-subtle)] text-[var(--tx-secondary)]">
                            Reasoning
                        </span>
                    )}
                    {hasVision && (
                        <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-medium border bg-[var(--lg-bg-alt)] border-[var(--lg-border-subtle)] text-[var(--tx-secondary)]">
                            Vision
                        </span>
                    )}
                </div>
            )}

            {/* Context Length and Pricing */}
            <div className="flex flex-col gap-0.5 text-[10px] text-[var(--tx-tertiary)] mt-auto pt-1">
                {/* Context Length */}
                <div className="flex items-center gap-1.5">
                    <span className="opacity-70">Context:</span>
                    <span className="text-[var(--tx-secondary)]">{formatContextLength(model.limit?.context)}</span>
                </div>

                {/* Pricing */}
                <div className="flex gap-3">
                    <span className="flex gap-1">
                        <span className="opacity-70">In:</span> 
                        <span className="text-[var(--tx-secondary)]">{formatPricing(model.cost?.input)}</span>
                    </span>
                    <span className="flex gap-1">
                        <span className="opacity-70">Out:</span>
                        <span className="text-[var(--tx-secondary)]">{formatPricing(model.cost?.output)}</span>
                    </span>
                </div>
            </div>

            {/* Activate Button - Only visible when not active */}
            {/* {!isActive && (
                <div className="mt-2 pt-2 border-t border-[var(--lg-border)] flex justify-end">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onSelect();
                        }}
                        className="
                            px-3 py-1.5 rounded-[var(--r-control)] text-xs font-medium transition-all duration-200
                            bg-[var(--lg-bg-alt)] hover:bg-[var(--ac-blue-subtle)] text-[var(--tx-secondary)] hover:text-[var(--ac-blue)]
                            border border-[var(--lg-border)] hover:border-[var(--ac-blue-muted)]
                        "
                    >
                        Activate
                    </button>
                </div>
            )} */}
        </div>
    );
};

