
import { describe, it, expect } from 'vitest';
import { SnapshotFormatter } from './formatter.js';
import type {
    ApplicationInstructionFragment,
    IDesktopMetadata,
    ISnapshotFragment,
    InstalledAppInfo,
    LogEntry
} from '../../../spi/index.js';

describe('SnapshotFormatter', () => {
    // Mock metadata
    const mockMetadata: IDesktopMetadata = {
        getInstalledApps: () => [],
        getSystemLogs: () => [],
        getAppOperationLogs: () => []
    };

    const metadataWithApps: IDesktopMetadata = {
        getInstalledApps: () => [{
            appId: 'app_0',
            name: 'Chat',
            status: 'running',
            description: 'A chat application'
        }],
        getSystemLogs: () => [{
            timestamp: 1705305600000, // 2024-01-15 16:00:00
            message: 'Application started',
            level: 'info'
        }],
        getAppOperationLogs: (appId: string) => {
            if (appId === 'app_0') {
                return [{
                    timestamp: 1705305601000,
                    message: 'User mounted ChatView'
                }];
            }
            return [];
        }
    };

    describe('buildDesktopSection', () => {
        it('should include SYSTEM_INSTRUCTION', () => {
            const formatter = new SnapshotFormatter();
            const result = formatter.format([], mockMetadata);
            expect(result.markup).toContain('# TUI Desktop System Instruction');
            expect(result.markup).toContain('system-open_app');
            expect(result.markup).toContain('system-close_app');
            expect(result.markup).not.toContain('system-dismount_view');
        });

        it('should show app list with status', () => {
            const formatter = new SnapshotFormatter();
            const result = formatter.format([], metadataWithApps);
            expect(result.markup).toContain('[Chat](application:app_0)');
            expect(result.markup).toContain('State: running');
            expect(result.markup).toContain('Description: A chat application');
        });

        it('should show system logs', () => {
            const formatter = new SnapshotFormatter();
            const result = formatter.format([], metadataWithApps);
            expect(result.markup).toContain('Application started');
        });

        it('should handle empty app list', () => {
            const formatter = new SnapshotFormatter();
            const result = formatter.format([], mockMetadata);
            expect(result.markup).toContain('No applications installed');
        });
    });

    describe('buildApplicationSection', () => {
        it('should include viewTree in application_info', () => {
            const fragment: ISnapshotFragment = {
                appId: 'app_0',
                markup: '<view>content</view>',
                indexMap: {},
                viewTree: '## Application View Tree\n- [Root](view:view_0, mounted)'
            };
            const formatter = new SnapshotFormatter();
            const result = formatter.format([fragment], mockMetadata);
            expect(result.markup).toContain('<application_info>');
            expect(result.markup).toContain('## Application View Tree');
            expect(result.markup).toContain('- [Root](view:view_0, mounted)');
        });

        it('[RFC-017] should NOT include operation logs (removed in favor of AI SDK tool-result)', () => {
            const fragment: ISnapshotFragment = {
                appId: 'app_0',
                markup: '<view>content</view>',
                indexMap: {}
            };
            const formatter = new SnapshotFormatter();
            const result = formatter.format([fragment], metadataWithApps);
            // Operation logs should NOT be present - feedback is now via tool-result messages
            expect(result.markup).not.toContain('## Recent Operations');
            expect(result.markup).not.toContain('User mounted ChatView');
        });

        it('should handle missing app info gracefully', () => {
            const fragment: ISnapshotFragment = {
                appId: 'unknown_app',
                markup: '<view>content</view>',
                indexMap: {}
            };
            const formatter = new SnapshotFormatter();
            const result = formatter.format([fragment], mockMetadata);
            expect(result.markup).toContain('<application id="unknown_app" name="unknown_app">');
        });
    });

    describe('format', () => {
        it('should merge indexMap', () => {
            const fragment: ISnapshotFragment = {
                appId: 'app_0',
                markup: '',
                indexMap: { 'key1': { type: 'text', value: 'value1' } }
            };
            // Using cast because IDesktopMetadata is minimal in mock
            const formatter = new SnapshotFormatter();
            const result = formatter.format([fragment], mockMetadata);
            expect(result.indexMap).toHaveProperty('app_0:key1');
            expect(result.indexMap['app_0:key1']).toEqual({ type: 'text', value: 'value1' });
        });

        it('should preserve fragment timestamp in structured appStates', () => {
            const fragment: ISnapshotFragment = {
                appId: 'app_0',
                markup: '',
                indexMap: {},
                timestamp: 1705305602000
            };
            const formatter = new SnapshotFormatter();
            const result = formatter.format([fragment], mockMetadata);
            expect(result.structured.appStates[0]?.timestamp).toBe(1705305602000);
        });

        it('should expose desktopTimestamp from the latest system log only', () => {
            const metadataWithLogs: IDesktopMetadata = {
                getInstalledApps: () => [{
                    appId: 'app_0',
                    name: 'IDE',
                    status: 'running',
                }],
                getSystemLogs: () => [
                    {
                        timestamp: 1705305601000,
                        message: 'Desktop created',
                    },
                    {
                        timestamp: 1705305605000,
                        message: 'App opened',
                    },
                ],
                getAppOperationLogs: () => [],
            };

            const fragment: ISnapshotFragment = {
                appId: 'app_0',
                markup: '',
                indexMap: {},
                views: [
                    {
                        viewId: 'workspace',
                        viewType: 'Workspace',
                        markup: '<view>Workspace</view>',
                        timestamp: 1705305609000,
                    },
                ],
            };

            const formatter = new SnapshotFormatter();
            const result = formatter.format([fragment], metadataWithLogs);

            expect(result.structured.desktopTimestamp).toBe(1705305605000);
        });

        it('should export view-level fragments into structured viewStates', () => {
            const metadataWithRole: IDesktopMetadata = {
                getInstalledApps: () => [{
                    appId: 'app_0',
                    name: 'IDE',
                    status: 'running',
                    promptRole: 'user'
                }],
                getSystemLogs: () => [],
                getAppOperationLogs: () => []
            };

            const fragment: ISnapshotFragment = {
                appId: 'app_0',
                markup: '<application id="app_0" name="IDE"></application>',
                indexMap: {},
                views: [
                    {
                        viewId: 'workspace',
                        viewType: 'Workspace',
                        viewName: 'Workspace',
                        markup: '<view id="workspace">Workspace Content</view>',
                        timestamp: 1705305603000
                    },
                    {
                        viewId: 'fd_0',
                        viewType: 'FileDetail',
                        viewName: 'File Detail',
                        markup: '<view id="fd_0">File A Content</view>',
                        timestamp: 1705305604000
                    }
                ]
            };

            const formatter = new SnapshotFormatter();
            const result = formatter.format([fragment], metadataWithRole);

            expect(result.structured.viewStates).toHaveLength(2);
            expect(result.structured.viewStates?.[0]).toMatchObject({
                appId: 'app_0',
                appName: 'IDE',
                viewId: 'workspace',
                viewType: 'Workspace',
                timestamp: 1705305603000,
                role: 'user'
            });
            expect(result.structured.viewStates?.[1]).toMatchObject({
                appId: 'app_0',
                appName: 'IDE',
                viewId: 'fd_0',
                viewType: 'FileDetail',
                timestamp: 1705305604000,
                role: 'user'
            });
        });

        it('should expose application instructions separately from viewStates', () => {
            const fragment: ISnapshotFragment = {
                appId: 'app_0',
                markup: '<application id="app_0" name="IDE"></application>',
                indexMap: {},
                applicationInstructions: [
                    {
                        appId: 'app_0',
                        appName: 'IDE',
                        viewId: 'workspace',
                        viewType: 'Workspace',
                        viewName: 'Workspace',
                        markup: '<instruction>Open workspace</instruction>',
                        timestamp: 1705305602000,
                        digest: 'digest-1',
                        role: 'user',
                        kind: 'application-instruction'
                    } satisfies ApplicationInstructionFragment
                ]
            };

            const formatter = new SnapshotFormatter();
            const result = formatter.format([fragment], mockMetadata);

            expect(result.structured.applicationInstructions).toHaveLength(1);
            expect(result.structured.applicationInstructions?.[0]).toMatchObject({
                appId: 'app_0',
                appName: 'IDE',
                viewId: 'workspace',
                viewType: 'Workspace',
                viewName: 'Workspace',
                markup: '<instruction>Open workspace</instruction>',
                timestamp: 1705305602000,
                digest: 'digest-1',
                role: 'user',
                kind: 'application-instruction'
            });
            expect(result.structured.viewStates ?? []).toHaveLength(0);
        });
    });
});
