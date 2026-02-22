/**
 * ModelRegistryRefresh Component
 * 
 * Displays cache status and provides refresh functionality
 * Shows last fetch time, staleness, and model/provider counts
 */

import React, { useEffect } from 'react';
import { useModelRegistryCacheStatus, useModelRegistryRefresh } from '../../hooks/useModelRegistry.js';
import { Spinner } from './Spinner.js';

export interface ModelRegistryRefreshProps {
    /** Callback when refresh completes successfully */
    onRefreshComplete?: () => void;
    /** Optional CSS class */
    className?: string;
}

/**
 * Icon component for refresh
 */
const IconRefresh = (props: React.SVGProps<SVGSVGElement>) => (
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
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
);

/**
 * Icon component for clock
 */
const IconClock = (props: React.SVGProps<SVGSVGElement>) => (
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
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);

/**
 * Icon component for database
 */
const IconDatabase = (props: React.SVGProps<SVGSVGElement>) => (
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
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
    </svg>
);

/**
 * Icon component for alert
 */
const IconAlert = (props: React.SVGProps<SVGSVGElement>) => (
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
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
}

/**
 * ModelRegistryRefresh Component
 * 
 * Displays cache status and refresh button
 */
export const ModelRegistryRefresh: React.FC<ModelRegistryRefreshProps> = ({
    onRefreshComplete,
    className = '',
}) => {
    const { cacheStatus, isLoading: isLoadingStatus, error: statusError, refresh: refreshStatus } = useModelRegistryCacheStatus();
    const { refreshCache, isRefreshing, error: refreshError } = useModelRegistryRefresh();

    // Refresh status after cache refresh completes
    useEffect(() => {
        if (!isRefreshing && !refreshError) {
            refreshStatus();
        }
    }, [isRefreshing, refreshError, refreshStatus]);

    /**
     * Handle refresh button click
     */
    const handleRefresh = async () => {
        try {
            await refreshCache();
            refreshStatus();
            onRefreshComplete?.();
        } catch (error) {
            console.error('Failed to refresh cache:', error);
        }
    };

    // Handle loading state
    if (isLoadingStatus) {
        return (
            <div className={`${className} p-4 rounded-lg mat-content`}>
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-tertiary)]">
                    <Spinner size="sm" />
                    <span>Loading cache status...</span>
                </div>
            </div>
        );
    }

    // Handle error state
    if (statusError) {
        return (
            <div className={`${className} p-4 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger)]/10`}>
                <div className="flex items-center gap-2 text-sm text-[var(--color-danger)]">
                    <IconAlert />
                    <span>Failed to load cache status</span>
                </div>
            </div>
        );
    }

    // Handle no cache status
    if (!cacheStatus) {
        return null;
    }

    return (
        <div className={`${className} space-y-3`}>
            {/* Cache Status Card */}
            <div className={`
                p-4 rounded-lg border
                ${cacheStatus.isStale 
                    ? 'border-yellow-500/30 bg-yellow-500/5' 
                    : 'border-[var(--color-border)] mat-content'
                }
            `}>
                <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                        <IconDatabase className="text-[var(--color-text-secondary)]" />
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">
                            Model Registry Cache
                        </h4>
                    </div>
                    {cacheStatus.isStale && (
                        <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                            <IconAlert className="w-3 h-3" />
                            Stale
                        </span>
                    )}
                </div>

                {/* Cache Stats */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="text-center p-2 rounded bg-[var(--color-bg-surface)]">
                        <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {cacheStatus.providerCount}
                        </div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">
                            Providers
                        </div>
                    </div>
                    <div className="text-center p-2 rounded bg-[var(--color-bg-surface)]">
                        <div className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {cacheStatus.modelCount}
                        </div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">
                            Models
                        </div>
                    </div>
                    <div className="text-center p-2 rounded bg-[var(--color-bg-surface)]">
                        <div className="text-xs font-medium text-[var(--color-text-primary)] flex items-center justify-center gap-1">
                            <IconClock className="w-3 h-3" />
                            {formatTimestamp(cacheStatus.lastFetch)}
                        </div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">
                            Last Updated
                        </div>
                    </div>
                </div>

                {/* Stale Warning */}
                {cacheStatus.isStale && (
                    <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">
                            Cache is older than 24 hours. Consider refreshing to get the latest model data.
                        </p>
                    </div>
                )}
            </div>

            {/* Refresh Button */}
            <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`
                    w-full px-4 py-2.5 rounded-lg
                    font-medium text-sm
                    transition-all duration-200
                    flex items-center justify-center gap-2
                    ${isRefreshing
                        ? 'mat-content text-[var(--color-text-tertiary)] cursor-not-allowed'
                        : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90 active:scale-95'
                    }
                `}
            >
                {isRefreshing ? (
                    <>
                        <Spinner size="sm" />
                        <span>Refreshing...</span>
                    </>
                ) : (
                    <>
                        <IconRefresh />
                        <span>Refresh Model Data</span>
                    </>
                )}
            </button>

            {/* Refresh Error */}
            {refreshError && (
                <div className="p-3 rounded-lg border border-[var(--color-danger)] bg-[var(--color-danger)]/10">
                    <div className="flex items-start gap-2">
                        <IconAlert className="text-[var(--color-danger)] flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm font-medium text-[var(--color-danger)] mb-1">
                                Refresh Failed
                            </p>
                            <p className="text-xs text-[var(--color-danger)]/80">
                                {refreshError.message}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Info Text */}
            <p className="text-xs text-[var(--color-text-tertiary)] text-center">
                Refreshing will fetch the latest model data from models.dev
            </p>
        </div>
    );
};
