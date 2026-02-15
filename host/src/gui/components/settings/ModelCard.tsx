/**
 * ModelCard Component (V2)
 * 
 * Displays detailed model information including capabilities, pricing, and context length.
 * Shows active badge and handles model selection.
 */

import React from 'react';
import { MagicCard } from '../ui/MagicCard.js';
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
        <MagicCard
            className={`cursor-pointer transition-all duration-300 ${
                isActive 
                    ? 'border-2 border-[var(--color-primary)]' 
                    : 'border border-[var(--color-border)]'
            }`}
            onClick={handleCardClick}
            role="listitem"
            aria-label={`${model.name} model${isActive ? ' (active)' : ''}`}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick();
                }
            }}
        >
            <div className="flex flex-col gap-2">
                {/* Header: Model Name and Active Badge */}
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-[var(--color-text-primary)] flex-1 line-clamp-2">
                        {model.name}
                    </h3>
                    {isActive && (
                        <div className="px-1.5 py-0.5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-medium uppercase tracking-wide flex-shrink-0">
                            Active
                        </div>
                    )}
                </div>

                {/* Family */}
                {model.family && (
                    <div className="text-xs text-[var(--color-text-secondary)] truncate">
                        {model.family}
                    </div>
                )}

                {/* Capability Badges */}
                {(hasToolCall || hasReasoning || hasVision) && (
                    <div className="flex flex-wrap gap-1">
                        {hasToolCall && (
                            <span className="px-1.5 py-0.5 rounded-md bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] text-[10px] font-medium border border-[var(--color-border)]">
                                Tools
                            </span>
                        )}
                        {hasReasoning && (
                            <span className="px-1.5 py-0.5 rounded-md bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] text-[10px] font-medium border border-[var(--color-border)]">
                                Reasoning
                            </span>
                        )}
                        {hasVision && (
                            <span className="px-1.5 py-0.5 rounded-md bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] text-[10px] font-medium border border-[var(--color-border)]">
                                Vision
                            </span>
                        )}
                    </div>
                )}

                {/* Context Length and Pricing */}
                <div className="flex flex-col gap-0.5 text-[10px] text-[var(--color-text-secondary)]">
                    {/* Context Length */}
                    {model.limit?.context && (
                        <div>
                            Context: {formatContextLength(model.limit.context)}
                        </div>
                    )}

                    {/* Pricing */}
                    {(model.cost?.input !== undefined || model.cost?.output !== undefined) && (
                        <div className="flex gap-2">
                            {model.cost?.input !== undefined && (
                                <span>In: {formatPricing(model.cost.input)}</span>
                            )}
                            {model.cost?.output !== undefined && (
                                <span>Out: {formatPricing(model.cost.output)}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </MagicCard>
    );
};
