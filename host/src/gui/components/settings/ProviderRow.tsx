/**
 * ProviderRow Component (V2)
 * 
 * Horizontal scrollable row of provider cards.
 * Displays providers with active provider first.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ProviderCard } from './ProviderCard.js';
import { sortProviders } from '../../hooks/useProviderConfigs.js';
import type { ProviderRowProps } from './types.js';

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
            className="shrink-0 w-[120px] h-[120px] border border-dashed border-[var(--lg-border)] rounded-[var(--r-panel)] bg-[var(--lg-bg-strong)] hover:bg-[var(--lg-bg-active)] transition-all duration-200 flex items-center justify-center text-[var(--tx-secondary)] hover:text-[var(--ac-blue)] hover:border-[var(--ac-blue-subtle)] active:scale-[0.98] backdrop-blur-[var(--lg-blur)] shadow-[var(--lg-inner-shadow)]"
            aria-label="Add new provider"
        >
            <div className="p-3 rounded-full bg-[var(--lg-clear-bg)] border border-[var(--lg-clear-border)] shadow-[var(--lg-inner-shadow)]">
                <IconPlus aria-hidden="true" className="w-5 h-5" />
            </div>
        </button>
        <span className="text-[11px] font-medium text-[var(--tx-secondary)] text-center">Add Provider</span>
    </div>
);


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
}) => {
    // Sort providers with active first
    const sortedProviders = sortProviders(providers);

    const scrollRef = useRef<HTMLDivElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);

    const measureOverflow = useCallback(() => {
        const element = scrollRef.current;
        if (!element) return;
        setIsOverflowing(element.scrollWidth > element.clientWidth + 4);
    }, []);

    useEffect(() => {
        measureOverflow();
    }, [measureOverflow, sortedProviders.length]);

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
    if (sortedProviders.length === 0) {
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
                <div className="mt-2 text-[var(--color-text-muted)] text-left">
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
                    WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
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

                {onAddProvider && !isOverflowing && (
                    <div className="shrink-0" role="listitem" aria-label="Add provider">
                        <AddProviderButton onClick={onAddProvider} />
                    </div>
                )}
            </div>

            {onAddProvider && isOverflowing && (
                <div className="absolute right-0 top-0 bottom-0 pointer-events-none flex items-start">
                    <div className="pointer-events-auto" role="listitem" aria-label="Add provider">
                        <AddProviderButton onClick={onAddProvider} />
                    </div>
                </div>
            )}
        </div>
    );
};
