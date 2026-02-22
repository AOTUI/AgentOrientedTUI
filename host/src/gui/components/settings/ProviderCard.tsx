/**
 * ProviderCard Component (V2)
 * 
 * Displays a single provider with logo and custom name.
 * Shows active badge, selected state, and hover actions.
 */

import React from 'react';
import { ProviderLogo } from './ProviderLogo.js';
import type { ProviderCardProps } from './types.js';

const ActionButton: React.FC<{ 
    icon: React.ReactNode, 
    onClick: (e: React.MouseEvent) => void,
    label: string,
    ariaLabel?: string,
    variant?: 'default' | 'danger'
}> = ({ icon, onClick, label, ariaLabel, variant = 'default' }) => (
    <button
        onClick={onClick}
        className={`
            p-1.5 rounded-[6px] transition-all duration-200
            mat-lg-clear
            ${variant === 'danger' 
                ? 'hover:bg-[var(--color-danger)/15] hover:text-[var(--color-danger)]' 
                : 'hover:bg-[var(--mat-content-card-hover-bg)] hover:text-[var(--color-text-primary)]'
            }
            text-[var(--color-text-secondary)]
        `}
        aria-label={ariaLabel ?? label}
        title={label}
    >
        {icon}
    </button>
);

export const ProviderCard: React.FC<ProviderCardProps> = ({
    provider,
    isSelected,
    isActive,
    onSelect,
    onEdit,
    onDelete,
}) => {
    const ariaLabel = `${provider.customName} provider${isActive ? ' (active)' : ''}${isSelected ? ' (selected)' : ''}`;
    return (
        /* Outer wrapper: card box + name label below */
        <div className="flex flex-col items-center gap-1.5 select-none" role="listitem">
            {/* Card Box — logo fills the interior */}
            <div
                className={`
                    group relative flex items-center justify-center
                    w-[120px] h-[120px]
                    rounded-[16px] border transition-all duration-200 ease-[var(--ease-spring)]
                    cursor-pointer overflow-hidden
                    mat-content hover:bg-[var(--mat-content-card-hover-bg)]
                    border-[var(--mat-border)]
                `}
                onClick={onSelect}
                role="radio"
                aria-checked={isSelected}
                aria-label={ariaLabel}
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect();
                    }
                }}
            >
                {/* Active indicator — label top-right */}
                {isActive && (
                    <div className="absolute top-1 right-1.5 z-20">
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.05em] bg-[var(--color-success)/15] text-[var(--color-success)] border border-[var(--color-success)/15] shadow-sm">
                            Active
                        </span>
                    </div>
                )}

                {/* Provider Logo — fills card */}
                <ProviderLogo
                    providerId={provider.providerId}
                    providerName={provider.customName}
                    size="lg"
                    className="!w-16 !h-16 object-contain rounded-none border-0 transition-transform duration-200 group-hover:scale-110"
                />

                {/* Hover overlay with action buttons */}
                <div
                    className="absolute inset-0 flex items-end justify-end p-1.5 gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 pointer-events-none group-hover:pointer-events-auto rounded-[calc(16px-1px)]"
                >
                    <ActionButton
                        icon={
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                        }
                        onClick={(e) => { e.stopPropagation(); onEdit(); }}
                        label="Edit"
                        ariaLabel={`Edit ${provider.customName} provider`}
                    />
                    <ActionButton
                        icon={
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
                                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                        }
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        label="Delete"
                        ariaLabel={`Delete ${provider.customName} provider`}
                        variant="danger"
                    />
                </div>
            </div>

            {/* Provider Name — below the card */}
            <span className={`
                text-[11px] font-medium text-center leading-tight
                max-w-[96px] truncate
                ${isSelected ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}
            `}>
                {provider.customName}
            </span>
        </div>
    );
};
