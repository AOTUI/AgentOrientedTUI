/**
 * useModelRegistry Hook
 * 
 * Custom hook for fetching provider and model data from ModelRegistry via tRPC
 * Provides access to models.dev API data through the main process
 */

import { useState, useEffect, useCallback } from 'react';
import { createTRPCProxyClient } from '@trpc/client';
import { ipcLink } from 'electron-trpc/renderer';
import superjson from 'superjson';
import type { AppRouter } from '../../trpc/router-types.js';

/**
 * Provider info from ModelRegistry
 */
export interface ProviderInfo {
    id: string;
    name: string;
    baseURL: string;
    modelCount: number;
}

/**
 * Provider config from ModelRegistry
 */
export interface ProviderConfig {
    id: string;
    name: string;
    baseURL: string;
    envKeys: string[];
    supportedModels: string[];
}

/**
 * Cache status from ModelRegistry
 */
export interface CacheStatus {
    lastFetch: number;
    isStale: boolean;
    providerCount: number;
    modelCount: number;
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
 * useModelRegistryProviders Hook
 * 
 * Fetches provider list from ModelRegistry
 */
export function useModelRegistryProviders() {
    const [providers, setProviders] = useState<ProviderInfo[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const loadProviders = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const trpcClient = createTrpcClient();
            const providerList = await trpcClient.modelRegistry.getProviders.query();

            console.log('[useModelRegistryProviders] Loaded providers:', providerList);

            // Ensure we always set an array
            if (Array.isArray(providerList)) {
                setProviders(providerList);
            } else {
                console.error('[useModelRegistryProviders] Invalid provider list format:', providerList);
                setProviders([]);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('[useModelRegistryProviders] Error loading providers:', error);
            setError(error);
            setProviders([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const refresh = useCallback(() => {
        loadProviders();
    }, [loadProviders]);

    useEffect(() => {
        loadProviders();
    }, [loadProviders]);

    return {
        providers,
        isLoading,
        error,
        refresh,
    };
}

/**
 * useModelRegistryProvider Hook
 * 
 * Fetches detailed provider config from ModelRegistry
 */
export function useModelRegistryProvider(providerId: string | null) {
    const [provider, setProvider] = useState<ProviderConfig | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);

    const loadProvider = useCallback(async () => {
        if (!providerId) {
            setProvider(null);
            setIsLoading(false);
            setError(null);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const trpcClient = createTrpcClient();
            const providerConfig = await trpcClient.modelRegistry.getProviderConfig.query({ providerId });

            setProvider(providerConfig);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            setProvider(null);
        } finally {
            setIsLoading(false);
        }
    }, [providerId]);

    const refresh = useCallback(() => {
        loadProvider();
    }, [loadProvider]);

    useEffect(() => {
        loadProvider();
    }, [loadProvider]);

    return {
        provider,
        isLoading,
        error,
        refresh,
    };
}

/**
 * useModelRegistryCacheStatus Hook
 * 
 * Fetches cache status from ModelRegistry
 */
export function useModelRegistryCacheStatus() {
    const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const loadCacheStatus = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const trpcClient = createTrpcClient();
            const status = await trpcClient.modelRegistry.getCacheStatus.query();

            setCacheStatus(status);
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            setCacheStatus(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const refresh = useCallback(() => {
        loadCacheStatus();
    }, [loadCacheStatus]);

    useEffect(() => {
        loadCacheStatus();
    }, [loadCacheStatus]);

    return {
        cacheStatus,
        isLoading,
        error,
        refresh,
    };
}

/**
 * useModelRegistryRefresh Hook
 * 
 * Provides a function to refresh ModelRegistry cache
 */
export function useModelRegistryRefresh() {
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);

    const refreshCache = useCallback(async () => {
        try {
            setIsRefreshing(true);
            setError(null);

            const trpcClient = createTrpcClient();
            await trpcClient.modelRegistry.refresh.mutate();
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            throw error;
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    return {
        refreshCache,
        isRefreshing,
        error,
    };
}
