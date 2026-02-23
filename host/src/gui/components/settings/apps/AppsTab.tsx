import React, { useEffect, useMemo, useState } from 'react';
import { useChatBridge } from '../../../ChatBridge.js';
import { LoadingState } from '../LoadingState.js';

interface AppEntry {
    source: string;
    enabled: boolean;
    installedAt?: string;
    [key: string]: unknown;
}

export const AppsTab: React.FC = () => {
    const bridge = useChatBridge();

    const [apps, setApps] = useState<Record<string, AppEntry>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [selectedName, setSelectedName] = useState<string | null>(null);
    const [pending, setPending] = useState<Set<string>>(new Set());

    const appNames = useMemo(() => Object.keys(apps), [apps]);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await bridge.getTrpcClient().apps.getConfig.query();
                setApps((data ?? {}) as Record<string, AppEntry>);
            } catch (error) {
                console.error('[AppsTab] Failed to load app config:', error);
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, [bridge]);

    useEffect(() => {
        if (appNames.length === 0) {
            setSelectedName(null);
            return;
        }

        if (!selectedName || !apps[selectedName]) {
            setSelectedName(appNames[0]);
        }
    }, [appNames, selectedName, apps]);

    const toggleEnabled = async (name: string, enabled: boolean) => {
        if (pending.has(name)) {
            return;
        }

        const previousApps = apps;
        const optimistic = {
            ...apps,
            [name]: {
                ...apps[name],
                enabled,
            },
        };

        setPending((prev) => new Set(prev).add(name));
        setApps(optimistic);

        try {
            await bridge.getTrpcClient().apps.setEnabled.mutate({ name, enabled });
        } catch (error) {
            console.error(`[AppsTab] Failed to set enabled for ${name}:`, error);
            setApps(previousApps);
        } finally {
            setPending((prev) => {
                const next = new Set(prev);
                next.delete(name);
                return next;
            });
        }
    };

    const selected = selectedName ? apps[selectedName] : null;

    if (isLoading) {
        return <LoadingState message="Loading AOTUI Apps..." size="md" />;
    }

    return (
        <div className="relative flex flex-col h-full min-h-0 gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                <div>
                    <h3 className="text-[13px] font-medium text-[var(--color-text-secondary)]">
                        AOTUI Apps
                    </h3>
                    <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">
                        Manage enabled state from ~/.tui/config.json.
                    </p>
                </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3">
                <div className="mat-content rounded-[16px] overflow-hidden p-2">
                    {appNames.length === 0 ? (
                        <div className="h-full min-h-[180px] flex items-center justify-center text-[13px] text-[var(--color-text-tertiary)]">
                            No apps found in ~/.tui/config.json
                        </div>
                    ) : (
                        <div className="space-y-1 max-h-full overflow-y-auto p-1">
                            {appNames.map((name) => {
                                const entry = apps[name];
                                const isSelected = selectedName === name;
                                const isPending = pending.has(name);

                                return (
                                    <div
                                        key={name}
                                        onClick={() => setSelectedName(name)}
                                        className={`w-full text-left px-3 py-2 rounded-xl border transition-all duration-200 ${isSelected
                                            ? 'bg-[var(--mat-content-card-hover-bg)] border-[var(--mat-border-highlight)]'
                                            : 'bg-transparent border-transparent hover:bg-[var(--mat-content-card-hover-bg)] hover:border-[var(--mat-border)]'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="text-[13px] text-[var(--color-text-primary)] truncate">{name}</div>
                                                <div className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
                                                    {entry.enabled ? 'Enabled' : 'Disabled'}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={entry.enabled}
                                                disabled={isPending}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    toggleEnabled(name, !entry.enabled);
                                                }}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${entry.enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--mat-border)]'} ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                                                    }`}
                                            >
                                                <span
                                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${entry.enabled ? 'translate-x-4' : 'translate-x-0.5'
                                                        }`}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="mat-content rounded-[16px] p-4 sm:p-5 overflow-y-auto">
                    {!selectedName || !selected ? (
                        <div className="h-full min-h-[180px] flex items-center justify-center text-[13px] text-[var(--color-text-tertiary)]">
                            Select an app to view details
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{selectedName}</h4>
                                <p className="text-[12px] text-[var(--color-text-tertiary)] mt-1">App details</p>
                            </div>

                            <div className="space-y-3">
                                <div className="rounded-xl border border-[var(--mat-border)] bg-[var(--mat-content-card-bg)] p-3">
                                    <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)]">source</div>
                                    <div className="text-[13px] text-[var(--color-text-primary)] mt-1 break-all">{selected.source || '-'}</div>
                                </div>

                                <div className="rounded-xl border border-[var(--mat-border)] bg-[var(--mat-content-card-bg)] p-3">
                                    <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)]">installedAt</div>
                                    <div className="text-[13px] text-[var(--color-text-primary)] mt-1">{selected.installedAt || '-'}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
