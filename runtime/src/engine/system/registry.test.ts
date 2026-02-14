import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SnapshotRegistry } from './index.js';
import { IndexMap } from '../../../spi/index.js';

describe('SnapshotRegistry', () => {
    let registry: SnapshotRegistry;

    beforeEach(() => {
        vi.useFakeTimers();
        registry = new SnapshotRegistry({ ttl: 1000 * 60 * 10 }); // 10 mins defaults
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('creating a snapshot returns a unique ID with refCount 1', () => {
        const map: IndexMap = { 'foo': {} };
        const markup = '# Test';
        const { id } = registry.create(map, markup);

        expect(id).toBeDefined();
        expect(registry.getSnapshot(id)).toBeDefined();
        expect(registry.getSnapshot(id)?.refCount).toBe(1);
    });

    it('retain increments refCount', () => {
        const { id } = registry.create({}, '');
        registry.retain(id);
        expect(registry.getSnapshot(id)?.refCount).toBe(2);
    });

    it('release decrements refCount and destroys if 0', () => {
        const { id } = registry.create({}, '');
        registry.release(id);
        expect(registry.getSnapshot(id)).toBeUndefined();
    });

    it('release does not destroy if refCount > 0', () => {
        const { id } = registry.create({}, '');
        registry.retain(id); // ref = 2
        registry.release(id); // ref = 1
        expect(registry.getSnapshot(id)).toBeDefined();
        expect(registry.getSnapshot(id)?.refCount).toBe(1);
    });

    it('resolves index map correctly', () => {
        const map: IndexMap = { 'list[0]': { id: 1 } };
        const { id } = registry.create(map, '');
        const data = registry.resolve(id, 'list[0]');
        expect(data).toEqual({ id: 1 });
    });

    it('hard TTL destroys snapshot even if retained', () => {
        const { id } = registry.create({}, '');

        // Fast forward 11 minutes
        vi.advanceTimersByTime(1000 * 60 * 11);

        expect(registry.getSnapshot(id)).toBeUndefined();
    });
});
