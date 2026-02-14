/**
 * DesktopManager Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DesktopManager } from './manager.js';

describe('DesktopManager', () => {
    let manager: DesktopManager;

    beforeEach(() => {
        manager = new DesktopManager();
    });

    // ─────────────────────────────────────────────────────────────
    //  Desktop 生命周期
    // ─────────────────────────────────────────────────────────────

    describe('create()', () => {
        it('should create desktop with auto-generated ID', async () => {
            const id = await manager.create();
            expect(id).toMatch(/^dt_/);
            expect(manager.has(id)).toBe(true);
        });

        it('should create desktop with custom ID', async () => {
            const customId = 'custom_desktop_id';
            const id = await manager.create(customId);
            expect(id).toBe(customId);
            expect(manager.has(customId)).toBe(true);
        });
    });

    describe('destroy()', () => {
        it('should destroy existing desktop', async () => {
            const id = await manager.create();
            expect(manager.has(id)).toBe(true);

            await manager.destroy(id);
            expect(manager.has(id)).toBe(false);
        });

        it('should be idempotent for non-existent desktop', async () => {
            await expect(manager.destroy('non_existent')).resolves.not.toThrow();
        });

        it('should also release lock when destroying', async () => {
            const id = await manager.create();
            manager.acquireLock(id, 'owner_1');
            expect(manager.verifyLock(id, 'owner_1')).toBe(true);

            await manager.destroy(id);
            expect(manager.getLockInfo(id)).toBeUndefined();
        });
    });

    describe('get()', () => {
        it('should return desktop if exists', async () => {
            const id = await manager.create();
            const desktop = manager.get(id);
            expect(desktop).toBeDefined();
            expect(desktop?.id).toBe(id);
        });

        it('should return undefined if not exists', () => {
            expect(manager.get('non_existent')).toBeUndefined();
        });
    });

    // ─────────────────────────────────────────────────────────────
    //  锁管理
    // ─────────────────────────────────────────────────────────────

    describe('acquireLock()', () => {
        it('should acquire lock successfully', async () => {
            const id = await manager.create();
            expect(() => manager.acquireLock(id, 'owner_1')).not.toThrow();
            expect(manager.verifyLock(id, 'owner_1')).toBe(true);
        });

        it('should throw E_LOCKED if already locked by another owner', async () => {
            const id = await manager.create();
            manager.acquireLock(id, 'owner_1');

            expect(() => manager.acquireLock(id, 'owner_2')).toThrow(/DESKTOP_LOCKED|is locked by/);
        });

        it('should allow re-acquire by same owner (re-entrant)', async () => {
            const id = await manager.create();
            manager.acquireLock(id, 'owner_1');

            expect(() => manager.acquireLock(id, 'owner_1')).not.toThrow();
            expect(manager.verifyLock(id, 'owner_1')).toBe(true);
        });
    });

    describe('releaseLock()', () => {
        it('should release lock for owner', async () => {
            const id = await manager.create();
            manager.acquireLock(id, 'owner_1');
            manager.releaseLock(id, 'owner_1');

            expect(manager.verifyLock(id, 'owner_1')).toBe(false);
        });

        it('should ignore release from non-owner', async () => {
            const id = await manager.create();
            manager.acquireLock(id, 'owner_1');
            manager.releaseLock(id, 'owner_2'); // Different owner

            expect(manager.verifyLock(id, 'owner_1')).toBe(true); // Still locked
        });
    });

    describe('verifyLock()', () => {
        it('should return false if no lock exists', async () => {
            const id = await manager.create();
            expect(manager.verifyLock(id, 'anyone')).toBe(false);
        });

        it('should return false for wrong owner', async () => {
            const id = await manager.create();
            manager.acquireLock(id, 'owner_1');
            expect(manager.verifyLock(id, 'owner_2')).toBe(false);
        });
    });

    describe('getLockInfo()', () => {
        it('should return lock info when locked', async () => {
            const id = await manager.create();
            manager.acquireLock(id, 'owner_1');

            const info = manager.getLockInfo(id);
            expect(info).toBeDefined();
            expect(info?.ownerId).toBe('owner_1');
            expect(info?.valid).toBe(true);
        });

        it('should return undefined when not locked', async () => {
            const id = await manager.create();
            expect(manager.getLockInfo(id)).toBeUndefined();
        });
    });

    // ─────────────────────────────────────────────────────────────
    //  App 管理 - [Worker-Only Migration]
    // ─────────────────────────────────────────────────────────────

    // installApp() and getApp() tests removed.
    // In Worker-Only architecture, use installDynamicWorkerApp instead.

    // ─────────────────────────────────────────────────────────────
    //  Desktop 状态
    // ─────────────────────────────────────────────────────────────



    describe('getDesktopInfo()', () => {
        it('should return info for existing desktop', async () => {
            const id = await manager.create();
            const info = manager.getDesktopInfo(id);

            expect(info).toBeDefined();
            expect(info?.status).toBe('active');
            expect(info?.createdAt).toBeLessThanOrEqual(Date.now());
        });

        it('should return undefined for non-existent desktop', () => {
            expect(manager.getDesktopInfo('non_existent')).toBeUndefined();
        });
    });

    // ─────────────────────────────────────────────────────────────
    //  生命周期控制
    // ─────────────────────────────────────────────────────────────

    describe('suspend() and resume()', () => {
        it('should suspend desktop', async () => {
            const id = await manager.create();
            await manager.suspend(id);

            const info = manager.getDesktopInfo(id);
            expect(info?.status).toBe('suspended');
        });

        it('should resume suspended desktop', async () => {
            const id = await manager.create();
            await manager.suspend(id);
            await manager.resume(id);

            const info = manager.getDesktopInfo(id);
            expect(info?.status).toBe('active');
        });

        it('should throw E_NOT_FOUND for non-existent desktop', async () => {
            await expect(manager.suspend('non_existent')).rejects.toThrow(/DESKTOP_NOT_FOUND|not found/);
            await expect(manager.resume('non_existent')).rejects.toThrow(/DESKTOP_NOT_FOUND|not found/);
        });
    });
});

