/**
 * useCustomProviders Hook
 *
 * Manages CRUD operations for user-defined custom LLM providers.
 * Custom providers are stored in ~/.aotui/config/custom-providers.json
 * via the CustomProviderStore backend service.
 */

import { useState, useEffect, useCallback } from 'react';
import { useChatBridge } from '../ChatBridge.js';

export type CustomProviderProtocol = 'openai' | 'anthropic';

export interface CustomProviderRecord {
    id: string;
    name: string;
    baseUrl: string;
    protocol: CustomProviderProtocol;
    apiKey?: string;
    createdAt: number;
    updatedAt: number;
}

export interface NewCustomProviderInput {
    name: string;
    baseUrl: string;
    protocol: CustomProviderProtocol;
    apiKey?: string;
}

export interface CustomProviderUpdates {
    name?: string;
    baseUrl?: string;
    protocol?: CustomProviderProtocol;
    apiKey?: string;
}

export interface UseCustomProvidersResult {
    customProviders: CustomProviderRecord[];
    isLoading: boolean;
    error: Error | null;
    createCustomProvider: (input: NewCustomProviderInput) => Promise<CustomProviderRecord>;
    updateCustomProvider: (id: string, updates: CustomProviderUpdates) => Promise<CustomProviderRecord>;
    deleteCustomProvider: (id: string) => Promise<void>;
    refresh: () => void;
}

export function useCustomProviders(): UseCustomProvidersResult {
    const bridge = useChatBridge();
    const [customProviders, setCustomProviders] = useState<CustomProviderRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const load = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const list = await bridge.listCustomProviders();
            setCustomProviders((list as CustomProviderRecord[]) || []);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setIsLoading(false);
        }
    }, [bridge]);

    useEffect(() => {
        load();
    }, [load]);

    const createCustomProvider = useCallback(async (input: NewCustomProviderInput): Promise<CustomProviderRecord> => {
        const record = await bridge.createCustomProvider(input) as CustomProviderRecord;
        setCustomProviders(prev => [record, ...prev]);
        return record;
    }, [bridge]);

    const updateCustomProvider = useCallback(async (id: string, updates: CustomProviderUpdates): Promise<CustomProviderRecord> => {
        const updated = await bridge.updateCustomProvider(id, updates) as CustomProviderRecord;
        setCustomProviders(prev => prev.map(p => p.id === id ? updated : p));
        return updated;
    }, [bridge]);

    const deleteCustomProvider = useCallback(async (id: string): Promise<void> => {
        await bridge.deleteCustomProvider(id);
        setCustomProviders(prev => prev.filter(p => p.id !== id));
    }, [bridge]);

    return {
        customProviders,
        isLoading,
        error,
        createCustomProvider,
        updateCustomProvider,
        deleteCustomProvider,
        refresh: load,
    };
}
