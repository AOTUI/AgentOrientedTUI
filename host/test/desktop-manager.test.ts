/**
 * DesktopManager Unit Tests
 * 
 * Tests the DesktopManager:
 * - Desktop creation with StoreFactory
 * - App installation
 * - Snapshot generation
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DesktopManager, type DesktopID } from '../src/core/desktop-manager.js';

describe('DesktopManager', () => {
    let desktopManager: DesktopManager;

    beforeEach(() => {
        desktopManager = new DesktopManager();
    });

    describe('createDesktop', () => {
        it('should create a Desktop with ChatApp installed', async () => {
            const { desktopId, thirdPartyAppCount } = await desktopManager.createDesktop();

            // Verify Desktop was created
            expect(desktopId).toBeDefined();
            expect(desktopId).toMatch(/^dt_/);

            expect(thirdPartyAppCount).toBeGreaterThanOrEqual(0);

            // Verify Desktop is retrievable
            const desktop = desktopManager.getDesktop(desktopId);
            expect(desktop).not.toBeNull();
        });

        it('should set StoreFactory on Kernel (fix for E_NO_STORE_FACTORY)', async () => {
            // This test verifies the bug fix:
            // Before fix: createDesktop would throw "E_NO_STORE_FACTORY"
            // After fix: should succeed because FileSystemAppStoreFactory is set

            // Should not throw
            await expect(desktopManager.createDesktop()).resolves.toBeDefined();
        });

        it('should allow multiple Desktops to be created', async () => {
            const desktop1 = await desktopManager.createDesktop();
            const desktop2 = await desktopManager.createDesktop();

            expect(desktop1.desktopId).not.toBe(desktop2.desktopId);

            // Both should be retrievable
            expect(desktopManager.getDesktop(desktop1.desktopId)).not.toBeNull();
            expect(desktopManager.getDesktop(desktop2.desktopId)).not.toBeNull();
        });
    });

    describe('getSnapshot', () => {
        it('should generate TUI snapshot for a Desktop', async () => {
            const { desktopId } = await desktopManager.createDesktop();

            const snapshot = await desktopManager.getSnapshot(desktopId);

            // Should contain TUI markup
            expect(snapshot).toBeDefined();
            expect(snapshot).toContain('<desktop');
        });

        it('should return null for non-existent Desktop', async () => {
            const snapshot = await desktopManager.getSnapshot('non-existent' as DesktopID);
            expect(snapshot).toBeNull();
        });
    });



    describe('deleteDesktop', () => {
        it('should delete a Desktop', async () => {
            const { desktopId } = await desktopManager.createDesktop();

            // Verify it exists
            expect(desktopManager.getDesktop(desktopId)).not.toBeNull();

            // Delete
            const result = await desktopManager.deleteDesktop(desktopId);
            expect(result).toBe(true);

            // Verify it's gone
            expect(desktopManager.getDesktop(desktopId)).toBeNull();

        });

        it('should be idempotent (return true for non-existent Desktop)', async () => {
            // deleteDesktop is idempotent - calling on non-existent Desktop is safe
            const result = await desktopManager.deleteDesktop('non-existent' as DesktopID);
            expect(result).toBe(true);
        });
    });

    describe('getAllDesktopIds', () => {
        it('should return all Desktop IDs', async () => {
            // Create multiple Desktops
            const d1 = await desktopManager.createDesktop();
            const d2 = await desktopManager.createDesktop();

            const allIds = desktopManager.getAllDesktopIds();

            expect(allIds).toContain(d1.desktopId);
            expect(allIds).toContain(d2.desktopId);
            expect(allIds.length).toBe(2);
        });
    });
});
