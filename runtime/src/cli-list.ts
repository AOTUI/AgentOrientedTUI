import type { AppRegistry } from './engine/app/index.js';
import type { TUIConfig } from './engine/app/config.js';

export function renderInstalledAppLines(
    config: TUIConfig,
    registry: Pick<AppRegistry, 'get'>
): string[] {
    const appNames = Object.keys(config.apps);

    if (appNames.length === 0) {
        return [
            'No apps installed.',
            '',
            'Install an app with: agentina install <source>',
        ];
    }

    const lines = ['Installed apps:', ''];

    for (const name of appNames) {
        const entry = config.apps[name];
        const loadedApp = registry.get(name);
        const enabledStatus = entry.enabled ? '✅' : '❌';
        const autoStartStatus = (entry.autoStart ?? true) ? '🚀' : '⏸️';

        if (loadedApp) {
            const version = loadedApp.manifest?.version ?? 'N/A';
            lines.push(`  ${enabledStatus}${autoStartStatus} ${name}`);
            lines.push(`     Version: ${version}`);
        } else {
            lines.push(`  ${enabledStatus}${autoStartStatus} ${name} (disabled)`);
        }

        if (entry.originalSource && entry.originalSource !== entry.source) {
            lines.push(`     Source: ${entry.originalSource}`);
            lines.push(`     Resolved: ${entry.source}`);
        } else {
            lines.push(`     Source: ${entry.source}`);
        }

        lines.push('');
    }

    lines.push('Legend: ✅=enabled ❌=disabled 🚀=auto-start ⏸️=manual-start');
    return lines;
}
