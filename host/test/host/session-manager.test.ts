import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from '../../src/host/session-manager.js';
import type { IDesktopManager } from '@aotui/runtime';

describe('SessionManager (Dependency Injection)', () => {
    let mockDesktopManager: any;
    let sessionManager: SessionManager;
    let mockKernel: any;

    beforeEach(() => {
        mockKernel = {
            createDesktop: vi.fn().mockResolvedValue('test-desktop-id'),
            installDynamicWorkerApp: vi.fn().mockResolvedValue(undefined),
            getDesktop: vi.fn().mockReturnValue({ id: 'test-desktop-id' })
        };

        // Create a mock DesktopManager
        mockDesktopManager = {
            getKernel: vi.fn().mockReturnValue(mockKernel),
            getThirdPartyAppsConfig: vi.fn().mockReturnValue([]),
            deleteDesktop: vi.fn().mockResolvedValue(undefined)
        };

        sessionManager = new SessionManager(mockDesktopManager as unknown as IDesktopManager, {
            defaultSystemPrompt: 'Test Prompt'
        });
    });

    it('should initialize with injected desktopManager', () => {
        expect(sessionManager).toBeDefined();
    });

    it('should call desktopManager.createDesktop when creating a session (non-lazy)', async () => {
        const sessionId = 'session-123';
        await sessionManager.createSession(sessionId, { lazyDesktop: false });

        expect(mockKernel.createDesktop).toHaveBeenCalled();
    });

    it('should not call desktopManager.createDesktop immediately if lazyDesktop is true', async () => {
        const sessionId = 'session-lazy';
        await sessionManager.createSession(sessionId, { lazyDesktop: true });

        expect(mockKernel.createDesktop).not.toHaveBeenCalled();
    });

    it('should call desktopManager.createDesktop when ensuring lazy session is initialized', async () => {
        const sessionId = 'session-lazy';
        await sessionManager.createSession(sessionId, { lazyDesktop: true });
        
        await sessionManager.ensureDesktopInitialized(sessionId);

        expect(mockKernel.createDesktop).toHaveBeenCalled();
    });

    it('should call desktopManager.deleteDesktop when destroying a session', async () => {
        const sessionId = 'session-to-destroy';
        await sessionManager.createSession(sessionId, { lazyDesktop: false });
        
        await sessionManager.destroySession(sessionId);

        expect(mockDesktopManager.deleteDesktop).toHaveBeenCalledWith('test-desktop-id');
    });
});
