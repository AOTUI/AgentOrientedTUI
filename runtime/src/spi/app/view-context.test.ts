import { describe, it, expect } from 'vitest';
import type { IViewContextCore, IViewContext, IViewContextMountable } from './index';
import { hasMountableSupport } from './view-context-ext.interface';

describe('ViewContext SPI', () => {
    it('hasMountableSupport should identify objects with required RFC-006 methods', () => {
        const minimalContext: IViewContextCore = {
            appId: 'app_1' as any,
            desktopId: 'desktop_1' as any,
            viewId: 'view_1' as any,
            container: {} as any,
            document: {} as any
        };

        // [RFC-006] Full mountable context with new API
        const mountableContext = {
            ...minimalContext,
            // RFC-006 new methods
            registerLink: () => 'link_1',
            unregisterLink: () => { },
            getBoundViewId: () => undefined,

        };
        expect(hasMountableSupport(mountableContext)).toBe(true);
        expect(hasMountableSupport(minimalContext)).toBe(false);
    });
});

