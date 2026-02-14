
import { describe, it, expect, vi } from 'vitest';
import { SnapshotBuilder } from './builder.js';
import { Desktop, InstalledApp } from '../../core/desktop.js';
import { Transformer } from '../transformer/index.js';
import { parseHTML } from 'linkedom';

describe('SnapshotBuilder', () => {
    it('should generate correct snapshot structure with application_info tag', () => {
        // 1. Setup Mock DOM
        const { window, document } = parseHTML('<!DOCTYPE html><html><body></body></html>');

        // Mock App Container
        const appContainer = document.createElement('div');
        appContainer.setAttribute('data-app-id', 'test-app');

        // Add Views (Mocking output of ViewTree + Reindexing)
        appContainer.innerHTML = `
            <div id="view_0" view="MainView">
                <h1>Main View</h1>
                <div id="view_1" view="ChildView" data-state="mounted">
                    <h2>Child</h2>
                </div>
                <a data-view-link="view_2">Unmounted Sibling</a>
            </div>
        `;
        document.body.appendChild(appContainer);

        // 2. Mock Desktop
        const desktop = {
            getInstalledApps: () => [{
                appId: 'test-app',
                name: 'Test App',
                status: 'running'
            } as InstalledApp],
            getSystemLogs: () => [],
            getAppOperationLogs: () => [],
            getAppContainer: (appId: string) => {
                if (appId === 'test-app') return appContainer;
                return null;
            }
        } as unknown as Desktop;

        // 3. Build Snapshot
        const builder = new SnapshotBuilder(new Transformer());
        const result = builder.build(desktop);
        const xml = result.markup;

        // 4. Verification

        // Check for application_info tag
        expect(xml).toContain('<application_info>');
        expect(xml).toContain('</application_info>');

        // Check Application View Tree section
        expect(xml).toContain('## Application View Tree');

        // [P1 Fix] Since getAppContainer is removed, SnapshotBuilder no longer traverses DOM.
        // Expect "No views."
        expect(xml).toContain('- No views.');

        // Should NOT contain view content anymore
        expect(xml).not.toContain('<view id="view_0"');
    });

    it('should handle empty views gracefully', () => {
        const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
        const appContainer = document.createElement('div');
        appContainer.setAttribute('data-app-id', 'empty-app');
        document.body.appendChild(appContainer);

        const desktop = {
            getInstalledApps: () => [{
                appId: 'empty-app',
                name: 'Empty App',
                status: 'running'
            }],
            getSystemLogs: () => [],
            getAppOperationLogs: () => [],
            getAppContainer: () => appContainer
        } as unknown as Desktop;

        const builder = new SnapshotBuilder();
        const xml = builder.build(desktop).markup;

        expect(xml).toContain('## Application View Tree');
        expect(xml).toContain('- No views.');
    });
});
