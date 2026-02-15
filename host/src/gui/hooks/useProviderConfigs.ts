/**
 * useProviderConfigs Hook
 * 
 * Custom hook for managing provider configurations
 * Uses tRPC to communicate with LLMConfigService
 */

import { useState, useEffect, useCallback } from 'react';
import { useChatBridge } from '../ChatBridge.js';
import type { LLMConfigRecord, LLMConfigInput } from '../../types/llm-config.js';

export interface ProviderConfig {
    id: number;
    providerId: string;
    customName: string;
    apiKey: string;
    isActive: boolean;
    model: string;
    temperature: number;
    maxSteps: number;
    createdAt: number;
    updatedAt: number;
}

export interface NewProviderConfig {
    providerId: string;
    customName: string;
    apiKey: string;
    model?: string;
    temperature?: number;
    maxSteps?: number;
}

export interface ProviderUpdates {
    customName?: string;
    apiKey?: string;
    model?: string;
    temperature?: number;
    maxSteps?: number;
}

export interface UseProviderConfigsResult {
    providers: ProviderConfig[];
    activeProviderId: string | null;
    isLoading: boolean;
    error: Error | null;
    addProvider: (config: NewProviderConfig) => Promise<void>;
    updateProvider: (id: number, updates: ProviderUpdates) => Promise<void>;
    deleteProvider: (id: number) => Promise<void>;
    setActiveProvider: (id: number) => Promise<void>;
    refresh: () => void;
}

/**
 * Convert LLMConfigRecord to ProviderConfig
 */
function toProviderConfig(record: LLMConfigRecord): ProviderConfig {
    return {
        id: record.id,
        providerId: record.providerId || 'unknown',
        customName: record.name,
        apiKey: record.apiKey || '',
        isActive: record.isActive,
        model: record.model,
        temperature: record.temperature,
        maxSteps: record.maxSteps,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
    };
}

/**
 * Sort providers with active provider first
 */
export function sortProviders(providers: ProviderConfig[]): ProviderConfig[] {
    return [...providers].sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return 0;
    });
}

/**
 * useProviderConfigs Hook
 * 
 * Manages provider configurations with CRUD operations via tRPC
 * Tracks active provider and handles loading/error states
 */
export function useProviderConfigs(): UseProviderConfigsResult {
    const [providers, setProviders] = useState<ProviderConfig[]>([]);
    const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const bridge = useChatBridge();

    /**
     * Load providers from service via tRPC
     */
    const loadProviders = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const allConfigs = await bridge.getAllLLMConfigs();
            const activeConfig = await bridge.getActiveLLMConfig();

            const providerConfigs = allConfigs.map(toProviderConfig);
            const sortedProviders = sortProviders(providerConfigs);

            setProviders(sortedProviders);
            setActiveProviderId(activeConfig?.providerId || null);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsLoading(false);
        }
    }, [bridge]);

    /**
     * Add new provider via tRPC
     */
    const addProvider = useCallback(async (config: NewProviderConfig): Promise<void> => {
        try {
            setError(null);

            const input: LLMConfigInput = {
                name: config.customName,
                model: config.model || 'gpt-4o', // 使用更合理的默认模型
                providerId: config.providerId,
                apiKey: config.apiKey,
                temperature: config.temperature ?? 0.7,
                maxSteps: config.maxSteps ?? 10,
                skipValidation: !config.model, // 如果没有指定模型，跳过验证
            };

            await bridge.createLLMConfig(input);
            await loadProviders();
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            throw error;
        }
    }, [bridge, loadProviders]);

    /**
     * Update existing provider via tRPC
     */
    const updateProvider = useCallback(async (id: number, updates: ProviderUpdates): Promise<void> => {
        try {
            setError(null);

            const input: Partial<LLMConfigInput> = {};

            if (updates.customName !== undefined) {
                input.name = updates.customName;
            }
            if (updates.apiKey !== undefined) {
                input.apiKey = updates.apiKey;
            }
            if (updates.model !== undefined) {
                input.model = updates.model;
            }
            if (updates.temperature !== undefined) {
                input.temperature = updates.temperature;
            }
            if (updates.maxSteps !== undefined) {
                input.maxSteps = updates.maxSteps;
            }

            await bridge.updateLLMConfig(id, input);
            await loadProviders();
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            throw error;
        }
    }, [bridge, loadProviders]);

    /**
     * Delete provider via tRPC
     */
    const deleteProvider = useCallback(async (id: number): Promise<void> => {
        try {
            setError(null);

            await bridge.deleteLLMConfig(id);
            await loadProviders();
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            throw error;
        }
    }, [bridge, loadProviders]);

    /**
     * Set active provider via tRPC
     */
    const setActiveProvider = useCallback(async (id: number): Promise<void> => {
        try {
            setError(null);

            await bridge.setActiveLLMConfig(id);
            await loadProviders();
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            throw error;
        }
    }, [bridge, loadProviders]);

    /**
     * Refresh providers
     */
    const refresh = useCallback(() => {
        loadProviders();
    }, [loadProviders]);

    // Load providers on mount
    useEffect(() => {
        loadProviders();
    }, [loadProviders]);

    return {
        providers,
        activeProviderId,
        isLoading,
        error,
        addProvider,
        updateProvider,
        deleteProvider,
        setActiveProvider,
        refresh,
    };
}
