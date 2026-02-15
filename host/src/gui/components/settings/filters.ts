/**
 * Settings Panel - Filter Utilities
 * 
 * Utility functions for filtering providers and models
 */

import type { ProviderConfig } from './types.js';
import type { ModelsDevModel } from '../../../services/index.js';

/**
 * Filter providers by custom name (case-insensitive)
 * 
 * @param providers - Array of provider configurations
 * @param query - Search query string
 * @returns Filtered array of providers matching the query
 * 
 * Requirements: 4.1, 4.2
 */
export function filterProviders(
    providers: ProviderConfig[],
    query: string
): ProviderConfig[] {
    // If query is empty, return all providers
    if (!query || query.trim() === '') {
        return providers;
    }

    const normalizedQuery = query.toLowerCase().trim();

    return providers.filter(provider =>
        provider.customName.toLowerCase().includes(normalizedQuery)
    );
}

/**
 * Filter models by name and ID (case-insensitive)
 * 
 * @param models - Array of models
 * @param query - Search query string
 * @returns Filtered array of models matching the query
 * 
 * Requirements: 8.1, 8.2
 */
export function filterModels(
    models: ModelsDevModel[],
    query: string
): ModelsDevModel[] {
    // If query is empty, return all models
    if (!query || query.trim() === '') {
        return models;
    }

    const normalizedQuery = query.toLowerCase().trim();

    return models.filter(model =>
        model.name.toLowerCase().includes(normalizedQuery) ||
        model.id.toLowerCase().includes(normalizedQuery)
    );
}
