import type { Location } from './context.js';

export interface MemoryHistory {
    index: number;
    location: Location;
    entries: Location[];
    listen(listener: (update: { location: Location }) => void): () => void;
    push(path: string, state?: any): void;
    replace(path: string, state?: any): void;
    go(delta: number): void;
}

export function createMemoryHistory(options: { initialEntries?: string[]; initialIndex?: number } = {}): MemoryHistory {
    let entries = (options.initialEntries || ['/']).map(path => createLocation(path));
    let index = options.initialIndex || 0;
    const listeners = new Set<(update: { location: Location }) => void>();

    function createLocation(path: string, state?: any, key?: string): Location {
        const [pathname, search = ''] = path.split('?');
        return {
            pathname,
            search: search ? `?${search}` : '',
            hash: '',
            state,
            key: key || Math.random().toString(36).substr(2, 8)
        };
    }

    const history: MemoryHistory = {
        get index() { return index; },
        get entries() { return entries; },
        get location() { return entries[index]; },

        listen(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },

        push(path, state) {
            const newLocation = createLocation(path, state);
            // Remove future entries if any
            entries = entries.slice(0, index + 1);
            entries.push(newLocation);
            index = entries.length - 1;
            notify();
        },

        replace(path, state) {
            const newLocation = createLocation(path, state);
            entries[index] = newLocation;
            notify();
        },

        go(delta) {
            const newIndex = index + delta;
            if (newIndex >= 0 && newIndex < entries.length) {
                index = newIndex;
                notify();
            }
        }
    };

    function notify() {
        const update = { location: history.location };
        listeners.forEach(l => l(update));
    }

    return history;
}
