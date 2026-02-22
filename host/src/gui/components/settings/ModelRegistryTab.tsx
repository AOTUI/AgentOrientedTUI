/**
 * ModelRegistryTab Component
 * 
 * Integrated view for browsing and exploring models from ModelRegistry
 * Combines provider selection, model browsing, and detailed information
 */

import React, { useState, useCallback } from 'react';
import { ProviderSelector } from './ProviderSelector.js';
import { ModelSelector } from './ModelSelector.js';
import { ModelDetails } from './ModelDetails.js';
import { ModelRegistryRefresh } from './ModelRegistryRefresh.js';
import { useModels } from '../../hooks/useModels.js';
import type { ModelsDevModel } from '../../../services/index.js';

/**
 * ModelRegistryTab Component
 * 
 * Main tab for exploring ModelRegistry data
 * Provides a comprehensive interface for browsing providers and models
 */
export const ModelRegistryTab: React.FC = () => {
    const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
    const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState<ModelsDevModel | null>(null);

    // Fetch models for selected provider
    const { models, isLoading, error, refresh } = useModels(selectedProviderId, null);

    /**
     * Handle provider selection
     */
    const handleSelectProvider = useCallback((providerId: string) => {
        setSelectedProviderId(providerId);
        setSelectedModelId(null);
        setSelectedModel(null);
    }, []);

    /**
     * Handle model selection
     */
    const handleSelectModel = useCallback((modelId: string) => {
        setSelectedModelId(modelId);
        const model = models.find(m => m.id === modelId);
        setSelectedModel(model || null);
    }, [models]);

    /**
     * Handle refresh complete
     */
    const handleRefreshComplete = useCallback(() => {
        // Refresh models if a provider is selected
        if (selectedProviderId) {
            refresh();
        }
    }, [selectedProviderId, refresh]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">
                    Model Registry
                </h2>
                <p className="text-sm text-[var(--color-text-tertiary)]">
                    Browse and explore available LLM providers and models from models.dev
                </p>
            </div>

            {/* Cache Status and Refresh */}
            <ModelRegistryRefresh onRefreshComplete={handleRefreshComplete} />

            {/* Main Content - Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Provider and Model Selection */}
                <div className="space-y-6">
                    {/* Provider Selection */}
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                            Select Provider
                        </h3>
                        <ProviderSelector
                            selectedProviderId={selectedProviderId}
                            onSelectProvider={handleSelectProvider}
                        />
                    </div>

                    {/* Model Selection */}
                    {selectedProviderId && (
                        <div>
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                                Select Model
                            </h3>
                            <ModelSelector
                                models={models}
                                selectedModelId={selectedModelId}
                                onSelectModel={handleSelectModel}
                                isLoading={isLoading}
                            />
                            {error && (
                                <div className="mt-3 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
                                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                                        Failed to load models. Using cached data if available.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right Column - Model Details */}
                <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
                        Model Details
                    </h3>
                    <ModelDetails model={selectedModel} />
                </div>
            </div>

            {/* Info Footer */}
            <div className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-highlight)]">
                <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
                    <strong className="text-[var(--color-text-secondary)]">Note:</strong> This is a read-only view of available models from models.dev. 
                    To configure and use these models, go to the "Model" tab to create provider configurations with your API keys.
                </p>
            </div>
        </div>
    );
};
