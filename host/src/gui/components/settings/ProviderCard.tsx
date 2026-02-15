/**
 * ProviderCard Component (V2)
 * 
 * Displays a single provider with logo and custom name.
 * Shows active badge, selected state, and hover actions.
 */

import React, { useState } from 'react';
import { MagicCard } from '../ui/MagicCard.js';
import { ProviderLogo } from './ProviderLogo.js';
import type { ProviderCardProps } from './types.js';

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
 * ProviderCard Component
 * 
 * Displays a provider with logo, custom name, and optional active badge.
 * Shows edit/delete buttons on hover.
 */
export const ProviderCard: React.FC<ProviderCardProps> = ({
    provider,
    isSelected,
    isActive,
    onSelect,
    onEdit,
    onDelete,
}) => {
    const [isHovered, setIsHovered] = useState(false);

    const handleCardClick = () => {
        onSelect();
    };

    const handleEditClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onEdit();
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete();
    };

    return (
        <div
            className="flex flex-col items-center gap-3"
            role="listitem"
            aria-label={`${provider.customName} provider${isActive ? ' (active)' : ''}${isSelected ? ' (selected)' : ''}`}
        >
            <div
                className="relative"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <MagicCard
                    className={`cursor-pointer transition-all duration-300 ${
                        isSelected
                            ? 'border-2 border-[var(--color-primary)]'
                            : 'border border-[var(--color-border)]'
                    }`}
                    onClick={handleCardClick}
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleCardClick();
                        }
                    }}
                    style={{
                        width: '120px',
                        height: '108px',
                        minWidth: '120px',
                        minHeight: '108px',
                        maxWidth: '120px',
                        maxHeight: '108px',
                    }}
                >
                    <div className="relative flex h-full w-full items-center justify-center p-0 overflow-visible rounded-[var(--radius-md)]">
                        <ProviderLogo
                            providerId={provider.providerId}
                            providerName={provider.customName}
                            size="fill"
                            className="!w-full !h-full object-cover rounded-none border-0"
                        />

                        {isActive && (
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-medium uppercase tracking-wide z-20 shadow-sm pointer-events-none">
                                Active
                            </div>
                        )}
                    </div>
                </MagicCard>

                {isHovered && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 z-30">
                        <button
                            onClick={handleEditClick}
                            className="p-1 rounded-md bg-[var(--color-bg-surface)]/96 hover:bg-[var(--color-border)] text-[var(--color-text-primary)] transition-colors duration-200 shadow-sm"
                            aria-label={`Edit ${provider.customName} provider`}
                            title="Edit"
                        >
                            <IconEdit aria-hidden="true" className="w-3 h-3" />
                        </button>
                        <button
                            onClick={handleDeleteClick}
                            className="p-1 rounded-md bg-[var(--color-bg-surface)]/96 hover:bg-[var(--color-danger)] hover:text-white text-[var(--color-danger)] transition-colors duration-200 shadow-sm"
                            aria-label={`Delete ${provider.customName} provider`}
                            title="Delete"
                        >
                            <IconDelete aria-hidden="true" className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </div>

            <h3 className="text-xs font-medium text-[var(--color-text-primary)] text-center line-clamp-2 max-w-[120px]">
                {provider.customName}
            </h3>
        </div>
    );
};
