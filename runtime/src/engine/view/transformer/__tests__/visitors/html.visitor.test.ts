import { htmlVisitor } from '../../visitors/html.visitor';
import { createTransformContext } from '../../types';
import { createMockElement } from './test-utils';
import { describe, expect, it, vi } from 'vitest';

describe('HtmlVisitor', () => {
    it('transforms h1-h6 headers', () => {
        const el = createMockElement('<h1>Title</h1>');
        const ctx = createTransformContext();
        const children = vi.fn().mockReturnValue(['Title']);
        expect(htmlVisitor.transform(el, ctx, children)).toBe('\n# Title\n');
    });

    it('transforms p tags', () => {
        const el = createMockElement('<p>Para</p>');
        const ctx = createTransformContext();
        const children = vi.fn().mockReturnValue(['Para']);
        expect(htmlVisitor.transform(el, ctx, children)).toBe('\nPara\n');
    });

    it('transforms bold and italic', () => {
        const elB = createMockElement('<b>Bold</b>');
        const elI = createMockElement('<i>Italic</i>');
        const ctx = createTransformContext();

        expect(htmlVisitor.transform(elB, ctx, vi.fn().mockReturnValue(['Bold']))).toBe('**Bold**');
        expect(htmlVisitor.transform(elI, ctx, vi.fn().mockReturnValue(['Italic']))).toBe('*Italic*');
    });

    it('transforms links', () => {
        const el = createMockElement('<a href="https://example.com">Link</a>');
        const ctx = createTransformContext();
        const children = vi.fn().mockReturnValue(['Link']);
        expect(htmlVisitor.transform(el, ctx, children)).toBe('[Link](https://example.com)');
    });

    it('transforms code blocks', () => {
        const el = createMockElement('<pre><code class="language-ts">const a = 1;</code></pre>');
        const ctx = createTransformContext();
        // pre handles content extraction itself or via children
        // In the visitor impl: const codeEl = el.querySelector('code'); ...
        // So we don't rely on children() for content if code tag exists
        const children = vi.fn().mockReturnValue([]);

        const result = htmlVisitor.transform(el, ctx, children);
        expect(result).toContain('```ts');
        expect(result).toContain('const a = 1;');
        expect(result).toContain('```');
    });

    it('transforms blockquotes', () => {
        const el = createMockElement('<blockquote>Quote\nLine 2</blockquote>');
        const ctx = createTransformContext();
        const children = vi.fn().mockReturnValue(['Quote\nLine 2']);

        const result = htmlVisitor.transform(el, ctx, children);
        expect(result).toContain('> Quote');
        expect(result).toContain('> Line 2');
    });

    // [RFC-FIX] Test for Operation inside list (the bug that was fixed)
    describe('List with semantic elements', () => {
        it('transforms Operation inside <ol> using recursive Visitor Pattern', () => {
            // Simulate: <ol><button operation="send_message">发送消息</button></ol>
            // The children traverser should return the Operation markdown
            const el = createMockElement('<ol><button operation="send_message">发送消息</button></ol>');
            const ctx = createTransformContext();

            // Mock children to return Operation markdown when called on the button
            const children = vi.fn().mockImplementation((childEl: Element) => {
                if (childEl.tagName.toLowerCase() === 'button') {
                    // Simulate operationVisitor output
                    return ['- [发送消息](tool:send_message)'];
                }
                return [childEl.textContent || ''];
            });

            const result = htmlVisitor.transform(el, ctx, children);
            // The key assertion: Operation markdown should be preserved, not flattened to text
            expect(result).toContain('tool:send_message');
        });

        it('transforms multiple Operations inside <ol>', () => {
            const el = createMockElement(`
                <ol>
                    <button operation="send_message">发送消息</button>
                    <button operation="pin_message">Pin 消息</button>
                </ol>
            `);
            const ctx = createTransformContext();

            const children = vi.fn().mockImplementation((childEl: Element) => {
                const op = childEl.getAttribute('operation');
                if (op) {
                    return [`- [${childEl.textContent}](tool:${op})`];
                }
                return [childEl.textContent || ''];
            });

            const result = htmlVisitor.transform(el, ctx, children);
            expect(result).toContain('tool:send_message');
            expect(result).toContain('tool:pin_message');
        });

        it('transforms nested list with Operations', () => {
            const el = createMockElement(`
                <ul>
                    <li>
                        Item 1
                        <ul>
                            <li><button operation="nested_op">Nested</button></li>
                        </ul>
                    </li>
                </ul>
            `);
            const ctx = createTransformContext();

            // Mock children to recursively check for operation attribute
            // This simulates the real ChildrenTraverser behavior
            const children = vi.fn().mockImplementation((childEl: Element) => {
                // Check if element itself has operation
                const op = childEl.getAttribute('operation');
                if (op) {
                    return [`[${childEl.textContent}](tool:${op})`];
                }

                // Check if any descendant has operation (simulating recursive behavior)
                const opButton = childEl.querySelector('[operation]');
                if (opButton) {
                    const opId = opButton.getAttribute('operation');
                    return [`[${opButton.textContent}](tool:${opId})`];
                }

                return [childEl.textContent?.trim() || ''];
            });

            const result = htmlVisitor.transform(el, ctx, children);
            expect(result).toContain('tool:nested_op');
        });
    });
});
