import { DEFAULT_APP_CATALOG, type CatalogAppEntry, type CatalogData } from './default-catalog.js';

export interface CatalogSearchResult extends CatalogAppEntry {
    score: number;
}

export function isCatalogData(value: unknown): value is CatalogData {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const candidate = value as Partial<CatalogData>;
    if (typeof candidate.version !== 'number' || typeof candidate.updatedAt !== 'string' || !Array.isArray(candidate.apps)) {
        return false;
    }

    return candidate.apps.every((app) => (
        typeof app === 'object'
        && app !== null
        && typeof app.id === 'string'
        && typeof app.name === 'string'
        && typeof app.packageName === 'string'
        && typeof app.description === 'string'
        && typeof app.latestVersion === 'string'
        && (app.keywords === undefined || Array.isArray(app.keywords))
        && (app.homepage === undefined || typeof app.homepage === 'string')
    ));
}

export function searchCatalog(query: string | undefined, catalog: CatalogData = DEFAULT_APP_CATALOG): CatalogSearchResult[] {
    const normalized = (query ?? '').trim().toLowerCase();
    if (!normalized) {
        return catalog.apps.map((app) => ({ ...app, score: 1 }));
    }

    const matches = catalog.apps
        .map((app) => {
            const haystacks = [
                app.id,
                app.name,
                app.packageName,
                app.description,
                ...(app.keywords ?? [])
            ].map((item) => item.toLowerCase());

            const contains = haystacks.some((item) => item.includes(normalized));
            if (!contains) {
                return null;
            }

            let score = 10;
            if (app.packageName.toLowerCase() === normalized) score += 30;
            if (app.id.toLowerCase() === normalized) score += 20;
            if (app.name.toLowerCase() === normalized) score += 15;
            if (app.packageName.toLowerCase().includes(normalized)) score += 8;
            if ((app.keywords ?? []).some((k) => k.toLowerCase() === normalized)) score += 5;

            return { ...app, score };
        })
        .filter((app): app is CatalogSearchResult => app !== null)
        .sort((a, b) => b.score - a.score || a.packageName.localeCompare(b.packageName));

    return matches;
}
