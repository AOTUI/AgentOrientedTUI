import { describe, expect, it } from 'vitest';
import { SnapshotFormatter } from './formatter.js';

describe('SnapshotFormatter tool key collision', () => {
    it('appends numeric suffix to app_name on tool key conflicts', () => {
        const formatter = new SnapshotFormatter();

        const fragments = [
            {
                appId: 'app_0',
                markup: '<view />',
                indexMap: {
                    'tool:system_ide-FileDetail-lsp_hover': {
                        description: 'Hover',
                        params: [],
                        appId: 'app_0',
                        appName: 'system_ide',
                        viewType: 'FileDetail',
                        toolName: 'lsp_hover',
                    },
                },
                timestamp: 100,
            },
            {
                appId: 'app_1',
                markup: '<view />',
                indexMap: {
                    'tool:system_ide-FileDetail-lsp_hover': {
                        description: 'Hover',
                        params: [],
                        appId: 'app_1',
                        appName: 'system_ide',
                        viewType: 'FileDetail',
                        toolName: 'lsp_hover',
                    },
                },
                timestamp: 200,
            },
        ] as any;

        const metadata = {
            getInstalledApps: () => [
                { appId: 'app_0', name: 'System IDE', status: 'running' as const },
                { appId: 'app_1', name: 'System IDE 2', status: 'running' as const },
            ],
            getSystemLogs: () => [],
            getAppOperationLogs: () => [],
        } as any;

        const result = formatter.format(fragments, metadata);

        expect(result.indexMap['tool:system_ide-FileDetail-lsp_hover']).toBeDefined();
        expect(result.indexMap['tool:system_ide_2-FileDetail-lsp_hover']).toBeDefined();

        const second = result.indexMap['tool:system_ide_2-FileDetail-lsp_hover'] as any;
        expect(second.appId).toBe('app_1');
        expect(second.toolName).toBe('lsp_hover');
    });
});
