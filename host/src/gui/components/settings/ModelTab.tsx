/**
 * ModelTab Component (V2)
 * 
 * Main component for provider and model selection.
 * Integrates all sub-components and manages state.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useProviderConfigs } from '../../hooks/useProviderConfigs.js';
import { useCustomProviders } from '../../hooks/useCustomProviders.js';
import { useModels } from '../../hooks/useModels.js';
import { useToast } from './hooks/useToast.js';
import { useScreenReaderAnnouncement } from './hooks/useScreenReaderAnnouncement.js';
import { filterProviders, filterModels } from './filters.js';
import { ProviderSearchBar } from './ProviderSearchBar.js';
import { ProviderRow } from './ProviderRow.js';
import { ModelSearchBar } from './ModelSearchBar.js';
import { ModelList } from './ModelList.js';
import { AddModelsToProviderModal } from './AddModelsToProviderModal.js';
import { AddProviderModal } from './AddProviderModal.js';
import { EditProviderModal } from './EditProviderModal.js';
import { EditCustomProviderModal } from './EditCustomProviderModal.js';
import { CustomModelList } from './CustomModelList.js';
import { DeleteConfirmDialog } from './DeleteConfirmDialog.js';
import { LoadingState } from './LoadingState.js';
import { ToastNotification } from './ToastNotification.js';
import type { ProviderConfig, NewProviderConfig, ProviderUpdates, NewCustomProviderInput, CustomProviderRecord } from './types.js';

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
        addCustomProviderModel,
        updateProvider,
        deleteProvider,
        setActiveProvider,
    } = useProviderConfigs();

    // Custom provider management hook
    const {
        customProviders,
        isLoading: isLoadingCustomProviders,
        createCustomProvider,
        updateCustomProvider,
        deleteCustomProvider,
    } = useCustomProviders();

    // Toast notifications hook
    const { toast, showSuccess, showError, showWarning, clearToast } = useToast();

    // Screen reader announcements hook
    const { announce } = useScreenReaderAnnouncement();

    // Local state for UI interactions
    const [selectedProviderConfigId, setSelectedProviderConfigId] = useState<number | null>(null);
    const [selectedCustomProviderId, setSelectedCustomProviderId] = useState<string | null>(null);
    const [providerSearchQuery, setProviderSearchQuery] = useState('');
    const [modelSearchQuery, setModelSearchQuery] = useState('');
    const [showAddProviderModal, setShowAddProviderModal] = useState(false);
    const [editingProvider, setEditingProvider] = useState<ProviderConfig | null>(null);
    const [deletingProvider, setDeletingProvider] = useState<ProviderConfig | null>(null);
    const [deletingCustomProvider, setDeletingCustomProvider] = useState<CustomProviderRecord | null>(null);
    // Shown right after a Custom Provider is created — lets user add model IDs immediately
    const [postCreateProvider, setPostCreateProvider] = useState<CustomProviderRecord | null>(null);
    // Edit modal for an existing Custom Provider (triggered from card edit button)
    const [editingCustomProvider, setEditingCustomProvider] = useState<CustomProviderRecord | null>(null);
    // Add Model modal shown for the currently-selected Custom Provider
    const [showAddModelForSelected, setShowAddModelForSelected] = useState(false);

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

    // Set initial selected provider to active provider (including custom providers)
    // Wait for both providers and customProviders to load before initializing
    useEffect(() => {
        // Skip if still loading or already have a selection
        if (isLoadingProviders || isLoadingCustomProviders) return;
        if (providers.length === 0 || (selectedProviderConfigId || selectedCustomProviderId)) return;
        
        // Find active provider
        const activeProvider = providers.find(p => p.isActive);
        if (!activeProvider) return;
        
        // Set selection based on provider type
        if (activeProvider.providerId.startsWith('custom:')) {
            // Custom provider: store the full "custom:xxx" id (matches CustomProviderRecord.id)
            setSelectedCustomProviderId(activeProvider.providerId);
        } else {
            // Template provider: set selection by DB id
            setSelectedProviderConfigId(activeProvider.id);
        }
    }, [providers, customProviders, isLoadingProviders, isLoadingCustomProviders, selectedProviderConfigId, selectedCustomProviderId]);

    /**
     * Handle provider selection (template provider)
     */
    const handleSelectProvider = useCallback((providerConfigId: number) => {
        setSelectedProviderConfigId(providerConfigId);
        setSelectedCustomProviderId(null);   // clear custom selection
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
     * Handle save new template provider
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
     * Handle save new custom provider
     */
    const handleSaveCustomProvider = useCallback(async (input: NewCustomProviderInput) => {
        try {
            const created = await createCustomProvider(input);
            setShowAddProviderModal(false);
            announce(`${input.name} custom provider created`, 'polite');
            // Open the follow-up "Add Models" dialog instead of going straight to detail
            setPostCreateProvider(created);
        } catch (error) {
            console.error('Failed to create custom provider:', error);
            showError('Failed to create custom provider. Please try again.');
            announce('Failed to create custom provider', 'assertive');
            throw error;
        }
    }, [createCustomProvider, showError, announce]);

    /**
     * Called from AddModelsToProviderModal when user adds a model to the just-created provider
     */
    const handleAddModelToPostCreateProvider = useCallback(async (modelId: string) => {
        if (!postCreateProvider) return;
        await addCustomProviderModel({
            customProviderId: postCreateProvider.id,
            modelId,
            name: `${postCreateProvider.name} / ${modelId}`,
        });
    }, [postCreateProvider, addCustomProviderModel]);

    /**
     * Called when user finishes (Done / Open Provider) in the post-create dialog
     */
    const handlePostCreateDone = useCallback(() => {
        if (postCreateProvider) {
            showSuccess(`Custom provider "${postCreateProvider.name}" ready`);
            setSelectedCustomProviderId(postCreateProvider.id);
            setSelectedProviderConfigId(null);
        }
        setPostCreateProvider(null);
    }, [postCreateProvider, showSuccess]);

    /**
     * Handle selecting a custom provider card
     */
    const handleSelectCustomProvider = useCallback((id: string) => {
        setSelectedCustomProviderId(id);
        setSelectedProviderConfigId(null);
        setModelSearchQuery('');
    }, []);

    /**
     * Handle edit custom provider (opens edit modal from card)
     */
    const handleEditCustomProvider = useCallback((cp: CustomProviderRecord) => {
        setEditingCustomProvider(cp);
    }, []);

    /**
     * Handle delete custom provider request (opens confirmation dialog)
     */
    const handleDeleteCustomProviderRequest = useCallback((cp: CustomProviderRecord) => {
        setDeletingCustomProvider(cp);
    }, []);

    /**
     * Handle confirm custom provider deletion
     */
    const handleConfirmDeleteCustomProvider = useCallback(async () => {
        if (!deletingCustomProvider) return;
        try {
            await deleteCustomProvider(deletingCustomProvider.id);
            if (selectedCustomProviderId === deletingCustomProvider.id) {
                setSelectedCustomProviderId(null);
            }
            setDeletingCustomProvider(null);
            showSuccess(`Custom provider "${deletingCustomProvider.name}" deleted`);
            announce(`${deletingCustomProvider.name} custom provider deleted`, 'polite');
        } catch (error) {
            console.error('Failed to delete custom provider:', error);
            showError('Failed to delete custom provider.');
        }
    }, [deletingCustomProvider, deleteCustomProvider, selectedCustomProviderId, showSuccess, showError, announce]);

    /**
     * Handle update custom provider (from CustomProviderDetail inline edit)
     */
    const handleUpdateCustomProvider = useCallback(async (id: string, updates: Parameters<typeof updateCustomProvider>[1]) => {
        try {
            await updateCustomProvider(id, updates);
            showSuccess('Custom provider updated');
        } catch (error) {
            console.error('Failed to update custom provider:', error);
            showError('Failed to update custom provider.');
            throw error;
        }
    }, [updateCustomProvider, showSuccess, showError]);

    /**
     * Handle adding a model to the currently selected custom provider
     */
    const handleAddModelToSelectedProvider = useCallback(async (modelId: string) => {
        if (!selectedCustomProviderId) return;
        const cp = customProviders.find(c => c.id === selectedCustomProviderId);
        await addCustomProviderModel({
            customProviderId: selectedCustomProviderId,
            modelId,
            name: `${cp?.name ?? ''} / ${modelId}`,
        });
    }, [selectedCustomProviderId, customProviders, addCustomProviderModel]);

    /**
     * Handle deleting a model config under a custom provider
     */
    const handleDeleteModelFromCustomProvider = useCallback(async (configId: number) => {
        try {
            await deleteProvider(configId);
            showSuccess('Model removed');
        } catch (error) {
            console.error('Failed to remove model:', error);
            showError('Failed to remove model.');
            throw error;
        }
    }, [deleteProvider, showSuccess, showError]);

    /**
     * Handle activating a model config under a custom provider
     */
    const handleActivateModelOfCustomProvider = useCallback(async (configId: number) => {
        try {
            await setActiveProvider(configId);
            showSuccess('Model activated');
        } catch (error) {
            console.error('Failed to activate model:', error);
            showError('Failed to activate model.');
            throw error;
        }
    }, [setActiveProvider, showSuccess, showError]);

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
    // Exclude custom: provider records — those LLMConfigRecords are linked to CustomProviderRecord entries
    // and are already represented in the customProviders section of ProviderRow.
    const filteredProviders = filterProviders(
        providers.filter(p => !p.providerId.startsWith('custom:')),
        providerSearchQuery,
    );

    // Filter models based on search query
    const filteredModels = filterModels(models, modelSearchQuery);
    const effectiveActiveModelId = selectedProvider?.isActive ? (selectedProvider.model || activeModelId) : null;

    // Derived: selected custom provider record + its linked ProviderConfigs
    const selectedCustomProvider = selectedCustomProviderId
        ? customProviders.find(cp => cp.id === selectedCustomProviderId) ?? null
        : null;
    // ProviderConfigs linked to the selected custom provider: selectedCustomProviderId is already "custom:xxx"
    const linkedConfigs = selectedCustomProviderId
        ? providers.filter(p => p.providerId === selectedCustomProviderId)
        : [];
    const customProviderIsActive = linkedConfigs.some(c => c.isActive);

    // Derive which custom providers have at least one active model config
    // Uses full "custom:xxx" ids to match CustomProviderRecord.id used by ProviderRow
    const activeCustomProviderIds = useMemo(
        () => new Set(
            providers
                .filter(p => p.providerId.startsWith('custom:') && p.isActive)
                .map(p => p.providerId)   // keep full "custom:xxx" to match CustomProviderRecord.id
        ),
        [providers],
    );

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
                        customProviders={customProviders}
                        selectedCustomProviderId={selectedCustomProviderId}
                        onSelectCustomProvider={handleSelectCustomProvider}
                        onDeleteCustomProvider={handleDeleteCustomProviderRequest}
                        onEditCustomProvider={handleEditCustomProvider}
                        activeCustomProviderIds={activeCustomProviderIds}
                    />
                </div>
            </div>

            {/* Models section — heading always visible; right side switches between search and add-model */}
            <div>
                <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_auto] sm:items-center mb-2 sm:mb-3">
                    <h3 className="text-[11px] sm:text-[13px] font-medium text-[var(--color-text-secondary)]">
                        Models Of {selectedCustomProvider ? selectedCustomProvider.name : selectedProviderName}
                    </h3>
                    <div className="w-full sm:w-[220px] sm:justify-self-end flex justify-end">
                        {selectedCustomProviderId ? (
                            <button
                                onClick={() => setShowAddModelForSelected(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium
                                    border border-[var(--mat-border)]
                                    text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]
                                    hover:border-[var(--color-accent)]/40 hover:bg-[var(--mat-content-card-hover-bg)]
                                    transition-all duration-150"
                            >
                                + Add Model
                            </button>
                        ) : (
                            <ModelSearchBar
                                searchQuery={modelSearchQuery}
                                onSearchChange={setModelSearchQuery}
                                disabled={!selectedProviderId}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Model list content — CustomModelList for custom providers, ModelList for template providers */}
            {selectedCustomProviderId ? (
                <div className="min-h-0 flex-1">
                    <CustomModelList
                        configs={linkedConfigs}
                        onActivate={handleActivateModelOfCustomProvider}
                        onDelete={handleDeleteModelFromCustomProvider}
                        onAddModel={() => setShowAddModelForSelected(true)}
                    />
                </div>
            ) : selectedProviderId ? (
                <div className="min-h-0 flex-1">
                    <ModelList
                        models={filteredModels}
                        activeModelId={effectiveActiveModelId}
                        onSelectModel={handleSelectModel}
                        isLoading={isLoadingModels}
                    />
                </div>
            ) : (
                <div className="flex items-center justify-center py-16 text-[var(--color-text-tertiary)]">
                    No provider selected. Please select a provider from the list above.
                </div>
            )}

            {/* Add Provider Modal */}
            <AddProviderModal
                isOpen={showAddProviderModal}
                onClose={() => setShowAddProviderModal(false)}
                onSave={handleSaveNewProvider}
                onSaveCustom={handleSaveCustomProvider}
            />

            {/* Edit Provider Modal */}
            <EditProviderModal
                isOpen={!!editingProvider}
                provider={editingProvider}
                onClose={() => setEditingProvider(null)}
                onSave={handleSaveProviderUpdates}
            />

            {/* Delete Confirmation Dialog (template providers) */}
            <DeleteConfirmDialog
                isOpen={!!deletingProvider}
                providerName={deletingProvider?.customName || ''}
                isActive={deletingProvider?.isActive || false}
                onClose={() => setDeletingProvider(null)}
                onConfirm={handleConfirmDelete}
            />

            {/* Post-create: add model IDs immediately after custom provider creation */}
            {postCreateProvider && (
                <AddModelsToProviderModal
                    isOpen={true}
                    provider={postCreateProvider}
                    onAddModel={handleAddModelToPostCreateProvider}
                    onDone={handlePostCreateDone}
                />
            )}

            {/* Edit Custom Provider modal (triggered from card edit button) */}
            <EditCustomProviderModal
                isOpen={!!editingCustomProvider}
                provider={editingCustomProvider}
                onClose={() => setEditingCustomProvider(null)}
                onSave={handleUpdateCustomProvider}
            />

            {/* Add Model modal for the currently-selected Custom Provider */}
            {showAddModelForSelected && selectedCustomProvider && (
                <AddModelsToProviderModal
                    isOpen={true}
                    provider={selectedCustomProvider}
                    onAddModel={handleAddModelToSelectedProvider}
                    onDone={() => setShowAddModelForSelected(false)}
                />
            )}

            {/* Delete Confirmation Dialog (custom providers) */}
            <DeleteConfirmDialog
                isOpen={!!deletingCustomProvider}
                providerName={deletingCustomProvider?.name || ''}
                isActive={customProviderIsActive}
                onClose={() => setDeletingCustomProvider(null)}
                onConfirm={handleConfirmDeleteCustomProvider}
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
