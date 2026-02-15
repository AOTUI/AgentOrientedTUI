/**
 * ModelList Component (V2)
 * 
 * Vertically scrollable list of model cards.
 * Displays models with active model first.
 * Shows loading and empty states.
 */

import React from 'react';
import { ModelCard } from './ModelCard.js';
import { LoadingState } from './LoadingState.js';
import { sortModels } from '../../hooks/useModels.js';
import type { ModelListProps } from './types.js';

/**
 * ModelList Component
 * 
 * Renders a vertically scrollable list of ModelCard components.
 * Automatically sorts models with active model first.
 * Handles loading and empty states.
 */
export const ModelList: React.FC<ModelListProps> = ({
    models,
    activeModelId,
    onSelectModel,
    isLoading = false,
}) => {
    // Sort models with active first
    const sortedModels = sortModels(models, activeModelId);

    // Handle loading state
    if (isLoading) {
        return (
            <LoadingState 
                message="Loading models..." 
                size="md"
            />
        );
    }

    // Handle empty state
    if (sortedModels.length === 0) {
        return (
            <div 
                className="flex items-center justify-center py-16 text-[var(--color-text-muted)]"
                role="status"
                aria-live="polite"
            >
                No models available. Please select a provider.
            </div>
        );
    }

    return (
        <div 
            className="model-list-container h-full min-h-0"
            role="list"
            aria-label="Model list"
        >
            <div 
                className="model-list-grid h-full min-h-0"
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 'clamp(8px, 1.5vw, 12px)',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    paddingRight: '8px',
                    paddingBottom: '8px',
                    WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
                }}
            >
                {sortedModels.map((model) => (
                    <ModelCard
                        key={model.id}
                        model={model}
                        isActive={model.id === activeModelId}
                        onSelect={() => onSelectModel(model.id)}
                    />
                ))}
            </div>
        </div>
    );
};
