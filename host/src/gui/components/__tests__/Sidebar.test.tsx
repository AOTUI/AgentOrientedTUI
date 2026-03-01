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
    IconChat: () => <div data-testid="icon-chat" />,
}));

describe('Sidebar Component', () => {
    const now = Date.now();

    const mockTopics: Topic[] = [
        { id: 'current', title: 'Current Topic', createdAt: now - 1000, updatedAt: now, status: 'hot' },
        { id: 'active-1', title: 'Active 1', createdAt: now - 5_000, updatedAt: now - 5_000, status: 'warm' },
        { id: 'active-2', title: 'Active 2', createdAt: now - 6_000, updatedAt: now - 6_000, status: 'warm' },
        { id: 'recent-1', title: 'Recent 1', createdAt: now - 1 * 24 * 60 * 60 * 1000, updatedAt: now - 1 * 24 * 60 * 60 * 1000, status: 'warm' },
        { id: 'recent-2', title: 'Recent 2', createdAt: now - 2 * 24 * 60 * 60 * 1000, updatedAt: now - 2 * 24 * 60 * 60 * 1000, status: 'warm' },
        { id: 'recent-3', title: 'Recent 3', createdAt: now - 2.5 * 24 * 60 * 60 * 1000, updatedAt: now - 2.5 * 24 * 60 * 60 * 1000, status: 'warm' },
        { id: 'recent-4', title: 'Recent 4', createdAt: now - 2.7 * 24 * 60 * 60 * 1000, updatedAt: now - 2.7 * 24 * 60 * 60 * 1000, status: 'warm' },
        { id: 'recent-5', title: 'Recent 5', createdAt: now - 2.8 * 24 * 60 * 60 * 1000, updatedAt: now - 2.8 * 24 * 60 * 60 * 1000, status: 'warm' },
        { id: 'recent-6', title: 'Recent 6', createdAt: now - 2.9 * 24 * 60 * 60 * 1000, updatedAt: now - 2.9 * 24 * 60 * 60 * 1000, status: 'warm' },
        { id: 'history-1', title: 'History 1', createdAt: now - 8 * 24 * 60 * 60 * 1000, updatedAt: now - 8 * 24 * 60 * 60 * 1000, status: 'cold' },
        { id: 'history-2', title: 'History 2', createdAt: now - 9 * 24 * 60 * 60 * 1000, updatedAt: now - 9 * 24 * 60 * 60 * 1000, status: 'cold' },
        { id: 'history-3', title: 'History 3', createdAt: now - 10 * 24 * 60 * 60 * 1000, updatedAt: now - 10 * 24 * 60 * 60 * 1000, status: 'cold' },
        { id: 'history-4', title: 'History 4', createdAt: now - 11 * 24 * 60 * 60 * 1000, updatedAt: now - 11 * 24 * 60 * 60 * 1000, status: 'cold' },
        { id: 'history-5', title: 'History 5', createdAt: now - 12 * 24 * 60 * 60 * 1000, updatedAt: now - 12 * 24 * 60 * 60 * 1000, status: 'cold' },
        { id: 'history-6', title: 'History 6', createdAt: now - 13 * 24 * 60 * 60 * 1000, updatedAt: now - 13 * 24 * 60 * 60 * 1000, status: 'cold' },
    ];

    const defaultProps = {
        sidebarOpen: true,
        topics: mockTopics,
        activeTopicId: 'current',
        activeTopicIds: ['active-1', 'active-2'],
        theme: 'dark' as const,
        onNewChat: vi.fn(),
        onSelectTopic: vi.fn(),
        toggleTheme: vi.fn(),
        onSwitchProject: vi.fn(),
        getTopicState: vi.fn(() => 'IDLE'),
        getTopicPaused: vi.fn(() => false)
    };

    it('renders correctly when open', () => {
        render(<Sidebar {...defaultProps} />);
        expect(screen.getByText('Sessions')).toBeInTheDocument();
        expect(screen.getAllByText('Current').length).toBeGreaterThan(0);
        expect(screen.getByText('Active')).toBeInTheDocument();
        expect(screen.getByText('Recent')).toBeInTheDocument();
        expect(screen.getByText('History')).toBeInTheDocument();
        expect(screen.getByText('Current Topic')).toBeInTheDocument();
    });

    it('handles new chat click', () => {
        render(<Sidebar {...defaultProps} />);
        fireEvent.click(screen.getByText('New Session'));
        expect(defaultProps.onNewChat).toHaveBeenCalled();
    });

    it('handles topic selection', () => {
        render(<Sidebar {...defaultProps} />);
        fireEvent.click(screen.getByText('Recent 2'));
        expect(defaultProps.onSelectTopic).toHaveBeenCalledWith('recent-2');
    });

    it('shows recent default 3 and history default hidden, supports show more and collapse', () => {
        render(<Sidebar {...defaultProps} />);

        expect(screen.getByText('Active 1')).toBeInTheDocument();
        expect(screen.getByText('Active 2')).toBeInTheDocument();

        expect(screen.getByText('Recent 1')).toBeInTheDocument();
        expect(screen.getByText('Recent 2')).toBeInTheDocument();
        expect(screen.getByText('Recent 3')).toBeInTheDocument();
        expect(screen.queryByText('Recent 4')).not.toBeInTheDocument();

        expect(screen.queryByText('History 1')).not.toBeInTheDocument();
        expect(screen.queryByText('History 2')).not.toBeInTheDocument();

        const showMoreButtons = screen.getAllByText('Show More');
        fireEvent.click(showMoreButtons[0]);
        expect(screen.getByText('Recent 4')).toBeInTheDocument();
        expect(screen.getByText('Recent 5')).toBeInTheDocument();
        expect(screen.getByText('Recent 6')).toBeInTheDocument();
        expect(screen.getByText('Collapse')).toBeInTheDocument();

        fireEvent.click(showMoreButtons[1]);
        expect(screen.getByText('History 1')).toBeInTheDocument();
        expect(screen.getByText('History 5')).toBeInTheDocument();
        expect(screen.getByText('History 6')).toBeInTheDocument();

        const historyList = screen.getByTestId('history-list');
        expect(historyList.className).toContain('max-h-[11rem]');
    });

    it('filters grouped sessions by search input', () => {
        render(<Sidebar {...defaultProps} />);
        fireEvent.change(screen.getByPlaceholderText('Search sessions...'), { target: { value: 'history 6' } });

        expect(screen.getByText('History 6')).toBeInTheDocument();
        expect(screen.queryByText('History 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Recent 1')).not.toBeInTheDocument();
        expect(screen.queryByText('Active 1')).not.toBeInTheDocument();
    });

    it('uses 5-day boundary for Recent vs History groups', () => {
        const boundaryTopics: Topic[] = [
            { id: 'current', title: 'Current Topic', createdAt: now - 1000, updatedAt: now, status: 'hot' },
            { id: 'recent-4d', title: 'Recent 4d', createdAt: now - 4 * 24 * 60 * 60 * 1000, updatedAt: now - 4 * 24 * 60 * 60 * 1000, status: 'warm' },
            { id: 'history-6d', title: 'History 6d', createdAt: now - 6 * 24 * 60 * 60 * 1000, updatedAt: now - 6 * 24 * 60 * 60 * 1000, status: 'cold' },
        ];

        render(<Sidebar {...defaultProps} topics={boundaryTopics} activeTopicIds={[]} />);

        expect(screen.getByText('Recent 4d')).toBeInTheDocument();
        expect(screen.queryByText('History 6d')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Show More'));
        expect(screen.getByText('History 6d')).toBeInTheDocument();
    });

    it('hides content when closed', () => {
        render(<Sidebar {...defaultProps} sidebarOpen={false} />);
        const aside = screen.getByRole('complementary'); // 'aside' role
        expect(aside).toHaveClass('opacity-0');
    });
});
