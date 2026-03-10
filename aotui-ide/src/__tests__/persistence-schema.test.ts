import { normalizePersistenceSchema } from '../core/persistence-schema.js';

describe('normalizePersistenceSchema', () => {
    it('migrates legacy data that only contains openFiles', () => {
        expect(normalizePersistenceSchema({
            workspaces: {
                '/repo': {
                    openFiles: [
                        { path: '/repo/src/index.ts', lastOpened: 123 },
                    ],
                },
            },
        })).toEqual({
            workspaceFolders: [],
            workspaces: {
                '/repo': {
                    openFiles: [
                        { path: '/repo/src/index.ts', lastOpened: 123 },
                    ],
                },
            },
        });
    });

    it('deduplicates workspace folders and drops invalid rows', () => {
        expect(normalizePersistenceSchema({
            workspaceFolders: ['/repo-a', '/repo-a', '', '/repo-b'],
            workspaces: {
                '/repo': {
                    openFiles: [
                        { path: '/repo/src/index.ts', lastOpened: 123 },
                        { path: '/repo/src/invalid.ts' },
                        null,
                    ],
                },
            },
        })).toEqual({
            workspaceFolders: ['/repo-a', '/repo-b'],
            workspaces: {
                '/repo': {
                    openFiles: [
                        { path: '/repo/src/index.ts', lastOpened: 123 },
                    ],
                },
            },
        });
    });
});
