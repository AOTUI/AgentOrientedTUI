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
        { id: 'recent-1', title: 'Recent 1', createdAt: now - 2 * 24 * 60 * 60 * 1000, updatedAt: now - 2 * 24 * 60 * 60 * 1000, status: 'warm' },
        { id: 'recent-2', title: 'Recent 2', createdAt: now - 3 * 24 * 60 * 60 * 1000, updatedAt: now - 3 * 24 * 60 * 60 * 1000, status: 'warm' },
        { id: 'recent-3', title: 'Recent 3', createdAt: now - 4 * 24 * 60 * 60 * 1000, updatedAt: now - 4 * 24 * 60 * 60 * 1000, status: 'warm' },
        { id: 'recent-4', title: 'Recent 4', createdAt: now - 5 * 24 * 60 * 60 * 1000, updatedAt: now - 5 * 24 * 60 * 60 * 1000, status: 'warm' },
        { id: 'other-1', title: 'Other 1', createdAt: now - 8 * 24 * 60 * 60 * 1000, updatedAt: now - 8 * 24 * 60 * 60 * 1000, status: 'cold' },
        { id: 'other-2', title: 'Other 2', createdAt: now - 9 * 24 * 60 * 60 * 1000, updatedAt: now - 9 * 24 * 60 * 60 * 1000, status: 'cold' },
        { id: 'other-3', title: 'Other 3', createdAt: now - 10 * 24 * 60 * 60 * 1000, updatedAt: now - 10 * 24 * 60 * 60 * 1000, status: 'cold' },
        { id: 'other-4', title: 'Other 4', createdAt: now - 11 * 24 * 60 * 60 * 1000, updatedAt: now - 11 * 24 * 60 * 60 * 1000, status: 'cold' },
        { id: 'other-5', title: 'Other 5', createdAt: now - 12 * 24 * 60 * 60 * 1000, updatedAt: now - 12 * 24 * 60 * 60 * 1000, status: 'cold' },
        { id: 'other-6', title: 'Other 6', createdAt: now - 13 * 24 * 60 * 60 * 1000, updatedAt: now - 13 * 24 * 60 * 60 * 1000, status: 'cold' },
    ];

    const defaultProps = {
        sidebarOpen: true,
        topics: mockTopics,
        activeTopicId: 'current',
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
        expect(screen.getByText('Recent')).toBeInTheDocument();
        expect(screen.getByText('Other')).toBeInTheDocument();
        expect(screen.getByText('Current Topic')).toBeInTheDocument();
    });

    it('handles new chat click', () => {
        render(<Sidebar {...defaultProps} />);
        fireEvent.click(screen.getByText('New'));
        expect(defaultProps.onNewChat).toHaveBeenCalled();
    });

    it('handles topic selection', () => {
        render(<Sidebar {...defaultProps} />);
        fireEvent.click(screen.getByText('Recent 2'));
        expect(defaultProps.onSelectTopic).toHaveBeenCalledWith('recent-2');
    });

    it('shows only first 3 recent/other by default and supports Show n More', () => {
        render(<Sidebar {...defaultProps} />);

        expect(screen.getByText('Recent 1')).toBeInTheDocument();
        expect(screen.getByText('Recent 2')).toBeInTheDocument();
        expect(screen.getByText('Recent 3')).toBeInTheDocument();
        expect(screen.queryByText('Recent 4')).not.toBeInTheDocument();

        expect(screen.getByText('Other 1')).toBeInTheDocument();
        expect(screen.getByText('Other 2')).toBeInTheDocument();
        expect(screen.getByText('Other 3')).toBeInTheDocument();
        expect(screen.queryByText('Other 4')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Show 1 More'));
        expect(screen.getByText('Recent 4')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Show 3 More'));
        expect(screen.getByText('Other 4')).toBeInTheDocument();
        expect(screen.getByText('Other 5')).toBeInTheDocument();
        expect(screen.getByText('Other 6')).toBeInTheDocument();

        const otherList = screen.getByTestId('other-list');
        expect(otherList.className).toContain('max-h-[11rem]');
    });

    it('hides content when closed', () => {
        render(<Sidebar {...defaultProps} sidebarOpen={false} />);
        const aside = screen.getByRole('complementary'); // 'aside' role
        expect(aside).toHaveClass('opacity-0');
    });
});
