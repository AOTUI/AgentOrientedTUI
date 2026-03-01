import { describe, expect, it } from 'vitest';
import { MessageDeduplicator } from '../../src/im/dedup.js';

describe('MessageDeduplicator', () => {
  it('marks first-seen message as non-duplicate', () => {
    const dedup = new MessageDeduplicator({ maxSize: 10, ttlMs: 10_000 });
    expect(dedup.isDuplicate('m1', 1_000)).toBe(false);
  });

  it('marks repeated message id as duplicate', () => {
    const dedup = new MessageDeduplicator({ maxSize: 10, ttlMs: 10_000 });
    expect(dedup.isDuplicate('m1', 1_000)).toBe(false);
    expect(dedup.isDuplicate('m1', 1_500)).toBe(true);
  });

  it('treats different message ids independently', () => {
    const dedup = new MessageDeduplicator({ maxSize: 10, ttlMs: 10_000 });
    expect(dedup.isDuplicate('m1', 1_000)).toBe(false);
    expect(dedup.isDuplicate('m2', 1_001)).toBe(false);
    expect(dedup.isDuplicate('m1', 1_002)).toBe(true);
    expect(dedup.isDuplicate('m2', 1_003)).toBe(true);
  });

  it('expires old entries by ttl', () => {
    const dedup = new MessageDeduplicator({ maxSize: 10, ttlMs: 100 });
    expect(dedup.isDuplicate('m1', 1_000)).toBe(false);
    expect(dedup.isDuplicate('m1', 1_050)).toBe(true);
    expect(dedup.isDuplicate('m1', 1_101)).toBe(false);
  });

  it('evicts oldest entry when exceeding maxSize', () => {
    const dedup = new MessageDeduplicator({ maxSize: 2, ttlMs: 10_000 });
    expect(dedup.isDuplicate('m1', 1_000)).toBe(false);
    expect(dedup.isDuplicate('m2', 1_001)).toBe(false);
    expect(dedup.isDuplicate('m3', 1_002)).toBe(false);

    expect(dedup.isDuplicate('m2', 1_003)).toBe(true);
    expect(dedup.isDuplicate('m3', 1_004)).toBe(true);
    expect(dedup.isDuplicate('m1', 1_005)).toBe(false);
  });
});