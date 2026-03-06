import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

type AppRecord = Record<string, {
    source: string;
    enabled: boolean;
    installedAt?: string;
    autoStart?: boolean;
    originalSource?: string;
    distribution?: {
        type?: 'local' | 'npm';
        packageName?: string;
        resolvedVersion?: string;
        installedPath?: string;
    };
}>;

const mockState: {
    apps: AppRecord;
} = {
    apps: {},
};

const trpcMocks = {
    getConfig: vi.fn(async () => JSON.parse(JSON.stringify(mockState.apps))),
    setEnabled: vi.fn(async ({ name, enabled }: { name: string; enabled: boolean }) => {
        mockState.apps[name].enabled = enabled;
        return { success: true };
    }),
    install: vi.fn(async ({ source }: { source: string }) => {
        const isLocal = source.startsWith('/') || source.startsWith('./');
        const appName = isLocal ? 'local-app' : 'weather-app';
        mockState.apps[appName] = {
            source: isLocal ? `local:${source}` : `local:/tmp/${appName}`,
            enabled: true,
            installedAt: '2026-03-06T00:00:00.000Z',
            autoStart: true,
            originalSource: isLocal ? `local:${source}` : `npm:${source}`,
            distribution: {
                type: isLocal ? 'local' : 'npm',
                packageName: isLocal ? undefined : source,
                resolvedVersion: isLocal ? undefined : '1.0.0',
                installedPath: isLocal ? source : `/tmp/${appName}`,
            },
        };
        return { name: appName };
    }),
    remove: vi.fn(async ({ name }: { name: string }) => {
        delete mockState.apps[name];
        return { success: true };
    }),
};

const mockBridge = {
    getTrpcClient: () => ({
        apps: {
            getConfig: { query: trpcMocks.getConfig },
            setEnabled: { mutate: trpcMocks.setEnabled },
            install: { mutate: trpcMocks.install },
            remove: { mutate: trpcMocks.remove },
        },
    }),
};

vi.mock('../../../src/gui/ChatBridge.js', () => ({
    useChatBridge: () => mockBridge,
}));

import { AppsTab } from '../../../src/gui/components/settings/apps/AppsTab.js';

describe('AppsTab', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockState.apps = {
            'system-terminal': {
                source: 'local:/tmp/system-terminal',
                enabled: true,
                installedAt: '2026-03-05T00:00:00.000Z',
                autoStart: true,
                originalSource: 'npm:@aotui/system-terminal',
                distribution: {
                    type: 'npm',
                    packageName: '@aotui/system-terminal',
                    resolvedVersion: '0.1.0',
                    installedPath: '/tmp/system-terminal',
                },
            },
        };
        vi.stubGlobal('confirm', vi.fn(() => true));
    });

    it('renders Agent Apps title and add button', async () => {
        render(<AppsTab />);

        await waitFor(() => {
            expect(screen.getByText('Agent Apps')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /add agent app/i })).toBeInTheDocument();
            expect(screen.getByText('system-terminal')).toBeInTheDocument();
        });
    });

    it('opens modal and installs from npm', async () => {
        render(<AppsTab />);

        fireEvent.click(await screen.findByRole('button', { name: /add agent app/i }));

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Install From npm')).toBeInTheDocument();

        fireEvent.change(screen.getByPlaceholderText('@agentina/aotui-ide'), {
            target: { value: '@agentina/aotui-ide' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Install' }));

        await waitFor(() => {
            expect(trpcMocks.install).toHaveBeenCalledWith({ source: '@agentina/aotui-ide' });
            expect(screen.getByText('Installed weather-app.')).toBeInTheDocument();
            expect(screen.getAllByText('weather-app').length).toBeGreaterThan(0);
        });
    });

    it('switches modal mode and installs from local path', async () => {
        render(<AppsTab />);

        fireEvent.click(await screen.findByRole('button', { name: /add agent app/i }));
        fireEvent.click(screen.getByRole('button', { name: /install from local/i }));

        fireEvent.change(screen.getByPlaceholderText('/path/to/local-app'), {
            target: { value: '/tmp/my-local-app' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Install' }));

        await waitFor(() => {
            expect(trpcMocks.install).toHaveBeenCalledWith({ source: '/tmp/my-local-app' });
            expect(screen.getByText('Installed local-app.')).toBeInTheDocument();
            expect(screen.getAllByText('local-app').length).toBeGreaterThan(0);
        });
    });

    it('uninstalls selected app', async () => {
        render(<AppsTab />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Uninstall' })).toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Uninstall' }));

        await waitFor(() => {
            expect(trpcMocks.remove).toHaveBeenCalledWith({ name: 'system-terminal' });
            expect(screen.getByText(/no agent apps installed yet/i)).toBeInTheDocument();
        });
    });

    it('refreshes installed apps when window regains focus after external changes', async () => {
        render(<AppsTab />);

        await waitFor(() => {
            expect(screen.getByText('system-terminal')).toBeInTheDocument();
        });

        mockState.apps = {};
        fireEvent(window, new Event('focus'));

        await waitFor(() => {
            expect(screen.queryByText('system-terminal')).not.toBeInTheDocument();
            expect(screen.getByText(/no agent apps installed yet/i)).toBeInTheDocument();
        });
    });
});
