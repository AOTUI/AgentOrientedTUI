/**
 * System Operations Unit Tests
 * 
 * Tests for OpenAppOperation, CloseAppOperation, MountViewOperation, DismountViewOperation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAppOperation } from './open-app.js';
import { CloseAppOperation } from './close-app.js';

import { DismountViewOperation } from './dismount-view.js';
import type { SystemOperationContext, IDesktopForOperation } from '../../../../spi/index.js';

// Mock Desktop
function createMockDesktop(): IDesktopForOperation {
    return {
        id: 'dt_test' as any,
        openApp: vi.fn().mockResolvedValue(undefined),
        closeApp: vi.fn().mockResolvedValue(undefined),
        collapseApp: vi.fn().mockResolvedValue(undefined),
        showApp: vi.fn().mockResolvedValue(undefined),

        dismountView: vi.fn().mockResolvedValue(undefined),
        hideView: vi.fn().mockResolvedValue(undefined),
        showView: vi.fn().mockResolvedValue(undefined),
        mountViewByLink: vi.fn().mockResolvedValue(undefined) // RFC-006 V2 API
    };
}

describe('OpenAppOperation', () => {
    let operation: OpenAppOperation;
    let mockDesktop: IDesktopForOperation;

    beforeEach(() => {
        operation = new OpenAppOperation();
        mockDesktop = createMockDesktop();
    });

    it('has correct name and aliases', () => {
        expect(operation.name).toBe('open');
        expect(operation.aliases).toContain('open_app');
    });

    it('calls desktop.openApp with application argument', async () => {
        const ctx: SystemOperationContext = {
            desktopId: 'dt_1' as any,
            args: { application: 'com.example.app' }
        };

        const result = await operation.execute(ctx, mockDesktop);

        expect(result.success).toBe(true);
        expect(mockDesktop.openApp).toHaveBeenCalledWith('com.example.app');
    });

    it('returns error if application argument missing', async () => {
        const ctx: SystemOperationContext = {
            desktopId: 'dt_1' as any,
            args: {}
        };

        const result = await operation.execute(ctx, mockDesktop);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('E_MISSING_ARG');
    });
});

describe('CloseAppOperation', () => {
    let operation: CloseAppOperation;
    let mockDesktop: IDesktopForOperation;

    beforeEach(() => {
        operation = new CloseAppOperation();
        mockDesktop = createMockDesktop();
    });

    it('has correct name and aliases', () => {
        expect(operation.name).toBe('close');
        expect(operation.aliases).toContain('close_app');
    });

    it('calls desktop.closeApp with application argument', async () => {
        const ctx: SystemOperationContext = {
            desktopId: 'dt_1' as any,
            args: { application: 'com.example.app' }
        };

        const result = await operation.execute(ctx, mockDesktop);

        expect(result.success).toBe(true);
        expect(mockDesktop.closeApp).toHaveBeenCalledWith('com.example.app');
    });

    it('returns error if application argument missing', async () => {
        const ctx: SystemOperationContext = {
            desktopId: 'dt_1' as any,
            args: {}
        };

        const result = await operation.execute(ctx, mockDesktop);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('E_MISSING_ARG');
    });
});



describe('DismountViewOperation', () => {
    let operation: DismountViewOperation;
    let mockDesktop: IDesktopForOperation;

    beforeEach(() => {
        operation = new DismountViewOperation();
        mockDesktop = createMockDesktop();
    });

    it('has correct name and aliases', () => {
        expect(operation.name).toBe('dismount_view');
        expect(operation.aliases).toContain('close_view');
    });

    it('calls desktop.dismountView with appId and view arguments', async () => {
        const ctx: SystemOperationContext = {
            desktopId: 'dt_1' as any,
            args: { app_id: 'app_0', view_id: 'view_1' }
        };

        const result = await operation.execute(ctx, mockDesktop);

        expect(result.success).toBe(true);
        expect(mockDesktop.dismountView).toHaveBeenCalledWith('app_0', 'view_1');
    });

    it('returns error if view argument missing', async () => {
        const ctx: SystemOperationContext = {
            desktopId: 'dt_1' as any,
            args: { app_id: 'app_0' }
        };

        const result = await operation.execute(ctx, mockDesktop);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('E_MISSING_ARG');
    });

    it('returns error if appId argument missing', async () => {
        const ctx: SystemOperationContext = {
            desktopId: 'dt_1' as any,
            args: { view_id: 'view_1' }
        };

        const result = await operation.execute(ctx, mockDesktop);

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('E_MISSING_ARG');
    });
});
