/**
 * useProviders Hook
 * 
 * Custom hook for fetching and managing LLM providers and models
 * Uses tRPC to communicate with ModelRegistry service
 */

import { useState, useEffect, useCallback } from 'react';
import type { ProviderInfo } from '../../../../types/llm-config.js';
import type { ModelsDevModel } from '../../../../services/index.js';
import { useChatBridge } from '../../../ChatBridge.js';

/**
 * Hook return type
 */
export interface UseProvidersReturn {
    /** Available providers */
    providers: ProviderInfo[];
    /** Loading state for providers */
    loading: boolean;
    /** Error state */
    error: string | null;
    /** Fetch models for a specific provider */
    fetchModelsForProvider: (providerId: string) => Promise<ModelsDevModel[]>;
    /** Refresh providers from service */
    refresh: () => Promise<void>;
}

/**
 * useProviders Hook
 * 
 * Fetches providers from ModelRegistry
 * Provides method to fetch models for a selected provider
 * Handles loading and error states with fallback
 */
export function useProviders(): UseProvidersReturn {
    const [providers, setProviders] = useState<ProviderInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * Load providers from ModelRegistry via tRPC
     */
    const loadProviders = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch providers from ModelRegistry via tRPC
            const bridge = useChatBridge();
            const providerList = await bridge.getTrpcClient().modelRegistry.getProviders.query();

            // Convert to ProviderInfo format
            const formattedProviders: ProviderInfo[] = providerList.map(provider => ({
                id: provider.id,
                name: provider.name,
                requiresApiKey: true, // Most providers require API keys
            }));

            setProviders(formattedProviders);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load providers';
            setError(errorMessage);
            console.error('Error loading providers:', err);

            // No fallback - show empty list if API fails
            setProviders([]);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * Load providers on mount
     */
    useEffect(() => {
        void loadProviders();
    }, [loadProviders]);

    /**
     * Fetch models for a specific provider via tRPC
     */
    const fetchModelsForProvider = useCallback(async (providerId: string): Promise<ModelsDevModel[]> => {
        try {
            const bridge = useChatBridge();
            const models = await bridge.getTrpcClient().modelRegistry.getModels.query({ providerId });

            return models;
        } catch (err) {
            console.error(`Error fetching models for provider ${providerId}:`, err);

            // Return empty array on error (allows manual model entry)
            return [];
        }
    }, []);

    return {
        providers,
        loading,
        error,
        fetchModelsForProvider,
        refresh: loadProviders,
    };
}
