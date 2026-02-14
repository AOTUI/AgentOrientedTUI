import { describe, it, expect, vi } from 'vitest';
import { createMemoryHistory } from '../history.js';

describe('MemoryHistory', () => {
    it('should initialize with default entry', () => {
        const history = createMemoryHistory();
        expect(history.location.pathname).toBe('/');
        expect(history.index).toBe(0);
        expect(history.entries).toHaveLength(1);
    });

    it('should initialize with custom entries', () => {
        const history = createMemoryHistory({
            initialEntries: ['/a', '/b'],
            initialIndex: 1
        });
        expect(history.location.pathname).toBe('/b');
        expect(history.index).toBe(1);
    });

    it('should push new entry', () => {
        const history = createMemoryHistory();
        const listener = vi.fn();
        history.listen(listener);

        history.push('/search');
        expect(history.location.pathname).toBe('/search');
        expect(history.index).toBe(1);
        expect(history.entries).toHaveLength(2);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should replace current entry', () => {
        const history = createMemoryHistory();
        history.push('/a');
        const listener = vi.fn();
        history.listen(listener);

        history.replace('/b');
        expect(history.location.pathname).toBe('/b');
        expect(history.index).toBe(1); // Index stays same
        expect(history.entries).toHaveLength(2);
        expect(history.entries[0].pathname).toBe('/');
        expect(history.entries[1].pathname).toBe('/b');
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should go back and forward', () => {
        const history = createMemoryHistory();
        history.push('/a');
        history.push('/b');

        expect(history.location.pathname).toBe('/b');

        history.go(-1);
        expect(history.location.pathname).toBe('/a');

        history.go(-1);
        expect(history.location.pathname).toBe('/');

        history.go(1);
        expect(history.location.pathname).toBe('/a');
    });

    it('should truncate future entries on push', () => {
        const history = createMemoryHistory();
        history.push('/a');
        history.push('/b');
        history.go(-1); // Back to /a

        history.push('/c');
        expect(history.location.pathname).toBe('/c');
        expect(history.entries.map(e => e.pathname)).toEqual(['/', '/a', '/c']);
    });
});
