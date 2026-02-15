/**
 * useModelConfigs Hook
 * 
 * Custom hook for managing LLM model configurations
 * Uses tRPC to communicate with the main process
 */

import { useState, useEffect, useCallback } from 'react';
import type { LLMConfigRecord } from '../../../../types/llm-config.js';
import type { ConfigFormData } from '../types.js';
import { useChatBridge } from '../../../ChatBridge.js';

/**
 * Hook return type
 */
export interface UseModelConfigsReturn {
    /** All saved configurations */
    configs: LLMConfigRecord[];
    /** ID of the active configuration */
    activeConfigId: number | null;
    /** Loading state */
    loading: boolean;
    /** Error state */
    error: string | null;
    /** Refresh configurations from service */
    refresh: () => void;
    /** Create a new configuration */
    createConfig: (data: ConfigFormData) => Promise<void>;
    /** Update an existing configuration */
    updateConfig: (id: number, data: Partial<ConfigFormData>) => Promise<void>;
    /** Delete a configuration */
    deleteConfig: (id: number) => Promise<void>;
    /** Set a configuration as active */
    setActiveConfig: (id: number) => Promise<void>;
}

/**
 * useModelConfigs Hook
 * 
 * Provides CRUD operations for LLM model configurations
 * Handles loading and error states
 */
export function useModelConfigs(): UseModelConfigsReturn {
    const bridge = useChatBridge();
    const [configs, setConfigs] = useState<LLMConfigRecord[]>([]);
    const [activeConfigId, setActiveConfigId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    /**
     * Load configurations from service via tRPC
     */
    const loadConfigs = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const [allConfigs, activeConfig] = await Promise.all([
                bridge.getAllLLMConfigs(),
                bridge.getActiveLLMConfig()
            ]);

            setConfigs(allConfigs);
            setActiveConfigId(activeConfig?.id || null);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to load configurations';
            setError(errorMessage);
            console.error('Error loading configurations:', err);
        } finally {
            setLoading(false);
        }
    }, [bridge]);

    /**
     * Load configurations on mount
     */
    useEffect(() => {
        void loadConfigs();
    }, [loadConfigs]);

    /**
     * Create a new configuration
     */
    const createConfig = useCallback(async (data: ConfigFormData): Promise<void> => {
        try {
            setError(null);

            await bridge.createLLMConfig({
                name: data.name,
                model: data.model,
                providerId: data.providerId,
                baseUrl: data.baseUrl || undefined,
                apiKey: data.apiKey || undefined,
                temperature: data.temperature,
                maxSteps: data.maxSteps,
            });

            await loadConfigs();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to create configuration';
            setError(errorMessage);
            throw err;
        }
    }, [bridge, loadConfigs]);

    /**
     * Update an existing configuration
     */
    const updateConfig = useCallback(async (id: number, data: Partial<ConfigFormData>): Promise<void> => {
        try {
            setError(null);

            const updates: Partial<ConfigFormData> = {};
            
            if (data.name !== undefined) updates.name = data.name;
            if (data.model !== undefined) updates.model = data.model;
            if (data.providerId !== undefined) updates.providerId = data.providerId;
            if (data.baseUrl !== undefined) updates.baseUrl = data.baseUrl;
            if (data.apiKey !== undefined) updates.apiKey = data.apiKey;
            if (data.temperature !== undefined) updates.temperature = data.temperature;
            if (data.maxSteps !== undefined) updates.maxSteps = data.maxSteps;

            await bridge.updateLLMConfig(id, updates);

            await loadConfigs();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to update configuration';
            setError(errorMessage);
            throw err;
        }
    }, [bridge, loadConfigs]);

    /**
     * Delete a configuration
     */
    const deleteConfig = useCallback(async (id: number): Promise<void> => {
        try {
            setError(null);

            await bridge.deleteLLMConfig(id);

            await loadConfigs();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete configuration';
            setError(errorMessage);
            throw err;
        }
    }, [bridge, loadConfigs]);

    /**
     * Set a configuration as active
     */
    const setActive = useCallback(async (id: number): Promise<void> => {
        try {
            setError(null);

            await bridge.setActiveLLMConfig(id);

            await loadConfigs();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to set active configuration';
            setError(errorMessage);
            throw err;
        }
    }, [bridge, loadConfigs]);

    return {
        configs,
        activeConfigId,
        loading,
        error,
        refresh: loadConfigs,
        createConfig,
        updateConfig,
        deleteConfig,
        setActiveConfig: setActive,
    };
}
