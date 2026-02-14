import { viewVisitor } from '../../visitors/view.visitor';
import { createTransformContext } from '../../types';
import { createMockElement } from './test-utils';
import { describe, expect, it, vi } from 'vitest';

describe('ViewVisitor', () => {
    it('matches element with view attribute (no href)', () => {
        const el = createMockElement('<div view="chat-view"></div>');
        const ctx = createTransformContext();
        expect(viewVisitor.matches(el, ctx)).toBe(true);
    });

    it('matches element with data-is-view attribute', () => {
        const el = createMockElement('<div data-is-view name="Chat"></div>');
        const ctx = createTransformContext();
        expect(viewVisitor.matches(el, ctx)).toBe(true);
    });

    it('does not match element with view attribute AND href (implies link)', () => {
        const el = createMockElement('<a view="chat-view" href="view:xyz"></a>');
        const ctx = createTransformContext();
        expect(viewVisitor.matches(el, ctx)).toBe(false);
    });

    it('does not match element without view identifiers', () => {
        const el = createMockElement('<div></div>');
        const ctx = createTransformContext();
        expect(viewVisitor.matches(el, ctx)).toBe(false);
    });

    it('updates context.currentViewId during traversal', () => {
        const el = createMockElement('<div view="chat" id="v1"></div>');
        const ctx = createTransformContext();

        const childrenTraverser = vi.fn().mockImplementation((el, context) => {
            expect(context.currentViewId).toBe('v1');
            return ['child content'];
        });

        const result = viewVisitor.transform(el, ctx, childrenTraverser);

        expect(ctx.currentViewId).toBeNull();
        expect(result).toContain('<view id="v1" name="chat">');
        expect(result).toContain('child content');
    });

    it('logs error and skips wrapper if id is missing', () => {
        const el = createMockElement('<div view="chat"></div>'); // No id
        const ctx = createTransformContext();
        const childrenTraverser = vi.fn().mockReturnValue(['child']);
        const spyError = vi.spyOn(console, 'error').mockImplementation(() => { });

        const result = viewVisitor.transform(el, ctx, childrenTraverser);

        expect(spyError).toHaveBeenCalled();
        expect(result).toBe('child'); // Not wrapped in <view>
        expect(result).not.toContain('<view');

        spyError.mockRestore();
    });
});
