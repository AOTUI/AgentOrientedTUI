/**
 * ProviderSelector Component
 * 
 * Displays available providers from ModelRegistry with search and filtering
 * Shows provider metadata including model count
 */

import React, { useState, useMemo } from 'react';
import { useModelRegistryProviders } from '../../hooks/useModelRegistry.js';
import { LoadingState } from './LoadingState.js';
import { Spinner } from './Spinner.js';

export interface ProviderSelectorProps {
    /** Currently selected provider ID */
    selectedProviderId: string | null;
    /** Callback when provider is selected */
    onSelectProvider: (providerId: string) => void;
    /** Optional CSS class */
    className?: string;
}

/**
 * Icon component for search
 */
const IconSearch = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
        className={`w-4 h-4 ${props.className || ''}`}
    >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
    </svg>
);

/**
 * ProviderSelector Component
 * 
 * Displays provider list with search functionality
 */
export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
    selectedProviderId,
    onSelectProvider,
    className = '',
}) => {
    const { providers, isLoading, error } = useModelRegistryProviders();
    const [searchQuery, setSearchQuery] = useState('');

    // Filter providers based on search query
    const filteredProviders = useMemo(() => {
        // Ensure providers is an array
        if (!Array.isArray(providers)) {
            return [];
        }

        if (!searchQuery.trim()) {
            return providers;
        }

        const query = searchQuery.toLowerCase();
        return providers.filter(provider =>
            provider.name.toLowerCase().includes(query) ||
            provider.id.toLowerCase().includes(query)
        );
    }, [providers, searchQuery]);

    // Handle loading state
    if (isLoading) {
        return (
            <div className={className}>
                <LoadingState message="Loading providers..." size="sm" />
            </div>
        );
    }

    // Handle error state
    if (error) {
        return (
            <div className={`${className} p-4 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger)]/10`}>
                <p className="text-sm text-[var(--color-danger)]">
                    Failed to load providers: {error.message}
                </p>
            </div>
        );
    }

    // Handle empty state
    if (!Array.isArray(providers) || providers.length === 0) {
        return (
            <div className={`${className} p-4 rounded-lg mat-content`}>
                <p className="text-sm text-[var(--color-text-tertiary)]">
                    No providers available
                </p>
            </div>
        );
    }

    return (
        <div className={className}>
            {/* Search Bar */}
            <div className="mb-2">
                <div className="relative">
                    <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.currentTarget.value)}
                        placeholder="Search providers..."
                        className="
                            w-full pl-8 pr-3 py-1.5
                            mat-content
                            border border-[var(--color-border)]
                            rounded-md
                            text-sm text-[var(--color-text-primary)]
                            placeholder:text-[var(--color-text-tertiary)]
                            focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]
                            transition-all duration-200
                        "
                    />
                </div>
            </div>

            {/* Provider List */}
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {filteredProviders.length === 0 ? (
                    <div className="p-3 text-center text-sm text-[var(--color-text-tertiary)]">
                        No providers match your search
                    </div>
                ) : (
                    filteredProviders.map((provider) => (
                        <button
                            key={provider.id}
                            onClick={() => onSelectProvider(provider.id)}
                            className={`
                                w-full p-2.5 rounded-md
                                border transition-all duration-200
                                text-left h-[60px]
                                ${selectedProviderId === provider.id
                                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                                    : 'border-[var(--color-border)] mat-content hover:border-[var(--color-accent)]/50'
                                }
                            `}
                        >
                            <div className="flex items-center justify-between h-full">
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-sm text-[var(--color-text-primary)] truncate">
                                        {provider.name}
                                    </h4>
                                    <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5 truncate">
                                        {provider.id}
                                    </p>
                                </div>
                                <div className="ml-2 flex items-center gap-2 flex-shrink-0">
                                    <span className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-surface)] px-1.5 py-0.5 rounded">
                                        {provider.modelCount}
                                    </span>
                                    {selectedProviderId === provider.id && (
                                        <div className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                                    )}
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};
