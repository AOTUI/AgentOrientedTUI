/**
 * ModelSearchBar Component (V2)
 * 
 * Search bar for filtering models by name and ID.
 * Debounces input changes to avoid excessive filtering.
 * Can be disabled when no provider is selected.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ModelSearchBarProps } from './types.js';

/**
 * Debounce utility function
 * Creates a debounced version of a function that delays execution
 */
function debounce<T extends (...args: any[]) => void>(
    fn: T,
    delayMs: number
): T {
    let timeoutId: NodeJS.Timeout | null = null;

    return ((...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            fn(...args);
            timeoutId = null;
        }, delayMs);
    }) as T;
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
 * ModelSearchBar Component
 * 
 * Renders a search input with icon that filters models by name and ID.
 * Input changes are debounced by 300ms to improve performance.
 * Disabled when no provider is selected.
 * 
 * Requirements: 2.5, 8.1-8.5
 */
export const ModelSearchBar: React.FC<ModelSearchBarProps> = ({
    searchQuery,
    onSearchChange,
    disabled,
}) => {
    // Local state for immediate UI updates
    const [localValue, setLocalValue] = useState(searchQuery);
    
    // Create debounced callback only once
    const debouncedOnChange = useRef<((value: string) => void) | null>(null);
    
    if (!debouncedOnChange.current) {
        debouncedOnChange.current = debounce((value: string) => {
            onSearchChange(value);
        }, 300);
    }

    // Update local value when prop changes (e.g., cleared externally)
    useEffect(() => {
        setLocalValue(searchQuery);
    }, [searchQuery]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return; // Don't process changes when disabled
        
        const value = e.target.value;
        setLocalValue(value);
        debouncedOnChange.current?.(value);
    }, [disabled]);

    return (
        <div className="relative">
            <div className={`absolute left-3 top-1/2 -translate-y-1/2 ${
                disabled ? 'text-[var(--color-text-muted)] opacity-50' : 'text-[var(--color-text-muted)]'
            }`}>
                <IconSearch aria-hidden="true" />
            </div>
            <input
                type="text"
                value={localValue}
                onChange={handleInputChange}
                disabled={disabled}
                placeholder={disabled ? "Select a provider to search models..." : "Search models..."}
                className={`w-full h-9 pl-9 pr-3 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] transition-colors duration-200 ${
                    disabled 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'focus:outline-none focus:border-[var(--color-primary)]'
                }`}
                aria-label="Search models"
                aria-disabled={disabled}
            />
        </div>
    );
};
