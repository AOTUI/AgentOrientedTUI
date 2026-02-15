/**
 * ModelSelector Component
 * 
 * Displays available models for a selected provider with filtering
 * Shows model metadata including pricing, capabilities, and context length
 */

import React, { useState, useMemo } from 'react';
import type { ModelsDevModel } from '../../../services/index.js';
import { LoadingState } from './LoadingState.js';

export interface ModelSelectorProps {
    /** List of models to display */
    models: ModelsDevModel[];
    /** Currently selected model ID */
    selectedModelId: string | null;
    /** Callback when model is selected */
    onSelectModel: (modelId: string) => void;
    /** Whether models are loading */
    isLoading?: boolean;
    /** Optional CSS class */
    className?: string;
}

export interface ModelFilters {
    searchQuery: string;
    capability: 'all' | 'tool_call' | 'reasoning' | 'vision';
    maxInputCost: number | null;
}

/**
 * Icon component for search
 */
const IconSearch = (props: React.SVGProps<SVGSVGElement>) => (
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
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
    </svg>
);

/**
 * Icon component for filter
 */
const IconFilter = (props: React.SVGProps<SVGSVGElement>) => (
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
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
);

/**
 * Format cost for display
 */
function formatCost(cost: number | undefined): string {
    if (cost === undefined) return 'N/A';
    if (cost === 0) return 'Free';
    if (cost < 0.01) return `$${(cost * 1000).toFixed(3)}/1K`;
    return `$${cost.toFixed(2)}/1M`;
}

/**
 * Format context length for display
 */
function formatContextLength(length: number | undefined): string {
    if (length === undefined) return 'N/A';
    if (length >= 1000000) return `${(length / 1000000).toFixed(1)}M`;
    if (length >= 1000) return `${(length / 1000).toFixed(0)}K`;
    return `${length}`;
}

/**
 * Get capability badges for a model
 */
function getCapabilityBadges(model: ModelsDevModel): string[] {
    const badges: string[] = [];
    if (model.tool_call) badges.push('Tools');
    if (model.reasoning) badges.push('Reasoning');
    if (model.modalities?.input?.includes('image')) badges.push('Vision');
    if (model.modalities?.output?.includes('image')) badges.push('Image Gen');
    return badges;
}

/**
 * ModelSelector Component
 * 
 * Displays model list with search and filtering
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({
    models,
    selectedModelId,
    onSelectModel,
    isLoading = false,
    className = '',
}) => {
    const [filters, setFilters] = useState<ModelFilters>({
        searchQuery: '',
        capability: 'all',
        maxInputCost: null,
    });
    const [showFilters, setShowFilters] = useState(false);

    // Filter models based on search query and filters
    const filteredModels = useMemo(() => {
        let result = models;

        // Search filter
        if (filters.searchQuery.trim()) {
            const query = filters.searchQuery.toLowerCase();
            result = result.filter(model =>
                model.name.toLowerCase().includes(query) ||
                model.id.toLowerCase().includes(query) ||
                model.family?.toLowerCase().includes(query)
            );
        }

        // Capability filter
        if (filters.capability !== 'all') {
            result = result.filter(model => {
                switch (filters.capability) {
                    case 'tool_call':
                        return model.tool_call === true;
                    case 'reasoning':
                        return model.reasoning === true;
                    case 'vision':
                        return model.modalities?.input?.includes('image');
                    default:
                        return true;
                }
            });
        }

        // Cost filter
        if (filters.maxInputCost !== null) {
            result = result.filter(model => {
                const inputCost = model.cost?.input;
                return inputCost !== undefined && inputCost <= filters.maxInputCost!;
            });
        }

        return result;
    }, [models, filters]);

    // Handle loading state
    if (isLoading) {
        return (
            <div className={className}>
                <LoadingState message="Loading models..." size="sm" />
            </div>
        );
    }

    // Handle empty state
    if (models.length === 0) {
        return (
            <div className={`${className} p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-highlight)]`}>
                <p className="text-sm text-[var(--color-text-muted)]">
                    Select a provider to view available models
                </p>
            </div>
        );
    }

    return (
        <div className={className}>
            {/* Search and Filter Bar */}
            <div className="mb-2 space-y-2">
                {/* Search */}
                <div className="relative">
                    <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input
                        type="text"
                        value={filters.searchQuery}
                        onChange={(e) => setFilters({ ...filters, searchQuery: e.currentTarget.value })}
                        placeholder="Search models..."
                        className="
                            w-full pl-8 pr-10 py-1.5
                            bg-[var(--color-bg-highlight)]
                            border border-[var(--color-border)]
                            rounded-md
                            text-sm text-[var(--color-text-primary)]
                            placeholder:text-[var(--color-text-muted)]
                            focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
                            transition-all duration-200
                        "
                    />
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`
                            absolute right-2.5 top-1/2 -translate-y-1/2
                            p-1 rounded
                            transition-colors duration-200
                            ${showFilters 
                                ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' 
                                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                            }
                        `}
                        aria-label="Toggle filters"
                    >
                        <IconFilter />
                    </button>
                </div>

                {/* Filters */}
                {showFilters && (
                    <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-highlight)] space-y-3">
                        {/* Capability Filter */}
                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                                Capability
                            </label>
                            <select
                                value={filters.capability}
                                onChange={(e) => setFilters({ ...filters, capability: e.currentTarget.value as any })}
                                className="
                                    w-full px-3 py-1.5
                                    bg-[var(--color-bg-surface)]
                                    border border-[var(--color-border)]
                                    rounded text-sm
                                    text-[var(--color-text-primary)]
                                    focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
                                "
                            >
                                <option value="all">All Models</option>
                                <option value="tool_call">Tool Calling</option>
                                <option value="reasoning">Reasoning</option>
                                <option value="vision">Vision</option>
                            </select>
                        </div>

                        {/* Cost Filter */}
                        <div>
                            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
                                Max Input Cost (per 1M tokens)
                            </label>
                            <input
                                type="number"
                                value={filters.maxInputCost ?? ''}
                                onChange={(e) => setFilters({ 
                                    ...filters, 
                                    maxInputCost: e.currentTarget.value ? parseFloat(e.currentTarget.value) : null 
                                })}
                                placeholder="No limit"
                                step="0.01"
                                min="0"
                                className="
                                    w-full px-3 py-1.5
                                    bg-[var(--color-bg-surface)]
                                    border border-[var(--color-border)]
                                    rounded text-sm
                                    text-[var(--color-text-primary)]
                                    placeholder:text-[var(--color-text-muted)]
                                    focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]
                                "
                            />
                        </div>

                        {/* Clear Filters */}
                        <button
                            onClick={() => setFilters({ searchQuery: '', capability: 'all', maxInputCost: null })}
                            className="
                                w-full px-3 py-1.5
                                text-xs font-medium
                                text-[var(--color-text-secondary)]
                                hover:text-[var(--color-text-primary)]
                                border border-[var(--color-border)]
                                rounded
                                transition-colors duration-200
                            "
                        >
                            Clear Filters
                        </button>
                    </div>
                )}
            </div>

            {/* Model List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
                {filteredModels.length === 0 ? (
                    <div className="col-span-full p-3 text-center text-sm text-[var(--color-text-muted)]">
                        No models match your filters
                    </div>
                ) : (
                    filteredModels.map((model) => {
                        const badges = getCapabilityBadges(model);
                        const isSelected = selectedModelId === model.id;

                        return (
                            <button
                                key={model.id}
                                onClick={() => onSelectModel(model.id)}
                                className={`
                                    p-2.5 rounded-md
                                    border transition-all duration-200
                                    text-left
                                    ${isSelected
                                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                        : 'border-[var(--color-border)] bg-[var(--color-bg-highlight)] hover:border-[var(--color-primary)]/50'
                                    }
                                `}
                            >
                                <div className="space-y-1.5">
                                    {/* Model Name and Selection Indicator */}
                                    <div className="flex items-start justify-between gap-1.5">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-xs text-[var(--color-text-primary)] truncate">
                                                {model.name}
                                            </h4>
                                            <p className="text-[10px] text-[var(--color-text-muted)] truncate mt-0.5">
                                                {model.id}
                                            </p>
                                        </div>
                                        {isSelected && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] mt-0.5 flex-shrink-0" />
                                        )}
                                    </div>

                                    {/* Capability Badges */}
                                    {badges.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {badges.map((badge) => (
                                                <span
                                                    key={badge}
                                                    className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]"
                                                >
                                                    {badge}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Pricing and Context */}
                                    <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-muted)]">
                                        {model.cost && (
                                            <span className="truncate">
                                                {formatCost(model.cost.input)} / {formatCost(model.cost.output)}
                                            </span>
                                        )}
                                        {model.limit?.context && (
                                            <span className="flex-shrink-0">
                                                {formatContextLength(model.limit.context)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>

            {/* Results Count */}
            <div className="mt-2 text-xs text-[var(--color-text-muted)] text-center">
                Showing {filteredModels.length} of {models.length} models
            </div>
        </div>
    );
};
