/**
 * ProviderRow Component (V2)
 * 
 * Horizontal scrollable row of provider cards.
 * Displays providers with active provider first.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ProviderCard } from './ProviderCard.js';
import { sortProviders } from '../../hooks/useProviderConfigs.js';
import type { ProviderRowProps, CustomProviderRecord, ProviderConfig } from './types.js';

/**
 * Adapt a CustomProviderRecord to the ProviderConfig shape that ProviderCard accepts.
 * The resulting object is only used for display — numeric `id` is never used as a DB key.
 */
const customToConfig = (cp: CustomProviderRecord): ProviderConfig => ({
    id: 0,
    providerId: `custom:${cp.id}`,
    customName: cp.name,
    apiKey: '',
    isActive: false,
    model: '',
    temperature: 0,
    maxSteps: 0,
    createdAt: 0,
    updatedAt: 0,
});

const IconPlus = (props: React.SVGProps<SVGSVGElement>) => (
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
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const AddProviderButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <div className="flex flex-col items-center gap-1.5 select-none">
        <button
            onClick={onClick}
            className="shrink-0 w-[120px] h-[120px] mat-lg-regular rounded-[16px] hover:bg-[var(--mat-lg-clear-bg)] transition-all duration-200 ease-[var(--ease-spring)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] active:scale-[0.94]"
            aria-label="Add new provider"
        >
            <div className="p-3 rounded-full mat-lg-clear">
                <IconPlus aria-hidden="true" className="w-5 h-5" />
            </div>
        </button>
        <span className="text-[11px] font-medium text-[var(--color-text-secondary)] text-center">Add Provider</span>
    </div>
);

// ── Inline card for Custom Providers ──────────────────────────────────────────



/**
 * ProviderRow Component
 * 
 * Renders a horizontal scrollable row of ProviderCard components.
 * Automatically sorts providers with active provider first.
 * Handles provider selection, edit, and delete actions.
 */
export const ProviderRow: React.FC<ProviderRowProps> = ({
    providers,
    selectedProviderId,
    activeProviderId,
    onSelectProvider,
    onEditProvider,
    onDeleteProvider,
    onAddProvider,
    customProviders = [],
    selectedCustomProviderId = null,
    onSelectCustomProvider,
    onDeleteCustomProvider,
    onEditCustomProvider,
    activeCustomProviderIds,
}) => {
    // Sort providers with active first
    const sortedProviders = sortProviders(providers);

    const totalCount = sortedProviders.length + customProviders.length;

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);

    const measureOverflow = useCallback(() => {
        const element = scrollRef.current;
        if (!element) return;
        setIsOverflowing(element.scrollWidth > element.clientWidth + 4);
    }, []);

    useEffect(() => {
        measureOverflow();
    }, [measureOverflow, totalCount]);

    useEffect(() => {
        const element = scrollRef.current;
        if (!element) return;

        if (typeof ResizeObserver !== 'undefined') {
            const observer = new ResizeObserver(() => {
                measureOverflow();
            });
            observer.observe(element);
            if (element.parentElement) {
                observer.observe(element.parentElement);
            }
            return () => observer.disconnect();
        }

        window.addEventListener('resize', measureOverflow);
        return () => window.removeEventListener('resize', measureOverflow);
    }, [measureOverflow]);

    // Handle empty state
    if (totalCount === 0) {
        return (
            <div className="provider-row-container" role="status" aria-live="polite">
                <div
                    className="provider-row-scroll"
                    style={{
                        display: 'flex',
                        gap: 'clamp(12px, 2vw, 16px)',
                        overflowX: 'auto',
                        overflowY: 'hidden',
                        paddingBottom: '8px',
                        scrollBehavior: 'smooth',
                        WebkitOverflowScrolling: 'touch',
                    }}
                >
                    {onAddProvider && (
                        <div className="shrink-0" role="listitem" aria-label="Add provider">
                            <AddProviderButton onClick={onAddProvider} />
                        </div>
                    )}
                </div>
                <div className="mt-2 text-[var(--color-text-tertiary)] text-left">
                    No providers configured. Click "Add Provider" to get started.
                </div>
            </div>
        );
    }

    return (
        <div
            className="provider-row-container relative"
            role="list"
            aria-label="Provider list"
        >
            <div
                ref={scrollRef}
                className="provider-row-scroll"
                style={{
                    display: 'flex',
                    gap: 'clamp(12px, 2vw, 16px)',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    paddingBottom: '8px',
                    paddingRight: isOverflowing && onAddProvider ? '108px' : '0px',
                    scrollBehavior: 'smooth',
                    WebkitOverflowScrolling: 'touch',
                }}
            >
                {sortedProviders.map((provider) => (
                    <ProviderCard
                        key={provider.id}
                        provider={provider}
                        isSelected={provider.id === selectedProviderId}
                        isActive={provider.isActive}
                        onSelect={() => onSelectProvider(provider.id)}
                        onEdit={() => onEditProvider(provider)}
                        onDelete={() => onDeleteProvider(provider)}
                    />
                ))}

                {customProviders.map((cp) => (
                    <ProviderCard
                        key={cp.id}
                        provider={customToConfig(cp)}
                        isSelected={cp.id === selectedCustomProviderId}
                        isActive={activeCustomProviderIds?.has(cp.id) ?? false}
                        isCustom={true}
                        onSelect={() => onSelectCustomProvider?.(cp.id)}
                        onEdit={() => onEditCustomProvider?.(cp)}
                        onDelete={() => onDeleteCustomProvider?.(cp)}
                    />
                ))}

                {onAddProvider && !isOverflowing && (
                    <div className="shrink-0" role="listitem" aria-label="Add provider">
                        <AddProviderButton onClick={onAddProvider} />
                    </div>
                )}
            </div>

            {onAddProvider && isOverflowing && (
                <div className="absolute right-0 top-0 bottom-0 pointer-events-none flex items-start justify-end"
                    style={{ width: '156px' }}
                >
                    {/* Frosted-glass fade — blocks the cards scrolling beneath the button */}
                    <div className="absolute inset-0 rounded-r-[inherit]"
                        style={{
                            backdropFilter: 'blur(8px)',
                            WebkitBackdropFilter: 'blur(8px)',
                            maskImage: 'linear-gradient(to right, transparent 0%, black 40%)',
                            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 40%)',
                        }}
                    />
                    <div className="pointer-events-auto relative z-10" role="listitem" aria-label="Add provider">
                        <AddProviderButton onClick={onAddProvider} />
                    </div>
                </div>
            )}
        </div>
    );
};
