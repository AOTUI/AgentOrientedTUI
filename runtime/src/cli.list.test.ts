import { describe, expect, it } from 'vitest';
import { renderInstalledAppLines } from './cli-list.js';

describe('renderInstalledAppLines', () => {
    it('renders the raw app_name instead of manifest or factory display names', () => {
        const lines = renderInstalledAppLines(
            {
                version: 2,
                apps: {
                    system_ide: {
                        source: 'local:/mock/system-ide',
                        enabled: true,
                        autoStart: true,
                    },
                },
            } as any,
            {
                get(name: string) {
                    if (name !== 'system_ide') {
                        return undefined;
                    }

                    return {
                        name: 'system_ide',
                        manifest: {
                            name: 'legacy-ide',
                            displayName: 'AOTUI IDE',
                            version: '1.0.0',
                            entry: { main: './dist/index.js' },
                        },
                        factory: {
                            displayName: 'Fancy IDE',
                        },
                    };
                },
            } as any
        );

        expect(lines.join('\n')).toContain('system_ide');
        expect(lines.join('\n')).not.toContain('AOTUI IDE');
        expect(lines.join('\n')).not.toContain('Fancy IDE');
    });
});
