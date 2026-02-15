/**
 * ProviderLogo Component
 * 
 * Displays provider logo with fallback handling.
 * Loads logo from models.dev and shows provider initial on error.
 */

import React, { useState } from 'react';
import type { ProviderLogoProps } from './types.js';

const MONOCHROME_LOGO_PROVIDER_IDS = new Set([
    'openrouter',
    'deepseek',
    'deepseek-chat',
]);

/**
 * Size mappings for logo variants
 */
const SIZE_MAP = {
    sm: 24,
    md: 32,
    lg: 48,
} as const;

/**
 * Generate a consistent color for a provider based on its name
 */
const getProviderColor = (providerName: string): string => {
    const colors = [
        '#3B82F6', // blue
        '#8B5CF6', // purple
        '#EC4899', // pink
        '#F59E0B', // amber
        '#10B981', // green
        '#06B6D4', // cyan
        '#EF4444', // red
        '#6366F1', // indigo
    ];
    
    // Simple hash function to get consistent color
    let hash = 0;
    for (let i = 0; i < providerName.length; i++) {
        hash = providerName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
};

/**
 * Get the first letter of the provider name for fallback
 */
const getProviderInitial = (providerName: string): string => {
    return providerName.charAt(0).toUpperCase();
};

export const ProviderLogo: React.FC<ProviderLogoProps> = ({
    providerId,
    providerName,
    size = 'md',
    className = '',
}) => {
    const [hasError, setHasError] = useState(false);
    const logoUrl = `https://models.dev/logos/${providerId}.svg`;
    const sizeInPx = size === 'fill' ? undefined : SIZE_MAP[size];
    const providerColor = getProviderColor(providerName);
    const providerInitial = getProviderInitial(providerName);
    const isDarkTheme = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
    const shouldLightenLogo = isDarkTheme && MONOCHROME_LOGO_PROVIDER_IDS.has(providerId.toLowerCase());

    const handleError = () => {
        setHasError(true);
    };

    if (hasError) {
        // Fallback: Show provider initial in colored circle
        return (
            <div
                className={`flex items-center justify-center rounded-md border border-[var(--color-border)] font-medium text-white ${className}`}
                style={{
                    width: sizeInPx ? `${sizeInPx}px` : '100%',
                    height: sizeInPx ? `${sizeInPx}px` : '100%',
                    backgroundColor: providerColor,
                    fontSize: sizeInPx ? `${sizeInPx * 0.5}px` : '28px',
                }}
                title={providerName}
            >
                {providerInitial}
            </div>
        );
    }

    // Show logo image
    return (
        <img
            src={logoUrl}
            alt={`${providerName} logo`}
            className={`rounded-md border border-[var(--color-border)] object-contain ${className}`}
            style={{
                width: sizeInPx ? `${sizeInPx}px` : '100%',
                height: sizeInPx ? `${sizeInPx}px` : '100%',
                filter: shouldLightenLogo ? 'brightness(0) invert(1)' : undefined,
            }}
            onError={handleError}
            title={providerName}
        />
    );
};
