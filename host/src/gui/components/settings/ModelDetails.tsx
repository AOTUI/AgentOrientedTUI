/**
 * ModelDetails Component
 * 
 * Displays detailed information about a selected model
 * Shows pricing, capabilities, context limits, and recommended configuration
 */

import React from 'react';
import type { ModelsDevModel } from '../../../services/index.js';

export interface ModelDetailsProps {
    /** Model to display details for */
    model: ModelsDevModel | null;
    /** Optional CSS class */
    className?: string;
}

/**
 * Icon component for info
 */
const IconInfo = (props: React.SVGProps<SVGSVGElement>) => (
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
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
    </svg>
);

/**
 * Icon component for check
 */
const IconCheck = (props: React.SVGProps<SVGSVGElement>) => (
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
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

/**
 * Icon component for x
 */
const IconX = (props: React.SVGProps<SVGSVGElement>) => (
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
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

/**
 * Format cost for display
 */
function formatCost(cost: number | undefined): string {
    if (cost === undefined) return 'N/A';
    if (cost === 0) return 'Free';
    return `$${cost.toFixed(4)} per 1M tokens`;
}

/**
 * Format context length for display
 */
function formatContextLength(length: number | undefined): string {
    if (length === undefined) return 'N/A';
    if (length >= 1000000) return `${(length / 1000000).toFixed(1)}M tokens`;
    if (length >= 1000) return `${(length / 1000).toFixed(0)}K tokens`;
    return `${length} tokens`;
}

/**
 * Get recommended configuration based on model capabilities
 */
function getRecommendedConfig(model: ModelsDevModel): { temperature: number; maxSteps: number } {
    // Reasoning models benefit from lower temperature and more steps
    if (model.reasoning) {
        return { temperature: 0.5, maxSteps: 20 };
    }
    
    // Tool-calling models work well with moderate settings
    if (model.tool_call) {
        return { temperature: 0.7, maxSteps: 15 };
    }
    
    // Default configuration
    return { temperature: 0.7, maxSteps: 10 };
}

/**
 * DetailRow Component
 * 
 * Displays a single detail row with label and value
 */
const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[var(--color-border)] last:border-b-0">
        <span className="text-sm font-medium text-[var(--color-text-secondary)] flex-shrink-0">
            {label}
        </span>
        <span className="text-sm text-[var(--color-text-primary)] text-right">
            {value}
        </span>
    </div>
);

/**
 * CapabilityBadge Component
 * 
 * Displays a capability with check or x icon
 */
const CapabilityBadge: React.FC<{ label: string; enabled: boolean }> = ({ label, enabled }) => (
    <div className={`
        flex items-center gap-2 px-3 py-2 rounded-lg
        ${enabled 
            ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
            : 'bg-[var(--color-bg-highlight)] text-[var(--color-text-tertiary)]'
        }
    `}>
        {enabled ? (
            <IconCheck className="w-4 h-4 flex-shrink-0" />
        ) : (
            <IconX className="w-4 h-4 flex-shrink-0" />
        )}
        <span className="text-sm font-medium">{label}</span>
    </div>
);

/**
 * ModelDetails Component
 * 
 * Displays comprehensive model information
 */
export const ModelDetails: React.FC<ModelDetailsProps> = ({
    model,
    className = '',
}) => {
    // Handle no model selected
    if (!model) {
        return (
            <div className={`${className} p-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-highlight)]`}>
                <div className="flex items-center gap-3 text-[var(--color-text-tertiary)]">
                    <IconInfo />
                    <p className="text-sm">
                        Select a model to view detailed information
                    </p>
                </div>
            </div>
        );
    }

    const recommendedConfig = getRecommendedConfig(model);

    return (
        <div className={`${className} space-y-4`}>
            {/* Model Header */}
            <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-highlight)]">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                    {model.name}
                </h3>
                <p className="text-sm text-[var(--color-text-tertiary)]">
                    {model.id}
                </p>
                {model.family && (
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                        Family: {model.family}
                    </p>
                )}
            </div>

            {/* Capabilities */}
            <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-highlight)]">
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                    Capabilities
                </h4>
                <div className="grid grid-cols-2 gap-2">
                    <CapabilityBadge label="Tool Calling" enabled={model.tool_call === true} />
                    <CapabilityBadge label="Reasoning" enabled={model.reasoning === true} />
                    <CapabilityBadge 
                        label="Vision" 
                        enabled={model.modalities?.input?.includes('image') === true} 
                    />
                    <CapabilityBadge 
                        label="Image Gen" 
                        enabled={model.modalities?.output?.includes('image') === true} 
                    />
                </div>
            </div>

            {/* Pricing */}
            {model.cost && (
                <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-highlight)]">
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                        Pricing
                    </h4>
                    <div className="space-y-0">
                        <DetailRow label="Input" value={formatCost(model.cost.input)} />
                        <DetailRow label="Output" value={formatCost(model.cost.output)} />
                        {model.cost.cache_read !== undefined && (
                            <DetailRow label="Cache Read" value={formatCost(model.cost.cache_read)} />
                        )}
                        {model.cost.cache_write !== undefined && (
                            <DetailRow label="Cache Write" value={formatCost(model.cost.cache_write)} />
                        )}
                    </div>
                </div>
            )}

            {/* Context Limits */}
            {model.limit && (
                <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-highlight)]">
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                        Context Limits
                    </h4>
                    <div className="space-y-0">
                        {model.limit.context !== undefined && (
                            <DetailRow label="Context Window" value={formatContextLength(model.limit.context)} />
                        )}
                        {model.limit.output !== undefined && (
                            <DetailRow label="Max Output" value={formatContextLength(model.limit.output)} />
                        )}
                    </div>
                </div>
            )}

            {/* Recommended Configuration */}
            <div className="p-4 rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5">
                <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                    <IconInfo className="text-[var(--color-accent)]" />
                    Recommended Configuration
                </h4>
                <div className="space-y-0">
                    <DetailRow 
                        label="Temperature" 
                        value={
                            <span>
                                {recommendedConfig.temperature}
                                <span className="text-xs text-[var(--color-text-tertiary)] ml-2">
                                    ({model.reasoning ? 'Lower for reasoning' : 'Balanced'})
                                </span>
                            </span>
                        } 
                    />
                    <DetailRow 
                        label="Max Steps" 
                        value={
                            <span>
                                {recommendedConfig.maxSteps}
                                <span className="text-xs text-[var(--color-text-tertiary)] ml-2">
                                    ({model.reasoning ? 'More for complex tasks' : 'Standard'})
                                </span>
                            </span>
                        } 
                    />
                </div>
            </div>

            {/* Additional Info */}
            {(model.release_date || model.last_updated || model.open_weights !== undefined) && (
                <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-highlight)]">
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                        Additional Information
                    </h4>
                    <div className="space-y-0">
                        {model.release_date && (
                            <DetailRow label="Release Date" value={model.release_date} />
                        )}
                        {model.last_updated && (
                            <DetailRow label="Last Updated" value={model.last_updated} />
                        )}
                        {model.open_weights !== undefined && (
                            <DetailRow 
                                label="Open Weights" 
                                value={model.open_weights ? 'Yes' : 'No'} 
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
