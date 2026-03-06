import { describe, it, expect } from 'vitest';
import { searchCatalog } from './catalog.js';
import { DEFAULT_APP_CATALOG } from './default-catalog.js';

describe('searchCatalog', () => {
    it('returns all apps when query is empty', () => {
        const results = searchCatalog('');
        expect(results.length).toBe(DEFAULT_APP_CATALOG.apps.length);
    });

    it('matches by package name', () => {
        const results = searchCatalog('@aotui/system-terminal');
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].packageName).toBe('@aotui/system-terminal');
    });

    it('matches by keyword and description', () => {
        const results = searchCatalog('token');
        expect(results.some((r) => r.id === 'system-token-monitor')).toBe(true);
    });

    it('returns empty array when no match', () => {
        const results = searchCatalog('not-existing-app-keyword');
        expect(results).toEqual([]);
    });
});
