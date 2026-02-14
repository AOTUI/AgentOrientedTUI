import { operationVisitor } from '../../visitors/operation.visitor';
import { createTransformContext } from '../../types';
import { createMockElement } from './test-utils';
import { describe, expect, it, vi } from 'vitest';

describe('OperationVisitor', () => {
    it('matches element with data-operation', () => {
        const el = createMockElement('<div data-operation="submit"></div>');
        const ctx = createTransformContext();
        expect(operationVisitor.matches(el, ctx)).toBe(true);
    });

    it('matches element with operation attribute', () => {
        const el = createMockElement('<div operation="submit"></div>');
        const ctx = createTransformContext();
        expect(operationVisitor.matches(el, ctx)).toBe(true);
    });

    it('extracts display text excluding params', () => {
        const el = createMockElement(`
            <div operation="submit">
                Submit Order
                <param name="id" type="string" />
            </div>
        `);
        const ctx = createTransformContext();
        const children = vi.fn().mockReturnValue([]);

        const result = operationVisitor.transform(el, ctx, children);
        expect(result).toContain('[Submit Order](tool:submit)');
    });

    it('generates correct operation output with params and constraints', () => {
        const el = createMockElement(`
            <div operation="send" desc="Send message">
                <param name="content" type="string" required="true" desc="Msg Content" min-length="1" />
                <param name="tags" type="array" item-type="string" />
            </div>
        `);
        const ctx = createTransformContext();
        const children = vi.fn().mockReturnValue([]);

        const result = operationVisitor.transform(el, ctx, children);

        expect(result).toContain('- [send](tool:send)');
        expect(result).toContain('    - Desc: Send message');
        // Param 1
        expect(result).toContain('        - content: string (required) - Msg Content');
        expect(result).toContain('            - min length: 1');
        // Param 2
        expect(result).toContain('        - tags: array<string>');
    });

    it('registers operation definition in indexMap', () => {
        const el = createMockElement(`
            <div operation="update_status">
                <param name="status" type="enum" options="open,closed" />
            </div>
        `);
        const ctx = createTransformContext();
        ctx.currentAppId = 'app1';
        ctx.currentViewId = 'view1';
        const children = vi.fn().mockReturnValue([]);

        operationVisitor.transform(el, ctx, children);

        const opPath = 'tool:app1.view1.update_status';
        expect(ctx.indexMap[opPath]).toBeDefined();

        const def = ctx.indexMap[opPath] as any;
        expect(def.params).toHaveLength(1);
        expect(def.params[0].name).toBe('status');
        expect(def.params[0].type).toBe('enum');
        expect(def.params[0].options).toEqual(['open', 'closed']);
    });
});
