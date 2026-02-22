/**
 * ModelTab Component (V2)
 * 
 * Main component for provider and model selection.
 * Integrates all sub-components and manages state.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useProviderConfigs } from '../../hooks/useProviderConfigs.js';
import { useModels } from '../../hooks/useModels.js';
import { useToast } from './hooks/useToast.js';
import { useScreenReaderAnnouncement } from './hooks/useScreenReaderAnnouncement.js';
import { filterProviders, filterModels } from './filters.js';
import { ProviderSearchBar } from './ProviderSearchBar.js';
import { ProviderRow } from './ProviderRow.js';
import { ModelSearchBar } from './ModelSearchBar.js';
import { ModelList } from './ModelList.js';
import { AddProviderModal } from './AddProviderModal.js';
import { EditProviderModal } from './EditProviderModal.js';
import { DeleteConfirmDialog } from './DeleteConfirmDialog.js';
import { LoadingState } from './LoadingState.js';
import { ToastNotification } from './ToastNotification.js';
import type { ProviderConfig, NewProviderConfig, ProviderUpdates } from './types.js';

/**
 * ModelTab Component
 * 
 * Displays and manages provider and model configurations.
 * Handles provider selection, CRUD operations, and model selection.
 * 
 * Requirements: 2.1-2.6, 3.1-3.7, 4.1-4.4, 5.1-5.11, 6.1-6.11, 7.1-7.5, 8.1-8.5, 9.1-9.5
 */
export const ModelTab: React.FC = () => {
    // Provider management hook
    const {
        providers,
        activeProviderId,
        isLoading: isLoadingProviders,
        error: providerError,
        addProvider,
        updateProvider,
        deleteProvider,
        setActiveProvider,
    } = useProviderConfigs();

    // Toast notifications hook
    const { toast, showSuccess, showError, showWarning, clearToast } = useToast();

    // Screen reader announcements hook
    const { announce } = useScreenReaderAnnouncement();

    // Local state for UI interactions
    const [selectedProviderConfigId, setSelectedProviderConfigId] = useState<number | null>(null);
    const [providerSearchQuery, setProviderSearchQuery] = useState('');
    const [modelSearchQuery, setModelSearchQuery] = useState('');
    const [showAddProviderModal, setShowAddProviderModal] = useState(false);
    const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);
    const [deletingProvider, setDeletingProvider] = useState<ProviderConfig | null>(null);

    // Get selected provider's providerId for fetching models
    const selectedProvider = providers.find(p => p.id === selectedProviderConfigId);
    const selectedProviderId = selectedProvider?.providerId || null;
    const selectedProviderName = selectedProvider?.customName || selectedProvider?.providerId || 'Provider';

    // Models management hook
    const {
        models,
        activeModelId,
        isLoading: isLoadingModels,
        error: modelsError,
    } = useModels(selectedProviderId, activeProviderId ? `${activeProviderId}/model` : null);

    // Show warning toast when models fail to load
    useEffect(() => {
        if (modelsError) {
            showWarning('Failed to load models. Using cached data if available.');
        }
    }, [modelsError, showWarning]);

    // Set initial selected provider to active provider
    useEffect(() => {
        if (providers.length > 0 && !selectedProviderConfigId) {
            const activeProvider = providers.find(p => p.isActive);
            if (activeProvider) {
                setSelectedProviderConfigId(activeProvider.id);
            }
        }
    }, [providers, selectedProviderConfigId]);

    /**
     * Handle provider selection
     */
    const handleSelectProvider = useCallback((providerConfigId: number) => {
        setSelectedProviderConfigId(providerConfigId);
        // Clear model search when provider changes
        setModelSearchQuery('');
        
        // Announce provider selection
        const provider = providers.find(p => p.id === providerConfigId);
        if (provider) {
            announce(`${provider.customName} provider selected`, 'polite');
        }
    }, [providers, announce]);

    /**
     * Handle add provider button click
     */
    const handleAddProvider = useCallback(() => {
        setShowAddProviderModal(true);
    }, []);

    /**
     * Handle save new provider
     */
    const handleSaveNewProvider = useCallback(async (config: NewProviderConfig) => {
        try {
            await addProvider(config);
            setShowAddProviderModal(false);
            showSuccess('Provider added successfully');
            announce(`${config.customName} provider added successfully`, 'polite');
        } catch (error) {
            console.error('Failed to add provider:', error);
            showError('Failed to add provider. Please try again.');
            announce('Failed to add provider', 'assertive');
            throw error;
        }
    }, [addProvider, showSuccess, showError, announce]);

    /**
     * Handle edit provider button click
     */
    const handleEditProvider = useCallback((provider: ProviderConfig) => {
        setEditingProvider(provider);
    }, []);

    /**
     * Handle save provider updates
     */
    const handleSaveProviderUpdates = useCallback(async (id: number, updates: ProviderUpdates) => {
        try {
            await updateProvider(id, updates);
            setEditingProvider(null);
            showSuccess('Provider updated successfully');
            announce('Provider updated successfully', 'polite');
        } catch (error) {
            console.error('Failed to update provider:', error);
            showError('Failed to update provider. Please try again.');
            announce('Failed to update provider', 'assertive');
            throw error;
        }
    }, [updateProvider, showSuccess, showError, announce]);

    /**
     * Handle delete provider button click
     */
    const handleDeleteProvider = useCallback((provider: ProviderConfig) => {
        setDeletingProvider(provider);
    }, []);

    /**
     * Handle confirm provider deletion
     */
    const handleConfirmDelete = useCallback(async () => {
        if (!deletingProvider) return;

        try {
            await deleteProvider(deletingProvider.id);
            
            // If deleted provider was selected, clear selection
            if (selectedProviderConfigId === deletingProvider.id) {
                setSelectedProviderConfigId(null);
            }
            
            setDeletingProvider(null);
            showSuccess('Provider deleted successfully');
            announce(`${deletingProvider.customName} provider deleted`, 'polite');
        } catch (error) {
            console.error('Failed to delete provider:', error);
            showError('Failed to delete provider. Please try again.');
            announce('Failed to delete provider', 'assertive');
        }
    }, [deletingProvider, deleteProvider, selectedProviderConfigId, showSuccess, showError, announce]);

    /**
     * Handle model selection
     */
    const handleSelectModel = useCallback(async (modelId: string) => {
        if (!selectedProviderConfigId) return;

        try {
            // Find the provider config for the selected provider
            const provider = providers.find(p => p.id === selectedProviderConfigId);
            if (provider) {
                // Update the provider with the new model and set it as active
                await updateProvider(provider.id, { model: modelId });
                await setActiveProvider(provider.id);
                showSuccess('Model selected successfully');
                
                // Announce model selection
                const model = models.find(m => m.id === modelId);
                if (model) {
                    announce(`${model.name} model selected and activated`, 'polite');
                }
            }
        } catch (error) {
            console.error('Failed to select model:', error);
            showError('Failed to select model. Please try again.');
            announce('Failed to select model', 'assertive');
        }
    }, [selectedProviderConfigId, providers, models, updateProvider, setActiveProvider, showSuccess, showError, announce]);

    // Filter providers based on search query
    const filteredProviders = filterProviders(providers, providerSearchQuery);

    // Filter models based on search query
    const filteredModels = filterModels(models, modelSearchQuery);
    const effectiveActiveModelId = selectedProvider?.isActive ? (selectedProvider.model || activeModelId) : null;

    // Handle loading state
    if (isLoadingProviders) {
        return <LoadingState message="Loading providers..." size="md" />;
    }

    // Handle error state
    if (providerError) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="text-[var(--color-danger)] text-center">
                    <p className="font-medium mb-2">Failed to load providers</p>
                    <p className="text-[13px] text-[var(--color-text-tertiary)]">{providerError.message}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col gap-4 sm:gap-5 md:gap-6">
            {/* Provider row */}
            <div>
                <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_auto] sm:items-center mb-2 sm:mb-3">
                    <h3 className="text-[11px] sm:text-[13px] font-medium text-[var(--color-text-secondary)]">
                        Providers
                    </h3>
                    <div className="w-full sm:w-[220px] sm:justify-self-end">
                        <div className="flex-1">
                            <ProviderSearchBar
                                searchQuery={providerSearchQuery}
                                onSearchChange={setProviderSearchQuery}
                            />
                        </div>
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <ProviderRow
                        providers={filteredProviders}
                        selectedProviderId={selectedProviderConfigId}
                        activeProviderId={activeProviderId}
                        onSelectProvider={handleSelectProvider}
                        onEditProvider={handleEditProvider}
                        onDeleteProvider={handleDeleteProvider}
                        onAddProvider={handleAddProvider}
                    />
                </div>
            </div>

            {/* Model search bar */}
            <div>
                <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_auto] sm:items-center mb-2 sm:mb-3">
                    <h3 className="text-[11px] sm:text-[13px] font-medium text-[var(--color-text-secondary)]">
                        Models Of {selectedProviderName}
                    </h3>
                    <div className="w-full sm:w-[220px] sm:justify-self-end">
                        <ModelSearchBar
                            searchQuery={modelSearchQuery}
                            onSearchChange={setModelSearchQuery}
                            disabled={!selectedProviderId}
                        />
                    </div>
                </div>
            </div>

            {/* Model list */}
            <div className="min-h-0 flex-1">
                <ModelList
                    models={filteredModels}
                    activeModelId={effectiveActiveModelId}
                    onSelectModel={handleSelectModel}
                    isLoading={isLoadingModels}
                />
            </div>

            {/* Add Provider Modal */}
            <AddProviderModal
                isOpen={showAddProviderModal}
                onClose={() => setShowAddProviderModal(false)}
                onSave={handleSaveNewProvider}
            />

            {/* Edit Provider Modal */}
            <EditProviderModal
                isOpen={!!editingProvider}
                provider={editingProvider}
                onClose={() => setEditingProvider(null)}
                onSave={handleSaveProviderUpdates}
            />

            {/* Delete Confirmation Dialog */}
            <DeleteConfirmDialog
                isOpen={!!deletingProvider}
                providerName={deletingProvider?.customName || ''}
                isActive={deletingProvider?.isActive || false}
                onClose={() => setDeletingProvider(null)}
                onConfirm={handleConfirmDelete}
            />

            {/* Toast Notification */}
            <ToastNotification
                message={toast.message}
                type={toast.type}
                onClose={clearToast}
            />
        </div>
    );
};
