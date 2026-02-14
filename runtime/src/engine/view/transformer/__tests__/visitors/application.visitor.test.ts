import { applicationVisitor } from '../../visitors/application.visitor';
import { createTransformContext } from '../../types';
import { parseHTML } from 'linkedom';
import { describe, expect, it, vi } from 'vitest';

import { createMockElement } from './test-utils';


describe('ApplicationVisitor', () => {
    it('matches element with data-app-id', () => {
        const el = createMockElement('<div data-app-id="app1"></div>');
        const ctx = createTransformContext();
        expect(applicationVisitor.matches(el, ctx)).toBe(true);
    });

    it('does not match element without data-app-id', () => {
        const el = createMockElement('<div></div>');
        const ctx = createTransformContext();
        expect(applicationVisitor.matches(el, ctx)).toBe(false);
    });

    it('updates context.currentAppId during traversal', () => {
        const el = createMockElement('<div data-app-id="app1"><child></child></div>');
        const ctx = createTransformContext();

        const childrenTraverser = vi.fn().mockImplementation((el, context) => {
            // Verify context inside children
            expect(context.currentAppId).toBe('app1');
            return ['child content'];
        });

        const result = applicationVisitor.transform(el, ctx, childrenTraverser);

        // Verify restoration after return
        expect(ctx.currentAppId).toBeNull();
        expect(childrenTraverser).toHaveBeenCalled();
        expect(result).toContain('<application id="app1" name="">');
        expect(result).toContain('child content');
    });

    it('handles collapsed state', () => {
        const el = createMockElement('<div data-app-id="app1" data-state="collapsed"></div>');
        const ctx = createTransformContext();
        const childrenTraverser = vi.fn();

        const result = applicationVisitor.transform(el, ctx, childrenTraverser);

        expect(result).toContain('<application id="app1" name="" state="collapsed" />');
        expect(childrenTraverser).not.toHaveBeenCalled();
    });

    it('handles nested applications (restores context)', () => {
        const el = createMockElement('<div data-app-id="outer"></div>');
        const ctx = createTransformContext();

        // Simulate inner transform logic manually for test clarity
        // In reality, this would be handled by recursive traverse
        const childrenTraverser = vi.fn().mockImplementation((el, context) => {
            // Simulate nested app causing context change
            const prev = context.currentAppId;
            context.currentAppId = 'inner';
            // ... process 
            context.currentAppId = prev; // Restore
            return ['inner content'];
        });

        applicationVisitor.transform(el, ctx, childrenTraverser);

        expect(ctx.currentAppId).toBeNull();
    });
});
