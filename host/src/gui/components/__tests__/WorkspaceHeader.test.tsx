import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorkspaceHeader } from '../WorkspaceHeader.js';
import type { Topic } from '../../../types.js';

vi.mock('../Icons', () => ({
    IconMenu: () => <div data-testid="icon-menu" />,
    IconPlay: () => <div data-testid="icon-play" />,
    IconPause: () => <div data-testid="icon-pause" />,
    IconDelete: () => <div data-testid="icon-delete" />,
}));

describe('WorkspaceHeader Component', () => {
    const mockTopic: Topic = { id: '1', title: 'Test Topic', createdAt: 0, updatedAt: 0, status: 'hot', summary: 'Test Summary' };
    
    const defaultProps = {
        activeTopic: mockTopic,
        activeTopicId: '1',
        connected: true,
        sidebarOpen: true,
        setSidebarOpen: vi.fn(),
        viewMode: 'chat' as const,
        setViewMode: vi.fn(),
        agentState: 'IDLE',
        agentPaused: false,
        onResumeAgent: vi.fn(),
        onPauseAgent: vi.fn(),
        onShowDeleteConfirm: vi.fn()
    };

    it('renders topic title and status', () => {
        render(<WorkspaceHeader {...defaultProps} />);
        expect(screen.getByText('Test Topic')).toBeInTheDocument();
        expect(screen.getByText(/LINKED: 1/)).toBeInTheDocument();
        expect(screen.getByText('Test Summary')).toBeInTheDocument();
    });

    it('handles view mode switching', () => {
        render(<WorkspaceHeader {...defaultProps} />);
        fireEvent.click(screen.getByText('TUI VIEW'));
        expect(defaultProps.setViewMode).toHaveBeenCalledWith('tui');
    });

    it('shows pause button when agent is running', () => {
        render(<WorkspaceHeader {...defaultProps} agentState="EXECUTING" />);
        expect(screen.getByTestId('icon-pause')).toBeInTheDocument();
    });

    it('shows play button when agent is paused', () => {
        render(<WorkspaceHeader {...defaultProps} agentPaused={true} />);
        expect(screen.getByTestId('icon-play')).toBeInTheDocument();
    });

    it('handles delete topic', () => {
        render(<WorkspaceHeader {...defaultProps} />);
        fireEvent.click(screen.getByTestId('icon-delete').parentElement!);
        expect(defaultProps.onShowDeleteConfirm).toHaveBeenCalled();
    });
});
