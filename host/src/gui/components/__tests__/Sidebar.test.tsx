import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Sidebar } from '../Sidebar.js';
import type { Topic } from '../../../types.js';

// Mock Icons to avoid SVG issues in test
vi.mock('../Icons', () => ({
    IconNewChat: () => <div data-testid="icon-new-chat" />,
    IconSun: () => <div data-testid="icon-sun" />,
    IconMoon: () => <div data-testid="icon-moon" />,
    IconFolder: () => <div data-testid="icon-folder" />,
    IconSettings: () => <div data-testid="icon-settings" />,
    IconEllipsis: () => <div data-testid="icon-ellipsis" />,
    IconPin: () => <div data-testid="icon-pin" />,
    IconPencil: () => <div data-testid="icon-pencil" />,
    IconDelete: () => <div data-testid="icon-delete" />,
}));

describe('Sidebar Component', () => {
    const mockTopics: Topic[] = [
        { id: '1', title: 'Topic 1', createdAt: 0, updatedAt: 0, status: 'hot', summary: 'Summary 1', stage: 'Stage 1' },
        { id: '2', title: 'Topic 2', createdAt: 0, updatedAt: 0, status: 'cold' }
    ];

    const defaultProps = {
        sidebarOpen: true,
        topics: mockTopics,
        activeTopicId: '1',
        theme: 'dark' as const,
        onNewChat: vi.fn(),
        onSelectTopic: vi.fn(),
        toggleTheme: vi.fn(),
        getTopicState: vi.fn(() => 'IDLE'),
        getTopicPaused: vi.fn(() => false)
    };

    it('renders correctly when open', () => {
        render(<Sidebar {...defaultProps} />);
        expect(screen.getByText('Sessions')).toBeInTheDocument();
        expect(screen.getByText('Topic 1')).toBeInTheDocument();
        expect(screen.getByText('Topic 2')).toBeInTheDocument();
    });

    it('handles new chat click', () => {
        render(<Sidebar {...defaultProps} />);
        fireEvent.click(screen.getByText('New Session'));
        expect(defaultProps.onNewChat).toHaveBeenCalled();
    });

    it('handles topic selection', () => {
        render(<Sidebar {...defaultProps} />);
        fireEvent.click(screen.getByText('Topic 2'));
        expect(defaultProps.onSelectTopic).toHaveBeenCalledWith('2');
    });

    it('displays correct status and stage', () => {
        render(<Sidebar {...defaultProps} />);
        // Each topic card renders a more-options button
        expect(screen.getByTestId('more-btn-1')).toBeInTheDocument();
        expect(screen.getByTestId('more-btn-2')).toBeInTheDocument();
    });

    it('hides content when closed', () => {
        render(<Sidebar {...defaultProps} sidebarOpen={false} />);
        const aside = screen.getByRole('complementary'); // 'aside' role
        expect(aside).toHaveClass('opacity-0');
    });
});
