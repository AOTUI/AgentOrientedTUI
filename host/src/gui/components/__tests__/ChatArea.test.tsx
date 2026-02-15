import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatArea } from '../ChatArea.js';
import type { Message } from '../../../types.js';

vi.mock('../Icons', () => ({
    IconNewChat: () => <div data-testid="icon-new-chat" />,
    IconSend: () => <div data-testid="icon-send" />,
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('ChatArea Component', () => {
    const mockMessages: Message[] = [
        { id: '1', role: 'user', content: 'Hello', timestamp: 1000 },
        { id: '2', role: 'assistant', content: 'Hi there', timestamp: 2000 }
    ];

    const defaultProps = {
        messages: mockMessages,
        agentThinking: '',
        onSendMessage: vi.fn()
    };

    it('renders messages', () => {
        render(<ChatArea {...defaultProps} />);
        expect(screen.getByText('Hello')).toBeInTheDocument();
        expect(screen.getByText('Hi there')).toBeInTheDocument();
    });

    it('renders agent thinking', () => {
        render(<ChatArea {...defaultProps} agentThinking="Thinking..." />);
        expect(screen.getByText('Thinking...')).toBeInTheDocument();
    });

    it('handles send message', () => {
        render(<ChatArea {...defaultProps} />);
        const input = screen.getByPlaceholderText('Enter command or message...');
        fireEvent.change(input, { target: { value: 'New Message' } });
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
        expect(defaultProps.onSendMessage).toHaveBeenCalledWith('New Message');
    });

    it('handles empty state', () => {
        render(<ChatArea {...defaultProps} messages={[]} />);
        expect(screen.getByText('System Ready. Awaiting Input.')).toBeInTheDocument();
    });
});
