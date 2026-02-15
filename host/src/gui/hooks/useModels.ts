/**
 * useModels Hook
 * 
 * Custom hook for fetching and managing models from ModelRegistry via tRPC
 * Integrates with models.dev API for model metadata
 */

import { useState, useEffect, useCallback } from 'react';
import { createTRPCProxyClient } from '@trpc/client';
import { ipcLink } from 'electron-trpc/renderer';
import superjson from 'superjson';
import type { AppRouter } from '../../trpc/router-types.js';
import type { ModelsDevModel } from '../../services/index.js';

export interface UseModelsResult {
    models: ModelsDevModel[];
    activeModelId: string | null;
    isLoading: boolean;
    error: Error | null;
    refresh: () => void;
}

/**
 * Create tRPC client for ModelRegistry
 */
function createTrpcClient() {
    return createTRPCProxyClient<AppRouter>({
        transformer: superjson,
        links: [ipcLink()],
    });
}

/**
 * Sort models with active model first
 */
export function sortModels(models: ModelsDevModel[], activeModelId: string | null): ModelsDevModel[] {
    if (!activeModelId) {
        return models;
    }

    return [...models].sort((a, b) => {
        if (a.id === activeModelId && b.id !== activeModelId) return -1;
        if (a.id !== activeModelId && b.id === activeModelId) return 1;
        return 0;
    });
}

/**
 * useModels Hook
 * 
 * Fetches models from ModelRegistry for a selected provider
 * Handles loading and error states with fallback
 * Clears models when provider changes
 */
export function useModels(providerId: string | null, activeModelId: string | null = null): UseModelsResult {
    const [models, setModels] = useState<ModelsDevModel[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);

    /**
     * Load models from ModelRegistry via tRPC
     */
    const loadModels = useCallback(async () => {
        // Clear models if no provider selected
        if (!providerId) {
            setModels([]);
            setIsLoading(false);
            setError(null);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const trpcClient = createTrpcClient();
            const modelList = await trpcClient.modelRegistry.getModels.query({ providerId });

            // Sort models with active model first
            const sortedModels = sortModels(modelList, activeModelId);

            setModels(sortedModels);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            // Set empty array on error to show empty state
            setModels([]);
        } finally {
            setIsLoading(false);
        }
    }, [providerId, activeModelId]);

    /**
     * Refresh models
     */
    const refresh = useCallback(() => {
        loadModels();
    }, [loadModels]);

    // Load models when provider changes
    useEffect(() => {
        loadModels();
    }, [loadModels]);

    return {
        models,
        activeModelId,
        isLoading,
        error,
        refresh,
    };
}
