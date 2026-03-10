import { mergeWorkspaceFolders } from '../tui/workspace-folders.js';

describe('mergeWorkspaceFolders', () => {
    it('keeps env project path and deduplicates persisted folders', () => {
        expect(
            mergeWorkspaceFolders(
                ['/repo-a', '', '/repo-b', '/repo-a'],
                '/repo-b'
            )
        ).toEqual(['/repo-b', '/repo-a']);
    });

    it('returns persisted folders when no env project path exists', () => {
        expect(
            mergeWorkspaceFolders(
                ['/repo-a', '/repo-b', '/repo-a'],
                ''
            )
        ).toEqual(['/repo-a', '/repo-b']);
    });
});
