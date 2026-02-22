/**
 * ConfigCard Component
 * 
 * Displays a single model configuration with actions.
 * Shows provider logo, configuration details, and hover actions.
 */

import React, { useState } from 'react';
import { ProviderLogo } from './ProviderLogo.js';
import type { ConfigCardProps } from './types.js';

/**
 * Icon component for checkmark
 */
const IconCheck = (props: React.SVGProps<SVGSVGElement>) => (
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
        <path d="M20 6L9 17l-5-5" />
    </svg>
);

/**
 * Icon component for edit
 */
const IconEdit = (props: React.SVGProps<SVGSVGElement>) => (
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
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

/**
 * Icon component for delete
 */
const IconDelete = (props: React.SVGProps<SVGSVGElement>) => (
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
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
);

/**
 * Mask API key to show only last 4 characters
 */
const maskApiKey = (apiKey: string | undefined): string => {
    if (!apiKey) return 'Not set';
    if (apiKey.length <= 4) return '••••';
    return '••••' + apiKey.slice(-4);
};

export const ConfigCard: React.FC<ConfigCardProps> = ({
    config,
    isActive,
    onSelect,
    onEdit,
    onDelete,
}) => {
    const [isHovered, setIsHovered] = useState(false);

    const handleCardClick = () => {
        onSelect(config.id);
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit(config.id);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(config.id);
    };

    return (
        <div
            className={`relative w-full rounded-xl px-6 py-5 cursor-pointer transition-all duration-300 ${
                isActive ? 'border-2 border-[var(--color-accent)] bg-[var(--mat-lg-clear-bg)]' : 'border border-[var(--mat-border)] bg-[var(--mat-content-card-bg)] hover:border-[var(--mat-border-highlight)]'
            }`}
            onClick={handleCardClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            role="listitem"
            aria-label={`${config.name} configuration${isActive ? ' (active)' : ''}`}
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick();
                }
            }}
        >
            <div className="flex flex-col h-full">
                {/* Header with provider logo and active indicator */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <ProviderLogo
                            providerId={config.providerId || 'unknown'}
                            providerName={config.providerId || 'Unknown'}
                            size="md"
                        />
                        <div className="flex flex-col">
                            <h3 className="text-[15px] font-medium text-[var(--color-text-primary)]">
                                {config.name}
                            </h3>
                            <p className="text-xs text-[var(--color-text-tertiary)] font-mono">
                                {config.model}
                            </p>
                        </div>
                    </div>
                    {isActive && (
                        <IconCheck className="text-[var(--color-accent)] flex-shrink-0" aria-label="Active configuration" />
                    )}
                </div>

                {/* Configuration details */}
                <div className="flex flex-col gap-2 text-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[var(--color-text-secondary)]">Provider:</span>
                        <span className="text-[var(--color-text-primary)] font-medium">
                            {config.providerId || 'Unknown'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[var(--color-text-secondary)]">API Key:</span>
                        <span className="text-[var(--color-text-tertiary)] font-mono text-xs">
                            {maskApiKey(config.apiKey)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-[var(--color-text-secondary)]">Temperature:</span>
                        <span className="text-[var(--color-text-primary)]">
                            {config.temperature}
                        </span>
                    </div>
                </div>

                {/* Hover actions */}
                {isHovered && (
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[var(--color-border)]">
                        <button
                            onClick={handleEditClick}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--color-bg-elevated)] hover:bg-[var(--color-border)] text-[var(--color-text-primary)] transition-colors duration-200"
                            aria-label={`Edit ${config.name} configuration`}
                        >
                            <IconEdit aria-hidden="true" />
                            <span className="text-sm">Edit</span>
                        </button>
                        <button
                            onClick={handleDeleteClick}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--color-bg-elevated)] hover:bg-[var(--color-danger)] hover:text-white text-[var(--color-danger)] transition-colors duration-200"
                            aria-label={`Delete ${config.name} configuration`}
                        >
                            <IconDelete aria-hidden="true" />
                            <span className="text-sm">Delete</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
