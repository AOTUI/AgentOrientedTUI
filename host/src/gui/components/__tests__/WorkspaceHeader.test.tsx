import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorkspaceHeader } from '../WorkspaceHeader.js';
import type { Topic } from '../../../types.js';

vi.mock('../Icons', () => ({
    IconMenu: () => <div data-testid="icon-menu" />,
    IconEllipsis: () => <div data-testid="icon-ellipsis" />,
    IconPencil: () => <div data-testid="icon-pencil" />,
    IconDelete: () => <div data-testid="icon-delete" />,
    IconChat: () => <div data-testid="icon-chat" />,
    IconTerminal: () => <div data-testid="icon-terminal" />,
}));

describe('WorkspaceHeader Component', () => {
    const mockTopic: Topic = { id: '1', title: 'Test Topic', createdAt: 0, updatedAt: 0, status: 'hot', summary: 'Test Summary' };

    const defaultProps = {
        activeTopic: mockTopic,
        connected: true,
        sidebarOpen: true,
        setSidebarOpen: vi.fn(),
        viewMode: 'chat' as const,
        setViewMode: vi.fn(),
        onDeleteActiveTopic: vi.fn(),
        onRenameActiveTopic: vi.fn(),
    };

    it('renders topic title', () => {
        render(<WorkspaceHeader {...defaultProps} />);
        expect(screen.getByText('Test Topic')).toBeInTheDocument();
    });

    it('renders System Chat when no active topic', () => {
        render(<WorkspaceHeader {...defaultProps} activeTopic={null} />);
        expect(screen.getByText('System Chat')).toBeInTheDocument();
    });

    it('shows connected dot in green when connected', () => {
        const { container } = render(<WorkspaceHeader {...defaultProps} connected={true} />);
        const dot = container.querySelector('.bg-\\[var\\(--color-success\\)\\]');
        expect(dot).toBeInTheDocument();
    });

    it('shows danger dot when disconnected', () => {
        const { container } = render(<WorkspaceHeader {...defaultProps} connected={false} />);
        const dot = container.querySelector('.bg-\\[var\\(--color-danger\\)\\]');
        expect(dot).toBeInTheDocument();
    });

    it('hamburger is offset right when sidebar is closed', () => {
        const { container } = render(<WorkspaceHeader {...defaultProps} sidebarOpen={false} />);
        const leftIsland = container.querySelector('[data-testid="header-left-island"]');
        expect(leftIsland?.className).toContain('ml-[80px]');
    });

    it('hamburger has no offset when sidebar is open', () => {
        const { container } = render(<WorkspaceHeader {...defaultProps} sidebarOpen={true} />);
        const leftIsland = container.querySelector('[data-testid="header-left-island"]');
        expect(leftIsland?.className).toContain('ml-0');
    });

    it('toggles sidebar on hamburger click', () => {
        render(<WorkspaceHeader {...defaultProps} />);
        fireEvent.click(screen.getByTestId('hamburger-btn'));
        expect(defaultProps.setSidebarOpen).toHaveBeenCalledWith(false);
    });

    it('handles view mode switching to tui', () => {
        render(<WorkspaceHeader {...defaultProps} />);
        fireEvent.click(screen.getByLabelText('TUI view'));
        expect(defaultProps.setViewMode).toHaveBeenCalledWith('tui');
    });

    it('handles view mode switching to chat', () => {
        render(<WorkspaceHeader {...defaultProps} viewMode="tui" />);
        fireEvent.click(screen.getByLabelText('Chat view'));
        expect(defaultProps.setViewMode).toHaveBeenCalledWith('chat');
    });

    it('hides view toggle when no active topic', () => {
        render(<WorkspaceHeader {...defaultProps} activeTopic={null} />);
        expect(screen.queryByLabelText('Chat view')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('TUI view')).not.toBeInTheDocument();
    });
});
