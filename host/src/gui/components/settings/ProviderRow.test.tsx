/**
 * Settings Panel - ProviderRow Unit Tests (V2)
 * 
 * Unit tests for ProviderRow component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProviderRow } from './ProviderRow.js';
import type { ProviderConfig } from './types.js';
import { createMockProvider } from './test-helpers.js';

describe('ProviderRow', () => {
    const mockProviders: ProviderConfig[] = [
        createMockProvider({
            id: 1,
            providerId: 'openai',
            customName: 'My OpenAI',
            isActive: false,
        }),
        createMockProvider({
            id: 2,
            providerId: 'anthropic',
            customName: 'My Anthropic',
            isActive: true,
        }),
        createMockProvider({
            id: 3,
            providerId: 'google',
            customName: 'My Google',
            isActive: false,
        }),
    ];

    const mockHandlers = {
        onSelectProvider: vi.fn(),
        onEditProvider: vi.fn(),
        onDeleteProvider: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Provider rendering', () => {
        it('should render all providers', () => {
            render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('My OpenAI')).toBeInTheDocument();
            expect(screen.getByText('My Anthropic')).toBeInTheDocument();
            expect(screen.getByText('My Google')).toBeInTheDocument();
        });

        it('should render ProviderCard for each provider', () => {
            render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            const cards = screen.getAllByRole('radio');
            expect(cards).toHaveLength(3);
        });

        it('should pass correct props to each ProviderCard', () => {
            render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={1}
                    activeProviderId="anthropic"
                    {...mockHandlers}
                />
            );

            // Check that the selected provider has the correct aria-label
            const selectedCard = screen.getByLabelText(/My OpenAI.*\(selected\)/);
            expect(selectedCard).toBeInTheDocument();

            // Check that the active provider has the correct aria-label
            const activeCard = screen.getByLabelText(/My Anthropic.*\(active\)/);
            expect(activeCard).toBeInTheDocument();
        });

        it('should display empty state when no providers', () => {
            render(
                <ProviderRow
                    providers={[]}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText(/No providers configured/)).toBeInTheDocument();
            expect(screen.getByText(/Click "Add Provider" to get started/)).toBeInTheDocument();
        });

        it('should have role="status" for empty state', () => {
            render(
                <ProviderRow
                    providers={[]}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            const emptyState = screen.getByRole('status');
            expect(emptyState).toBeInTheDocument();
            expect(emptyState).toHaveAttribute('aria-live', 'polite');
        });
    });

    describe('Sorting (active first)', () => {
        it('should display active provider first', () => {
            render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId="anthropic"
                    {...mockHandlers}
                />
            );

            const cards = screen.getAllByRole('radio');
            // First card should be the active one (My Anthropic)
            expect(cards[0]).toHaveAttribute('aria-label', expect.stringContaining('My Anthropic'));
            expect(cards[0]).toHaveAttribute('aria-label', expect.stringContaining('(active)'));
        });

        it('should maintain order when no active provider', () => {
            const providersNoActive = mockProviders.map(p => ({ ...p, isActive: false }));
            
            render(
                <ProviderRow
                    providers={providersNoActive}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            const cards = screen.getAllByRole('radio');
            expect(cards).toHaveLength(3);
            // Order should be preserved from input
        });

        it('should sort correctly with multiple providers', () => {
            const manyProviders: ProviderConfig[] = [
                { ...mockProviders[0], isActive: false },
                { ...mockProviders[1], isActive: false },
                { ...mockProviders[2], isActive: true }, // Google is active
            ];

            render(
                <ProviderRow
                    providers={manyProviders}
                    selectedProviderId={null}
                    activeProviderId="google"
                    {...mockHandlers}
                />
            );

            const cards = screen.getAllByRole('radio');
            // First card should be Google (active)
            expect(cards[0]).toHaveAttribute('aria-label', expect.stringContaining('My Google'));
            expect(cards[0]).toHaveAttribute('aria-label', expect.stringContaining('(active)'));
        });
    });

    describe('Horizontal scrolling', () => {
        it('should have horizontal scroll container', () => {
            const { container } = render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            const scrollContainer = container.querySelector('.provider-row-scroll');
            expect(scrollContainer).toBeInTheDocument();
        });

        it('should apply correct scroll styles', () => {
            const { container } = render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            const scrollContainer = container.querySelector('.provider-row-scroll') as HTMLElement;
            expect(scrollContainer).toHaveStyle({
                display: 'flex',
                overflowX: 'auto',
                overflowY: 'hidden',
                scrollBehavior: 'smooth',
            });
        });

        it('should have gap between provider cards', () => {
            const { container } = render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            const scrollContainer = container.querySelector('.provider-row-scroll') as HTMLElement;
            expect(scrollContainer).toHaveStyle({ gap: 'clamp(12px, 2vw, 16px)' });
        });

        it('should have padding at bottom for scrollbar', () => {
            const { container } = render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            const scrollContainer = container.querySelector('.provider-row-scroll') as HTMLElement;
            expect(scrollContainer).toHaveStyle({ paddingBottom: '8px' });
        });
    });

    describe('Event handlers', () => {
        it('should call onSelectProvider with correct providerId when card is clicked', () => {
            render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            const openaiCard = screen.getByLabelText('My OpenAI provider');
            openaiCard.click();

            expect(mockHandlers.onSelectProvider).toHaveBeenCalledWith(1);
            expect(mockHandlers.onSelectProvider).toHaveBeenCalledTimes(1);
        });

        it('should call onEditProvider with correct provider when edit button is clicked', () => {
            const { container } = render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            // Hover over first card to show edit button
            const firstCard = screen.getAllByRole('radio')[0].closest('.group');
            if (!firstCard) throw new Error('Card container not found');
            
            firstCard.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

            // Click edit button
            const editButton = within(firstCard as HTMLElement).getByLabelText(/Edit.*provider/);
            editButton.click();

            expect(mockHandlers.onEditProvider).toHaveBeenCalledTimes(1);
            // Should be called with the provider object (active one with id 2)
            expect(mockHandlers.onEditProvider).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
        });

        it('should call onDeleteProvider with correct provider when delete button is clicked', () => {
            const { container } = render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            // Hover over first card to show delete button
            const firstCard = screen.getAllByRole('radio')[0].closest('.group');
            if (!firstCard) throw new Error('Card container not found');
            
            firstCard.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));

            // Click delete button
            const deleteButton = within(firstCard as HTMLElement).getByLabelText(/Delete.*provider/);
            deleteButton.click();

            expect(mockHandlers.onDeleteProvider).toHaveBeenCalledTimes(1);
            // Should be called with the provider object (active one with id 2)
            expect(mockHandlers.onDeleteProvider).toHaveBeenCalledWith(expect.objectContaining({ id: 2 }));
        });

        it('should handle multiple provider selections', () => {
            render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            const openaiCard = screen.getByLabelText('My OpenAI provider');
            const googleCard = screen.getByLabelText('My Google provider');

            openaiCard.click();
            googleCard.click();

            expect(mockHandlers.onSelectProvider).toHaveBeenCalledTimes(2);
            expect(mockHandlers.onSelectProvider).toHaveBeenNthCalledWith(1, 1); // ID is 1
            expect(mockHandlers.onSelectProvider).toHaveBeenNthCalledWith(2, 3); // ID is 3
        });
    });

    describe('Accessibility', () => {
        it('should have role="list" on container', () => {
            render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            const list = screen.getByRole('list');
            expect(list).toBeInTheDocument();
        });

        it('should have aria-label on list', () => {
            render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            const list = screen.getByRole('list');
            expect(list).toHaveAttribute('aria-label', 'Provider list');
        });

        it('should have proper list structure with listitems', () => {
            render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            const list = screen.getByRole('list');
            const items = screen.getAllByRole('radio');

            expect(list).toBeInTheDocument();
            expect(items).toHaveLength(3);
        });
    });

    describe('Edge cases', () => {
        it('should handle single provider', () => {
            render(
                <ProviderRow
                    providers={[mockProviders[0]]}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            const cards = screen.getAllByRole('radio');
            expect(cards).toHaveLength(1);
            expect(screen.getByText('My OpenAI')).toBeInTheDocument();
        });

        it('should handle null selectedProviderId', () => {
            render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            // No card should have "selected" in aria-label
            const cards = screen.getAllByRole('radio');
            cards.forEach(card => {
                expect(card).not.toHaveAttribute('aria-label', expect.stringContaining('(selected)'));
            });
        });

        it('should handle null activeProviderId', () => {
            const providersNoActive = mockProviders.map(p => ({ ...p, isActive: false }));
            render(
                <ProviderRow
                    providers={providersNoActive}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                />
            );

            const cards = screen.getAllByRole('radio');
            cards.forEach(card => {
                expect(card).not.toHaveAttribute('aria-label', expect.stringContaining('(active)'));
            });
        });

        it('should handle same provider being both selected and active', () => {
            render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={2}
                    activeProviderId="anthropic"
                    {...mockHandlers}
                />
            );

            const card = screen.getByLabelText(/My Anthropic.*\(active\).*\(selected\)/);
            expect(card).toBeInTheDocument();
            expect(screen.getByText('Active')).toBeInTheDocument();
        });
    });

    describe('Add Provider Button', () => {
        it('should render add provider button when onAddProvider is provided', () => {
            const onAddProvider = vi.fn();
            render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                    onAddProvider={onAddProvider}
                />
            );

            const addButton = screen.getByLabelText('Add new provider');
            expect(addButton).toBeInTheDocument();
            expect(screen.getByText('Add Provider')).toBeInTheDocument();
        });

        it('should have correct dimensions (120px)', () => {
            const onAddProvider = vi.fn();
            render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                    onAddProvider={onAddProvider}
                />
            );

            const addButton = screen.getByLabelText('Add new provider');
            expect(addButton).toHaveClass('w-[120px]');
            expect(addButton).toHaveClass('h-[120px]');
        });

        it('should call onAddProvider when clicked', () => {
            const onAddProvider = vi.fn();
            render(
                <ProviderRow
                    providers={mockProviders}
                    selectedProviderId={null}
                    activeProviderId={null}
                    {...mockHandlers}
                    onAddProvider={onAddProvider}
                />
            );

            const addButton = screen.getByLabelText('Add new provider');
            addButton.click();
            expect(onAddProvider).toHaveBeenCalledTimes(1);
        });
    });
});
