import { transformDOM, transformElement } from '../pure';
import { createMockElement } from './visitors/test-utils';
import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';

describe('Transformer Integration', () => {
    it('transforms a complete ChatView structure', () => {
        const html = `
        <div data-app-id="chat-app" name="Chat App">
            <div view="chat-view" id="chat-view">
                <h1>Chat History</h1>
                <div list="messages" item-type="message">
                    <li data-value='{"id":1, "text":"hello"}'>Hello</li>
                    <li data-value='{"id":2, "text":"world"}'>World</li>
                </div>
                <div operation="send_message" desc="Send a text">
                    <param name="text" type="string" required="true" />
                </div>
                <div data-view-link="settings" data-view-description="Go to Settings">Settings</div>
            </div>
        </div>
        `;

        const el = createMockElement(html);
        const result = transformElement(el);

        const m = result.markup;

        // App
        expect(m).toContain('<application id="chat-app" name="Chat App">');

        // View
        expect(m).toContain('<view id="chat-view" name="chat-view">');

        // Header (HTML)
        expect(m).toContain('# Chat History');

        // List (Legacy support removed - falls back to plain text)
        expect(m).toContain('Hello');
        expect(m).toContain('World');
        // Legacy Markdown format NOT expected
        expect(m).not.toContain('## [message]');
        expect(m).not.toContain('1. [Hello]');

        // Operation
        expect(m).toContain('[send_message](tool:send_message)');
        expect(m).toContain('- text: string (required)');

        // View Link
        expect(m).toContain('[Settings](view:settings) - Go to Settings');

        // Verify IndexMap
        // List items are no longer harvested by Transformer (legacy)
        expect(result.indexMap['tool:chat-app.chat-view.send_message']).toBeDefined();
    });

    it('handles nested structures and context correctly', () => {
        const html = `
        <div data-app-id="app1">
            <div view="v1" id="v1">
                <div operation="op1"></div>
            </div>
            <div view="v2" id="v2">
                <div operation="op2"></div>
            </div>
        </div>
        `;

        const el = createMockElement(html);
        const result = transformElement(el);

        expect(result.indexMap['tool:app1.v1.op1']).toBeDefined();
        expect(result.indexMap['tool:app1.v2.op2']).toBeDefined();
        // Should not mix up contexts
        expect(result.indexMap['tool:app1.v1.op2']).toBeUndefined();
    });
});
