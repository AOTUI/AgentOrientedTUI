import React, { useEffect, useMemo, useState } from 'react';
import { useChatBridge } from '../../../ChatBridge.js';
import { LoadingState } from '../LoadingState.js';
import { AgentEditorModal } from '../agent/AgentEditorModal.js';

interface AppDistributionEntry {
    type?: 'local' | 'npm' | 'git' | 'catalog';
    packageName?: string;
    requested?: string;
    resolvedVersion?: string;
    installedPath?: string;
    installedAt?: string;
}

interface AppEntry {
    source: string;
    enabled: boolean;
    installedAt?: string;
    autoStart?: boolean;
    originalSource?: string;
    distribution?: AppDistributionEntry;
    [key: string]: unknown;
}

interface FeedbackState {
    tone: 'success' | 'error';
    message: string;
}

type InstallMode = 'local' | 'npm';

export const AppsTab: React.FC = () => {
    const bridge = useChatBridge();

    const [apps, setApps] = useState<Record<string, AppEntry>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [selectedName, setSelectedName] = useState<string | null>(null);
    const [pending, setPending] = useState<Set<string>>(new Set());
    const [feedback, setFeedback] = useState<FeedbackState | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [installMode, setInstallMode] = useState<InstallMode>('npm');
    const [installValue, setInstallValue] = useState('');
    const [isInstalling, setIsInstalling] = useState(false);

    const appNames = useMemo(() => Object.keys(apps), [apps]);

    useEffect(() => {
        void loadApps();
    }, []);

    useEffect(() => {
        const refreshApps = () => {
            void loadApps(selectedName);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refreshApps();
            }
        };

        window.addEventListener('focus', refreshApps);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', refreshApps);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [selectedName]);

    useEffect(() => {
        if (appNames.length === 0) {
            setSelectedName(null);
            return;
        }

        if (!selectedName || !apps[selectedName]) {
            setSelectedName(appNames[0]);
        }
    }, [appNames, selectedName, apps]);

    const loadApps = async (nextSelectedName?: string | null) => {
        try {
            const data = await bridge.getTrpcClient().apps.getConfig.query();
            const nextApps = (data ?? {}) as Record<string, AppEntry>;
            setApps(nextApps);

            if (nextSelectedName !== undefined) {
                setSelectedName(nextSelectedName && nextApps[nextSelectedName] ? nextSelectedName : Object.keys(nextApps)[0] ?? null);
            }
        } catch (error) {
            console.error('[AppsTab] Failed to load app config:', error);
            setFeedback({
                tone: 'error',
                message: 'Failed to load installed agent apps.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const withPending = async (key: string, task: () => Promise<void>) => {
        if (pending.has(key)) {
            return;
        }

        setPending((prev) => new Set(prev).add(key));
        try {
            await task();
        } finally {
            setPending((prev) => {
                const next = new Set(prev);
                next.delete(key);
                return next;
            });
        }
    };

    const toggleEnabled = async (name: string, enabled: boolean) => {
        const previousApps = apps;
        setApps((current) => ({
            ...current,
            [name]: {
                ...current[name],
                enabled,
            },
        }));

        await withPending(`toggle:${name}`, async () => {
            try {
                await bridge.getTrpcClient().apps.setEnabled.mutate({ name, enabled });
            } catch (error) {
                console.error(`[AppsTab] Failed to set enabled for ${name}:`, error);
                setApps(previousApps);
                setFeedback({
                    tone: 'error',
                    message: `Failed to update ${name}.`,
                });
            }
        });
    };

    const uninstallSelected = async () => {
        if (!selectedName) {
            return;
        }

        const shouldRemove = typeof window === 'undefined' || typeof window.confirm !== 'function'
            ? true
            : window.confirm(`Uninstall app "${selectedName}"?`);

        if (!shouldRemove) {
            return;
        }

        await withPending(`remove:${selectedName}`, async () => {
            try {
                await bridge.getTrpcClient().apps.remove.mutate({ name: selectedName });
                await loadApps();
                setFeedback({
                    tone: 'success',
                    message: `${selectedName} uninstalled.`,
                });
            } catch (error) {
                console.error(`[AppsTab] Failed to uninstall ${selectedName}:`, error);
                setFeedback({
                    tone: 'error',
                    message: error instanceof Error ? error.message : `Failed to uninstall ${selectedName}.`,
                });
            }
        });
    };

    const installApp = async () => {
        const trimmed = installValue.trim();
        if (!trimmed) {
            setFeedback({
                tone: 'error',
                message: installMode === 'npm'
                    ? 'Enter an npm package name.'
                    : 'Enter a local path.',
            });
            return;
        }

        setIsInstalling(true);
        try {
            const result = await bridge.getTrpcClient().apps.install.mutate({
                source: trimmed,
            });
            await loadApps((result as { name?: string }).name ?? null);
            setInstallValue('');
            setIsAddModalOpen(false);
            setFeedback({
                tone: 'success',
                message: `Installed ${(result as { name?: string }).name ?? trimmed}.`,
            });
        } catch (error) {
            console.error('[AppsTab] Failed to install app:', error);
            setFeedback({
                tone: 'error',
                message: error instanceof Error
                    ? `${error.message} Try the command line if the issue persists.`
                    : 'Failed to install app. Try the command line if the issue persists.',
            });
        } finally {
            setIsInstalling(false);
        }
    };

    const selected = selectedName ? apps[selectedName] : null;

    if (isLoading) {
        return <LoadingState message="Loading Agent Apps..." size="md" />;
    }

    return (
        <div className="relative flex flex-col h-full min-h-0 gap-4">
            <div className="mb-2">
                <div>
                    <h3 className="text-[13px] font-medium text-[var(--color-text-secondary)]">
                        Agent Apps
                    </h3>
                    <p className="text-[13px] text-[var(--color-text-tertiary)] mt-1">
                        Manage installed agent apps and add new ones from a local path or npm package.
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => {
                        setInstallMode('npm');
                        setInstallValue('');
                        setIsAddModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-[12px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-all self-start sm:self-auto"
                >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M12 4v16m8-8H4" />
                    </svg>
                    Add Agent App
                </button>
            </div>

            {feedback ? (
                <div className={`rounded-[16px] border px-4 py-3 text-[13px] ${feedback.tone === 'success'
                    ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]'
                    : 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-text-primary)]'
                    }`}>
                    {feedback.message}
                </div>
            ) : null}

            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[320px_1fr] gap-3">
                <div className="mat-content rounded-[16px] overflow-hidden p-2">
                    {appNames.length === 0 ? (
                        <div className="h-full min-h-[180px] flex items-center justify-center text-[13px] text-[var(--color-text-tertiary)]">
                            No agent apps installed yet.
                        </div>
                    ) : (
                        <div className="space-y-1 max-h-full overflow-y-auto p-1">
                            {appNames.map((name) => {
                                const entry = apps[name];
                                const isSelected = selectedName === name;
                                const isPending = Array.from(pending).some((item) => item.endsWith(`:${name}`));

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
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <span className="text-[11px] text-[var(--color-text-tertiary)]">
                                                        {entry.enabled ? 'Enabled' : 'Disabled'}
                                                    </span>
                                                    <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-[var(--mat-border)] text-[var(--color-text-tertiary)]">
                                                        {entry.distribution?.type === 'npm' ? 'NPM' : 'LOCAL'}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={entry.enabled}
                                                disabled={isPending}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    void toggleEnabled(name, !entry.enabled);
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
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{selectedName}</h4>
                                    <p className="text-[12px] text-[var(--color-text-tertiary)] mt-1">
                                        {selected.distribution?.type === 'npm'
                                            ? 'Installed from npm and cached locally.'
                                            : 'Installed from a local project path.'}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => void uninstallSelected()}
                                    disabled={pending.has(`remove:${selectedName}`)}
                                    className="px-3 py-1.5 rounded-lg border border-[var(--color-danger)]/40 text-[var(--color-danger)] text-[12px] hover:bg-[var(--color-danger)]/10 transition-colors disabled:opacity-50"
                                >
                                    {pending.has(`remove:${selectedName}`) ? 'Uninstalling…' : 'Uninstall'}
                                </button>
                            </div>

                            <div className="space-y-3">
                                <DetailCard label="source" value={selected.originalSource || selected.source || '-'} />
                                <DetailCard label="installedAt" value={selected.installedAt || selected.distribution?.installedAt || '-'} />
                                <DetailCard label="status" value={selected.enabled ? 'Enabled' : 'Disabled'} />
                                {selected.distribution?.resolvedVersion ? (
                                    <DetailCard label="resolvedVersion" value={selected.distribution.resolvedVersion} />
                                ) : null}
                                {selected.distribution?.installedPath ? (
                                    <DetailCard label="installedPath" value={selected.distribution.installedPath} />
                                ) : null}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <AddAgentAppModal
                isOpen={isAddModalOpen}
                installMode={installMode}
                installValue={installValue}
                isInstalling={isInstalling}
                onClose={() => {
                    if (!isInstalling) {
                        setIsAddModalOpen(false);
                    }
                }}
                onModeChange={setInstallMode}
                onValueChange={setInstallValue}
                onInstall={() => void installApp()}
            />
        </div>
    );
};

const DetailCard: React.FC<{ label: string; value: string }> = ({ label, value }) => {
    return (
        <div className="rounded-xl border border-[var(--mat-border)] bg-[var(--mat-content-card-bg)] p-3">
            <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-tertiary)]">{label}</div>
            <div className="text-[13px] text-[var(--color-text-primary)] mt-1 break-all">{value || '-'}</div>
        </div>
    );
};

const SelectionIndicator: React.FC<{ active: boolean }> = ({ active }) => (
    <span
        className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${active
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
            : 'border-[var(--mat-border)] text-transparent'
            }`}
        aria-hidden="true"
    >
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.415l-7.2 7.2a1 1 0 01-1.415 0l-3.2-3.2a1 1 0 111.415-1.414l2.493 2.492 6.493-6.492a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
    </span>
);

const AddAgentAppModal: React.FC<{
    isOpen: boolean;
    installMode: InstallMode;
    installValue: string;
    isInstalling: boolean;
    onClose: () => void;
    onModeChange: (mode: InstallMode) => void;
    onValueChange: (value: string) => void;
    onInstall: () => void;
}> = ({
    isOpen,
    installMode,
    installValue,
    isInstalling,
    onClose,
    onModeChange,
    onValueChange,
    onInstall,
}) => {
    if (!isOpen) {
        return null;
    }

    return (
        <AgentEditorModal
            isOpen={isOpen}
            onClose={onClose}
            title="Add Agent App"
            width="max-w-[640px]"
            footer={
                <>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isInstalling}
                        className="lg-btn hover:bg-[var(--mat-content-card-hover-bg)] px-4 py-2 rounded-xl text-[13px] disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onInstall}
                        disabled={isInstalling}
                        className="lg-btn rounded-full px-6 py-2 text-[13px] transition-all bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90 disabled:opacity-50"
                    >
                        {isInstalling ? 'Installing…' : 'Install'}
                    </button>
                </>
            }
        >
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-tertiary)]">
                    <span aria-hidden="true" className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[var(--mat-border)] text-[10px] leading-none">i</span>
                    <span>Choose an install source, then enter an npm package name or a local project path.</span>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => onModeChange('npm')}
                        className={`rounded-2xl border p-4 text-left transition-all ${installMode === 'npm'
                            ? 'border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 shadow-[0_0_0_1px_rgba(0,0,0,0.02)]'
                            : 'border-[var(--mat-border)] bg-[var(--mat-content-card-bg)] hover:bg-[var(--mat-content-card-hover-bg)]'
                            }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-[14px] font-medium text-[var(--color-text-primary)]">Install From npm</div>
                                <div className="text-[12px] text-[var(--color-text-tertiary)] mt-1 leading-5">
                                    Use a published package such as `@agentina/aotui-ide`.
                                </div>
                            </div>
                            <SelectionIndicator active={installMode === 'npm'} />
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => onModeChange('local')}
                        className={`rounded-2xl border p-4 text-left transition-all ${installMode === 'local'
                            ? 'border-[var(--color-accent)]/35 bg-[var(--color-accent)]/10 shadow-[0_0_0_1px_rgba(0,0,0,0.02)]'
                            : 'border-[var(--mat-border)] bg-[var(--mat-content-card-bg)] hover:bg-[var(--mat-content-card-hover-bg)]'
                            }`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <div className="text-[14px] font-medium text-[var(--color-text-primary)]">Install From Local</div>
                                <div className="text-[12px] text-[var(--color-text-tertiary)] mt-1 leading-5">
                                    Use a local directory path that contains an agent app.
                                </div>
                            </div>
                            <SelectionIndicator active={installMode === 'local'} />
                        </div>
                    </button>
                </div>

                <div className="rounded-2xl border border-[var(--mat-border)] bg-[var(--mat-content-card-bg)] p-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-[12px] font-medium text-[var(--color-text-secondary)]">
                            {installMode === 'npm' ? 'Package Name' : 'Local Path'}
                        </label>
                        <p className="text-[12px] text-[var(--color-text-tertiary)]">
                            {installMode === 'npm'
                                ? 'Enter the package name exactly as published on npm.'
                                : 'Enter the directory path of a local agent app project.'}
                        </p>
                    </div>

                    <input
                        autoFocus
                        value={installValue}
                        onChange={(event) => onValueChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !isInstalling) {
                                onInstall();
                            }
                        }}
                        className="mt-3 w-full px-3 py-2 rounded-xl bg-[var(--mat-input-bg)] border border-[var(--mat-border)] text-[13px] focus:outline-none focus:border-[var(--color-accent)]"
                        placeholder={installMode === 'npm' ? '@agentina/aotui-ide' : '/path/to/local-app'}
                    />

                    <div className="mt-3 rounded-xl bg-[var(--mat-content-bg)] border border-[var(--mat-border)] px-3 py-2 text-[11px] text-[var(--color-text-tertiary)] leading-5">
                        {installMode === 'npm'
                            ? 'If installation fails here, the user can retry from the command line to inspect the full npm error output.'
                            : 'Local install only registers the app path. Uninstall does not delete the original local project files.'}
                    </div>
                </div>
            </div>
        </AgentEditorModal>
    );
};
