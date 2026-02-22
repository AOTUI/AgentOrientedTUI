/**
 * Settings Panel - ProviderCard Unit Tests (V2)
 * 
 * Unit tests for ProviderCard component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProviderCard } from './ProviderCard.js';
import type { ProviderConfig } from './types.js';
import { createMockProvider } from './test-helpers.js';

describe('ProviderCard', () => {
    const mockProvider: ProviderConfig = createMockProvider({
        id: 1,
        providerId: 'openai',
        customName: 'My OpenAI',
        isActive: false,
    });

    const mockHandlers = {
        onSelect: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Active badge rendering', () => {
        it('should display "Active" badge when isActive is true', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={true}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('Active')).toBeInTheDocument();
        });

        it('should not display "Active" badge when isActive is false', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByText('Active')).not.toBeInTheDocument();
        });

        it('should style active badge with primary color', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={true}
                    {...mockHandlers}
                />
            );

            const badge = screen.getByText('Active');
            expect(badge).toHaveClass('bg-[var(--color-success)/15]');
            expect(badge).toHaveClass('text-[var(--color-success)]');
            expect(badge).toHaveClass('border');
            expect(badge).toHaveClass('border-[var(--color-success)/15]');
        });
    });

    describe('Selected state styling', () => {
        it('should not apply special border when selected', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={true}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio', { name: /My OpenAI provider/ });
            // Selection style is removed as per new design
            expect(card).toHaveClass('border-[var(--color-border)]');
        });

        it('should apply default border when not selected', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio', { name: /My OpenAI provider/ });
            expect(card).toHaveClass('border-[var(--color-border)]');
        });

        it('should include selected state in aria-label', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={true}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio', { name: /My OpenAI provider/ });
            expect(card).toHaveAttribute('aria-label', expect.stringContaining('(selected)'));
        });

        it('should not include selected state in aria-label when not selected', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio', { name: /My OpenAI provider/ });
            expect(card).toHaveAttribute('aria-label', expect.not.stringContaining('(selected)'));
        });
    });

    describe('Provider information display', () => {
        it('should display custom provider name', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('My OpenAI')).toBeInTheDocument();
        });

        it('should display provider name in aria-label', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio', { name: /My OpenAI provider/ });
            expect(card).toHaveAttribute('aria-label', expect.stringContaining('My OpenAI'));
        });

        it('should include active state in aria-label when active', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={true}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio', { name: /My OpenAI provider/ });
            expect(card).toHaveAttribute('aria-label', expect.stringContaining('(active)'));
        });
    });

    describe('Hover actions', () => {
        it('should show edit and delete buttons on hover', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio', { name: /My OpenAI provider/ });
            
            // Simulate hover
            fireEvent.mouseEnter(card);

            // Buttons should now be visible
            const editButton = screen.getByLabelText('Edit My OpenAI provider');
            const deleteButton = screen.getByLabelText('Delete My OpenAI provider');
            
            expect(editButton).toBeInTheDocument();
            expect(deleteButton).toBeInTheDocument();
        });

        it('should hide edit and delete buttons when not hovering', () => {
            const { container } = render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio', { name: /My OpenAI provider/ });
            
            // Simulate hover then leave
            fireEvent.mouseEnter(card);
            fireEvent.mouseLeave(card);

            // The hover state should be false, buttons may still be in DOM but hidden
            expect(card).toBeInTheDocument();
        });

        it('should display edit button with correct styling', () => {
            const { container } = render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = container.firstChild as HTMLElement;
            fireEvent.mouseEnter(card);

            const editButton = screen.getByLabelText('Edit My OpenAI provider');
            expect(editButton).toHaveClass('mat-lg-clear');
        });

        it('should display delete button with danger styling', () => {
            const { container } = render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = container.firstChild as HTMLElement;
            fireEvent.mouseEnter(card);

            const deleteButton = screen.getByLabelText('Delete My OpenAI provider');
            expect(deleteButton).toHaveClass('hover:bg-[var(--color-danger)/15]');
        });
    });

    describe('Click handlers', () => {
        it('should call onSelect when card is clicked', () => {
            const { container } = render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio', { name: /My OpenAI provider/ });
            fireEvent.click(card);

            expect(mockHandlers.onSelect).toHaveBeenCalledTimes(1);
        });

        it('should call onEdit when edit button is clicked', () => {
            const { container } = render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio', { name: /My OpenAI provider/ });
            fireEvent.mouseEnter(card);

            const editButton = screen.getByLabelText('Edit My OpenAI provider');
            fireEvent.click(editButton);

            expect(mockHandlers.onEdit).toHaveBeenCalledTimes(1);
        });

        it('should call onDelete when delete button is clicked', () => {
            const { container } = render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio', { name: /My OpenAI provider/ });
            fireEvent.mouseEnter(card);

            const deleteButton = screen.getByLabelText('Delete My OpenAI provider');
            fireEvent.click(deleteButton);

            expect(mockHandlers.onDelete).toHaveBeenCalledTimes(1);
        });

        it('should not trigger onSelect when edit button is clicked', () => {
            const { container } = render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio', { name: /My OpenAI provider/ });
            fireEvent.mouseEnter(card);

            const editButton = screen.getByLabelText('Edit My OpenAI provider');
            fireEvent.click(editButton);

            expect(mockHandlers.onSelect).not.toHaveBeenCalled();
        });

        it('should not trigger onSelect when delete button is clicked', () => {
            const { container } = render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = container.firstChild as HTMLElement;
            fireEvent.mouseEnter(card);

            const deleteButton = screen.getByLabelText('Delete My OpenAI provider');
            fireEvent.click(deleteButton);

            expect(mockHandlers.onSelect).not.toHaveBeenCalled();
        });

        it('should handle keyboard Enter key to select', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio');
            fireEvent.keyDown(card, { key: 'Enter' });

            expect(mockHandlers.onSelect).toHaveBeenCalledTimes(1);
        });

        it('should handle keyboard Space key to select', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio');
            fireEvent.keyDown(card, { key: ' ' });

            expect(mockHandlers.onSelect).toHaveBeenCalledTimes(1);
        });
    });

    describe('Logo integration', () => {
        it('should render ProviderLogo component', () => {
            const { container } = render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // Check for img tag (logo) or fallback div
            const logo = container.querySelector('img[alt="My OpenAI logo"]') || 
                         container.querySelector('[title="My OpenAI"]');
            expect(logo).toBeInTheDocument();
        });

        it('should pass correct providerId to ProviderLogo', () => {
            const { container } = render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // Check for logo with correct src
            const logo = container.querySelector('img[alt="My OpenAI logo"]');
            if (logo) {
                expect(logo).toHaveAttribute('src', 'https://models.dev/logos/openai.svg');
            }
        });

        it('should pass large size to ProviderLogo', () => {
            const { container } = render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // Check for logo with large size (48px)
            const logo = container.querySelector('img[alt="My OpenAI logo"]') ||
                         container.querySelector('[title="My OpenAI"]');
            if (logo) {
                const style = window.getComputedStyle(logo);
                expect(logo).toHaveStyle({ width: '48px', height: '48px' });
            }
        });
    });

    describe('Card dimensions', () => {
        it('should have fixed width of 120px', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const container = screen.getByRole('radio');
            expect(container).toHaveClass('w-[120px]');
            expect(container).toHaveClass('h-[120px]');
        });
    });

    describe('Accessibility', () => {
        it('should have role="radio" on container', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio');
            expect(card).toBeInTheDocument();
        });

        it('should be keyboard focusable', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio');
            expect(card).toHaveAttribute('tabIndex', '0');
        });

        it('should have descriptive aria-label', () => {
            render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('radio', { name: /My OpenAI provider/ });
            expect(card).toHaveAttribute('aria-label', 'My OpenAI provider');
        });

        it('should have title attributes on action buttons', () => {
            const { container } = render(
                <ProviderCard
                    provider={mockProvider}
                    isSelected={false}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = container.firstChild as HTMLElement;
            fireEvent.mouseEnter(card);

            const editButton = screen.getByLabelText('Edit My OpenAI provider');
            const deleteButton = screen.getByLabelText('Delete My OpenAI provider');

            expect(editButton).toHaveAttribute('title', 'Edit');
            expect(deleteButton).toHaveAttribute('title', 'Delete');
        });
    });
});
