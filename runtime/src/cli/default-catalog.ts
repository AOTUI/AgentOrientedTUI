export interface CatalogAppEntry {
    id: string;
    name: string;
    packageName: string;
    description: string;
    latestVersion: string;
    keywords?: string[];
    homepage?: string;
}

export interface CatalogData {
    version: number;
    updatedAt: string;
    apps: CatalogAppEntry[];
}

export const DEFAULT_APP_CATALOG: CatalogData = {
    version: 1,
    updatedAt: '2026-03-06T00:00:00.000Z',
    apps: [
        {
            id: 'system-terminal',
            name: 'Terminal',
            packageName: '@aotui/system-terminal',
            description: 'Multi-terminal command execution app for agent workflows.',
            latestVersion: '0.1.0',
            keywords: ['terminal', 'shell', 'command', 'tools']
        },
        {
            id: 'system-planning',
            name: 'Planning App',
            packageName: '@aotui/system-planning',
            description: 'Create plans, phases, and todos for long-running tasks.',
            latestVersion: '0.1.0',
            keywords: ['planning', 'todo', 'project', 'task']
        },
        {
            id: 'system-lite-browser',
            name: 'Lite Browser',
            packageName: '@aotui/system-lite-browser',
            description: 'Lightweight browser with page extraction for agents.',
            latestVersion: '0.1.0',
            keywords: ['browser', 'web', 'search', 'crawl']
        },
        {
            id: 'system-token-monitor',
            name: 'Token Monitor',
            packageName: '@aotui/system-token-monitor',
            description: 'Observe token usage and budget in AOTUI sessions.',
            latestVersion: '0.1.0',
            keywords: ['token', 'monitor', 'budget', 'usage']
        }
    ]
};
