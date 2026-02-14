import { viewLinkVisitor } from '../../visitors/view-link.visitor';
import { createTransformContext } from '../../types';
import { createMockElement } from './test-utils';
import { describe, expect, it, vi } from 'vitest';

describe('ViewLinkVisitor', () => {
    // E1 Tests
    it('matches element with data-view-link', () => {
        const el = createMockElement('<div data-view-link="view1"></div>');
        const ctx = createTransformContext();
        expect(viewLinkVisitor.matches(el, ctx)).toBe(true);
    });

    it('transforms data-view-link format correctly', () => {
        const el = createMockElement('<div data-view-link="view1" data-view-description="Go to View 1">Link Text</div>');
        const ctx = createTransformContext();
        const children = vi.fn().mockReturnValue(['Link Text']);

        const result = viewLinkVisitor.transform(el, ctx, children);

        expect(result).toBe('[Link Text](view:view1) - Go to View 1\n');
    });

    // E2 Tests (Legacy)
    it('matches element with data-view-target-id', () => {
        const el = createMockElement('<div data-view-target-id="view1"></div>');
        const ctx = createTransformContext();
        expect(viewLinkVisitor.matches(el, ctx)).toBe(true);
    });

    it('matches element with view-target', () => {
        const el = createMockElement('<div view-target="view1"></div>');
        const ctx = createTransformContext();
        expect(viewLinkVisitor.matches(el, ctx)).toBe(true);
    });

    it('transforms legacy format with description and params', () => {
        const el = createMockElement(
            '<div data-view-target-id="view1" desc="Description" view-params=\'{"id":123}\'>Link</div>'
        );
        const ctx = createTransformContext();
        const children = vi.fn().mockReturnValue(['Link']);

        const result = viewLinkVisitor.transform(el, ctx, children);

        expect(result).toContain('- [Link](view:view1?id=123)\n');
        expect(result).toContain('    - Description: Description\n');
    });

    it('handles query parameters encoding', () => {
        const el = createMockElement(
            '<div view-target="view1" view-params=\'{"q":"hello world"}\'></div>'
        );
        const ctx = createTransformContext();
        const children = vi.fn().mockReturnValue([]);

        const result = viewLinkVisitor.transform(el, ctx, children);

        // RFC-006: Empty children fallback to 'View' as default content
        expect(result).toContain('[View](view:view1?q=hello%20world)');
    });

    it('ignores invalid JSON in params', () => {
        const el = createMockElement(
            '<div view-target="view1" view-params="{invalid}"></div>'
        );
        const ctx = createTransformContext();
        const children = vi.fn().mockReturnValue([]);

        const result = viewLinkVisitor.transform(el, ctx, children);

        expect(result).toContain('(view:view1)');
        expect(result).not.toContain('?');
    });
});
