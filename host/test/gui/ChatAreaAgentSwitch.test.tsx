import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatArea } from '../../src/gui/components/ChatArea.js';

describe('ChatArea agent switch', () => {
    it('calls onSelectAgent when clicking an agent option in panel', () => {
        const onSelectAgent = vi.fn();

        render(
            <ChatArea
                messages={[]}
                agentThinking=""
                agentReasoning=""
                onSendMessage={vi.fn()}
                canSendMessage={true}
                sendBlockedReason={null}
                displayAgentState="idle"
                topicCapabilities={null}
                modelGroups={[]}
                selectedModel={null}
                promptTemplates={[]}
                topicPrompt=""
                agents={[
                    { id: 'a1', name: 'Agent One' },
                    { id: 'a2', name: 'Agent Two' },
                ]}
                selectedAgentId={null}
                onSelectAgent={onSelectAgent}
            />
        );

        fireEvent.click(screen.getByLabelText('Agent'));
        fireEvent.click(screen.getByRole('button', { name: 'Agent Two' }));

        expect(onSelectAgent).toHaveBeenCalledWith('a2');
    });
});
