import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryLockService } from './lock.service.js';
import type { DesktopID } from '../../../spi/index.js';

describe('InMemoryLockService', () => {
    let lockService: InMemoryLockService;
    const desktopId = 'dt_test' as DesktopID;

    beforeEach(() => {
        // Mock desktopExists to always return true by default
        lockService = new InMemoryLockService(() => true);
    });

    describe('acquireLock', () => {
        it('should acquire lock for new desktop', () => {
            expect(() => lockService.acquireLock(desktopId, 'agent_1')).not.toThrow();
            expect(lockService.verifyLock(desktopId, 'agent_1')).toBe(true);
        });

        it('should allow re-entry for same owner', () => {
            lockService.acquireLock(desktopId, 'agent_1');
            expect(() => lockService.acquireLock(desktopId, 'agent_1')).not.toThrow();
        });

        it('should throw DESKTOP_LOCKED for different owner', () => {
            lockService.acquireLock(desktopId, 'agent_1');
            try {
                lockService.acquireLock(desktopId, 'agent_2');
                expect.fail('Should have thrown');
            } catch (e: any) {
                expect(e.name).toBe('AOTUIError');
                expect(e.code).toBe('DESKTOP_LOCKED');
            }
        });

        it('should throw DESKTOP_NOT_FOUND for non-existent desktop', () => {
            const notExistService = new InMemoryLockService(() => false);
            try {
                notExistService.acquireLock(desktopId, 'agent_1');
                expect.fail('Should have thrown');
            } catch (e: any) {
                expect(e.name).toBe('AOTUIError');
                expect(e.code).toBe('DESKTOP_NOT_FOUND');
            }
        });

        it('should allow takeover after lock expires', () => {
            vi.useFakeTimers();
            lockService.acquireLock(desktopId, 'agent_1');

            // Advance time past TTL (5 minutes)
            vi.advanceTimersByTime(6 * 60 * 1000);

            // Should verify old lock is invalid
            expect(lockService.verifyLock(desktopId, 'agent_1')).toBe(false);

            // New owner takes over
            expect(() => lockService.acquireLock(desktopId, 'agent_2')).not.toThrow();
            expect(lockService.verifyLock(desktopId, 'agent_2')).toBe(true);

            vi.useRealTimers();
        });
    });

    describe('releaseLock', () => {
        it('should release lock for owner', () => {
            lockService.acquireLock(desktopId, 'agent_1');
            lockService.releaseLock(desktopId, 'agent_1');
            expect(lockService.verifyLock(desktopId, 'agent_1')).toBe(false);
        });

        it('should ignore release from non-owner', () => {
            lockService.acquireLock(desktopId, 'agent_1');
            lockService.releaseLock(desktopId, 'agent_2');  // Should be silent
            expect(lockService.verifyLock(desktopId, 'agent_1')).toBe(true);
        });
    });

    describe('verifyLock', () => {
        it('should return false for no lock', () => {
            expect(lockService.verifyLock(desktopId, 'agent_1')).toBe(false);
        });

        it('should return false for expired lock', () => {
            vi.useFakeTimers();
            lockService.acquireLock(desktopId, 'agent_1');
            vi.advanceTimersByTime(6 * 60 * 1000);
            expect(lockService.verifyLock(desktopId, 'agent_1')).toBe(false);
            vi.useRealTimers();
        });
    });

    describe('refreshLock', () => {
        it('should extend lock TTL', () => {
            vi.useFakeTimers();
            lockService.acquireLock(desktopId, 'agent_1');

            // Advance 4 minutes (still valid)
            vi.advanceTimersByTime(4 * 60 * 1000);
            lockService.refreshLock(desktopId, 'agent_1');

            // Advance another 4 minutes (would have expired without refresh)
            vi.advanceTimersByTime(4 * 60 * 1000);
            expect(lockService.verifyLock(desktopId, 'agent_1')).toBe(true);

            vi.useRealTimers();
        });
    });

    describe('getLockInfo', () => {
        it('should return undefined for no lock', () => {
            expect(lockService.getLockInfo(desktopId)).toBeUndefined();
        });

        it('should return lock info', () => {
            lockService.acquireLock(desktopId, 'agent_1');
            const info = lockService.getLockInfo(desktopId);
            expect(info).toMatchObject({
                ownerId: 'agent_1',
                valid: true
            });
        });
    });

    describe('clearLock', () => {
        it('should clear lock for desktop', () => {
            lockService.acquireLock(desktopId, 'agent_1');
            lockService.clearLock(desktopId);
            expect(lockService.getLockInfo(desktopId)).toBeUndefined();
        });
    });
});
