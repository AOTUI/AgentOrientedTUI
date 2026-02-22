/**
 * ModelTabHeader Component (V2)
 * 
 * Header section for the Model Tab with search and add provider button.
 * Displays the "Model Configuration" title, provider search bar, and add button.
 */

import React from 'react';
import type { ModelTabHeaderProps } from './types.js';
import { ProviderSearchBar } from './ProviderSearchBar.js';

/**
 * Icon component for plus/add
 */
const IconPlus = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
        className={`w-5 h-5 ${props.className || ''}`}
    >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

/**
 * ModelTabHeader Component
 * 
 * Renders the header section of the Model Tab with:
 * - "Model Configuration" title
 * - Provider search bar on the left
 * - "+ Add Provider" button on the right
 * 
 * Requirements: 2.1, 2.2, 2.3
 */
export const ModelTabHeader: React.FC<ModelTabHeaderProps> = ({
    searchQuery,
    onSearchChange,
    onAddProvider,
}) => {
    return (
        <div className="space-y-3 sm:space-y-4">
            {/* Title */}
            <h2 className="text-lg sm:text-xl md:text-2xl font-medium tracking-tight text-[var(--color-text-primary)]">
                Model Configuration
            </h2>
            
            {/* Search bar and Add button row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                {/* Provider search bar on left */}
                <div className="flex-1 w-full max-w-md">
                    <ProviderSearchBar
                        searchQuery={searchQuery}
                        onSearchChange={onSearchChange}
                    />
                </div>
                
                {/* Add Provider button on right */}
                <button
                    onClick={onAddProvider}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity duration-200 whitespace-nowrap"
                    aria-label="Add new provider"
                >
                    <IconPlus aria-hidden="true" className="w-4 h-4" />
                    <span>Add Provider</span>
                </button>
            </div>
        </div>
    );
};
