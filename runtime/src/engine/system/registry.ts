import type { SnapshotID, CachedSnapshot, IndexMap, DataPayload, IRegistry, StructuredSnapshot } from '../../spi/index.js';
import { createSnapshotId } from '../../spi/index.js';
import { AOTUIError } from '../../spi/core/errors.js';
import { randomUUID } from 'crypto';

interface RegistryConfig {
    ttl: number; // Time to live in ms
}

export class SnapshotRegistry implements IRegistry {
    private snapshots = new Map<SnapshotID, CachedSnapshot & { timer: NodeJS.Timeout }>();
    private config: RegistryConfig;

    constructor(config: RegistryConfig = { ttl: 10 * 60 * 1000 }) {
        this.config = config;
    }

    /**
     * Creates a new snapshot and registers it.
     * Starts with RefCount = 1.
     * 
     * [RFC-014] Now accepts optional structured parameter.
     */
    create(indexMap: IndexMap, markup: string, ttl?: number, structured?: StructuredSnapshot): CachedSnapshot {
        const id: SnapshotID = createSnapshotId();

        // Use provided TTL or default config TTL
        const effectiveTTL = ttl !== undefined && ttl > 0 ? ttl : this.config.ttl;

        // Set Hard TTL safety timer
        const timer = setTimeout(() => {
            this.forceDestroy(id);
        }, effectiveTTL);

        const createdAt = Date.now();
        const snapshot: CachedSnapshot = {
            id,
            indexMap,
            markup,
            structured, // [RFC-014] Include structured output
            createdAt,
            refCount: 1,
            ttl: effectiveTTL,
            expiresAt: createdAt + effectiveTTL
        };

        this.snapshots.set(id, {
            ...snapshot,
            timer
        });

        return snapshot;
    }

    /**
     * Increases reference count.
     */
    retain(id: SnapshotID): void {
        const snap = this.snapshots.get(id);
        if (!snap) {
            throw new AOTUIError('SNAPSHOT_EXPIRED', { snapshotId: id });
        }
        snap.refCount++;
    }

    /**
     * Decreases reference count. Destroys if 0.
     */
    release(id: SnapshotID): void {
        const snap = this.snapshots.get(id);
        if (!snap) return; // Already gone, ignore

        snap.refCount--;
        if (snap.refCount <= 0) {
            this.destroy(id);
        }
    }

    /**
     * Resolves a data path from the snapshot.
     */
    resolve(id: SnapshotID, path: string): DataPayload | undefined {
        const snap = this.snapshots.get(id);
        if (!snap) {
            console.log(`[Registry] Snapshot ${id} not found`);
            return undefined;
        }

        const result = snap.indexMap[path];
        if (result === undefined) {
            console.log(`[Registry] Key "${path}" not found in snapshot ${id}`);
            console.log(`[Registry] Available keys in IndexMap:`, Object.keys(snap.indexMap).slice(0, 20));
        }

        return result;
    }

    /**
     * Returns snapshot without internal implementation details.
     * [H1 FIX] No longer exposes internal `timer` field.
     */
    getSnapshot(id: SnapshotID): CachedSnapshot | undefined {
        const snap = this.snapshots.get(id);
        if (!snap) return undefined;

        // Destructure to exclude internal timer field
        const { timer, ...publicSnapshot } = snap;
        return publicSnapshot;
    }

    private destroy(id: SnapshotID): void {
        const snap = this.snapshots.get(id);
        if (snap) {
            clearTimeout(snap.timer);
            this.snapshots.delete(id);
        }
    }

    private forceDestroy(id: SnapshotID): void {
        this.destroy(id);
    }
}
