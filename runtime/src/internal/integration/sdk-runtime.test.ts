/**
 * SDK → Runtime Integration Tests
 * 
 * Tests the complete flow:
 * SDK Components → HTML Output → Runtime Transformer → TUI Markdown
 * 
 * This validates that SDK components produce HTML that the Runtime
 * correctly interprets and transforms.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { parseHTML } from 'linkedom';
import { Transformer } from '../../engine/view/transformer/index.js';

describe('SDK → Runtime Integration', () => {
    let window: any;
    let document: any;
    let transformer: Transformer;

    beforeEach(() => {
        const parsed = parseHTML('<!DOCTYPE html><html><body></body></html>');
        window = parsed.window;
        document = parsed.document;
        transformer = new Transformer();
    });

    describe('ViewLink Component Integration', () => {
        it('SDK ViewLink HTML → Runtime produces correct view link with description', () => {
            // Simulated SDK ViewLink output (id is required by SDK contract)
            document.body.innerHTML = `
                <div id="view_0" view="Conversations">
                    <h2>Conversations</h2>
                    <a view-target="Chat_Alice" desc="Chat with Alice">Alice's Conversation</a>
                    <a view-target="Chat_Bob" desc="Chat with Bob">Bob's Conversation</a>
                </div>
            `;

            const { markup } = transformer.transform(window.document);

            // View should use the provided id attribute
            expect(markup).toContain('<view id="view_0" name="Conversations">');

            // ViewLinks should be converted to markdown links
            expect(markup).toContain("[Alice's Conversation](view:Chat_Alice)");
            expect(markup).toContain('- Description: Chat with Alice');

            expect(markup).toContain("[Bob's Conversation](view:Chat_Bob)");
            expect(markup).toContain('- Description: Chat with Bob');
        });

        it('SDK ViewLink without desc → Runtime produces link without description', () => {
            document.body.innerHTML = `
                <div id="view_0" view="Navigation">
                    <a view-target="Settings">Settings</a>
                </div>
            `;

            const { markup } = transformer.transform(window.document);

            expect(markup).toContain('[Settings](view:Settings)');
            expect(markup).not.toContain('Description:');
        });
    });

    describe('Operation Component Integration', () => {
        it('SDK Operation with desc → Runtime produces multi-line format', () => {
            // Simulated SDK Operation output
            document.body.innerHTML = `
                <div id="view_0" view="ChatView">
                    <button operation="send_message" desc="Send a message in this conversation">
                        Send Message
                        <param name="content" type="string" required="true" />
                    </button>
                </div>
            `;

            const { markup } = transformer.transform(window.document);

            // Operation should have desc and multi-line params
            expect(markup).toContain('[Send Message](tool:send_message)');
            expect(markup).toContain('- Desc: Send a message in this conversation');
            expect(markup).toContain('- Parameters:');
            expect(markup).toContain('- content: string (required)');
        });

        it('SDK Operation with multiple params → Runtime lists all params', () => {
            document.body.innerHTML = `
                <div id="view_0" view="FormView">
                    <button operation="submit_form" desc="Submit the contact form">
                        Submit
                        <param name="name" type="string" required="true" />
                        <param name="email" type="string" required="true" />
                        <param name="message" type="string" />
                    </button>
                </div>
            `;

            const { markup } = transformer.transform(window.document);

            expect(markup).toContain('- Desc: Submit the contact form');
            expect(markup).toContain('- name: string (required)');
            expect(markup).toContain('- email: string (required)');
            expect(markup).toContain('- message: string');
            expect(markup).not.toContain('message: string (required)');
        });
    });

    describe('Complete View with Mixed Components', () => {
        it('Full SDK view output → Runtime produces complete TUI markdown', () => {
            // Simulated complete SDK view output (like RootView.tsx)
            document.body.innerHTML = `
                <div id="view_0" view="Conversations">
                    <h2>Conversations</h2>
                    <p>
                        Welcome to <strong>AOTUI Chat</strong>.
                        Select a conversation below or create a new one.
                    </p>
                    
                    <blockquote>
                        Tip: Use <code>create_conversation</code> to start a new chat.
                    </blockquote>
                    
                    <hr />
                    
                    <h3>Available Views</h3>
                    <a view-target="Conversation_Alice" desc="Chat with Alice">
                        Alice's Conversation
                    </a>
                    <a view-target="Conversation_Bob" desc="Chat with Bob">
                        Bob's Conversation
                    </a>
                    
                    <h4>Operations</h4>
                    <button operation="create_conversation" desc="Start a new conversation with a contact">
                        Create Conversation
                        <param name="contact_id" type="string" required="true" />
                        <param name="contact_name" type="string" />
                    </button>
                    <button operation="list_conversations" desc="Show all active conversations">
                        List All Conversations
                    </button>
                </div>
            `;

            const { markup } = transformer.transform(window.document);

            // Structure checks - SDK provides id, Transformer uses it
            expect(markup).toContain('<view id="view_0" name="Conversations">');

            // HTML5 elements converted to Markdown
            expect(markup).toContain('## Conversations');
            expect(markup).toContain('**AOTUI Chat**');
            expect(markup).toContain('> ');  // blockquote
            expect(markup).toContain('`create_conversation`');  // inline code
            expect(markup).toContain('---');  // hr
            expect(markup).toContain('### Available Views');
            expect(markup).toContain('#### Operations');

            // ViewLinks
            expect(markup).toContain("[Alice's Conversation](view:Conversation_Alice)");
            expect(markup).toContain('- Description: Chat with Alice');

            // Operations
            expect(markup).toContain('[Create Conversation](tool:create_conversation)');
            expect(markup).toContain('- Desc: Start a new conversation with a contact');
            expect(markup).toContain('- Parameters:');
            expect(markup).toContain('- contact_id: string (required)');
            expect(markup).toContain('- contact_name: string');
        });

        it('Conversation view with List → Runtime produces indexed items', () => {
            // Simulated ConversationView output
            document.body.innerHTML = `
                <div id="view_0" view="Chat with Alice">
                    <h2>Chat with Alice</h2>
                    
                    <a view-target="Conversations" desc="Return to conversation list">
                        ← Back to Conversations
                    </a>
                    
                    <h3>Message History</h3>
                    <ul list="messages_alice" item-type="message">
                        <li data-value='{"id":"msg_1","role":"human","content":"Hello!"}'>
                            [human] Hello!
                        </li>
                        <li data-value='{"id":"msg_2","role":"agent","content":"Hi there!"}'>
                            [agent] Hi there!
                        </li>
                    </ul>
                    
                    <button operation="send_message" desc="Send a message in this conversation">
                        Send Message
                        <param name="content" type="string" required="true" />
                    </button>
                </div>
            `;

            const { markup, indexMap } = transformer.transform(window.document);

            // View structure - SDK provides id, Transformer uses it
            expect(markup).toContain('<view id="view_0" name="Chat with Alice">');

            // ViewLink
            expect(markup).toContain('[← Back to Conversations](view:Conversations)');
            expect(markup).toContain('- Description: Return to conversation list');

            // List (Legacy support removed - content handled as plain text)
            // Transformer no longer creates special Markdown or IndexMap entries for <ul list="...">
            expect(markup).toContain('[human] Hello!');
            expect(markup).toContain('[agent] Hi there!');

            // Legacy format check (should NOT be present)
            expect(markup).not.toContain('## [message]');

            // Operation
            expect(markup).toContain('[Send Message](tool:send_message)');
            expect(markup).toContain('- Desc: Send a message in this conversation');
        });
    });

    describe('Edge Cases', () => {
        it('Empty view-target should not create link', () => {
            document.body.innerHTML = `
                <div id="view_0" view="Test">
                    <a view-target="">Empty Target</a>
                </div>
            `;

            const { markup } = transformer.transform(window.document);

            // Empty view-target should be handled gracefully
            // The text should still appear but not as a view link
            expect(markup).toContain('Test');
        });

        it('Operation without desc should not include Desc line', () => {
            document.body.innerHTML = `
                <button operation="simple_action">Do Something</button>
            `;

            const { markup } = transformer.transform(window.document);

            expect(markup).toContain('[Do Something](tool:simple_action)');
            expect(markup).not.toContain('Desc:');
        });

        it('ViewLink and regular anchor coexist correctly', () => {
            document.body.innerHTML = `
                <div id="view_0" view="Mixed">
                    <a view-target="Internal" desc="Go to internal view">Internal Link</a>
                    <a href="https://example.com">External Link</a>
                </div>
            `;

            const { markup } = transformer.transform(window.document);

            // ViewLink should be converted
            expect(markup).toContain('[Internal Link](view:Internal)');
            expect(markup).toContain('- Description: Go to internal view');

            // Regular anchor should also be converted
            expect(markup).toContain('[External Link](https://example.com)');
        });
    });
});
