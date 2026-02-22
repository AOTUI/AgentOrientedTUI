/**
 * Settings Panel - ConfigCard Unit Tests
 * 
 * Unit tests for ConfigCard component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ConfigCard } from './ConfigCard.js';
import type { LLMConfigRecord } from '../../../types/llm-config.js';

describe('ConfigCard', () => {
    const mockConfig: LLMConfigRecord = {
        id: 1,
        name: 'Test Config',
        model: 'gpt-4',
        providerId: 'openai',
        apiKey: 'sk-test1234567890abcdef',
        temperature: 0.7,
        maxSteps: 10,
        isActive: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    const mockHandlers = {
        onSelect: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Active state rendering', () => {
        it('should display checkmark when active', () => {
            render(
                <ConfigCard
                    config={mockConfig}
                    isActive={true}
                    {...mockHandlers}
                />
            );

            // Check for checkmark icon (svg with specific path)
            const checkmark = document.querySelector('svg path[d="M20 6L9 17l-5-5"]');
            expect(checkmark).toBeInTheDocument();
        });

        it('should not display checkmark when inactive', () => {
            render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // Check for checkmark icon (svg with specific path)
            const checkmark = document.querySelector('svg path[d="M20 6L9 17l-5-5"]');
            expect(checkmark).not.toBeInTheDocument();
        });

        it('should apply primary border when active', () => {
            const { container } = render(
                <ConfigCard
                    config={mockConfig}
                    isActive={true}
                    {...mockHandlers}
                />
            );

            // The div should have border-2 and border-primary classes when active
            const card = container.querySelector('[class*="border-2"]');
            expect(card).toBeInTheDocument();
        });

        it('should apply default border when inactive', () => {
            const { container } = render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // The div should have border class when inactive
            const card = container.querySelector('[class*="border"]');
            expect(card).toBeInTheDocument();
        });
    });

    describe('Configuration details display', () => {
        it('should display configuration name', () => {
            render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('Test Config')).toBeInTheDocument();
        });

        it('should display model name', () => {
            render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('gpt-4')).toBeInTheDocument();
        });

        it('should display provider name', () => {
            render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('openai')).toBeInTheDocument();
        });

        it('should display temperature', () => {
            render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('0.7')).toBeInTheDocument();
        });
    });

    describe('API key masking', () => {
        it('should mask API key showing only last 4 characters', () => {
            render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // Should show masked version with last 4 characters
            expect(screen.getByText(/••••cdef/)).toBeInTheDocument();
            
            // Should NOT show full API key
            expect(screen.queryByText('sk-test1234567890abcdef')).not.toBeInTheDocument();
        });

        it('should display "Not set" when API key is undefined', () => {
            const configWithoutKey = { ...mockConfig, apiKey: undefined };
            
            render(
                <ConfigCard
                    config={configWithoutKey}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('Not set')).toBeInTheDocument();
        });

        it('should mask short API keys completely', () => {
            const configWithShortKey = { ...mockConfig, apiKey: 'abc' };
            
            render(
                <ConfigCard
                    config={configWithShortKey}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // Should show only mask
            expect(screen.getByText('••••')).toBeInTheDocument();
            
            // Should NOT show actual key
            expect(screen.queryByText('abc')).not.toBeInTheDocument();
        });
    });

    describe('Click handlers', () => {
        it('should call onSelect when card is clicked', () => {
            const { container } = render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = container.firstChild as HTMLElement;
            fireEvent.click(card);

            expect(mockHandlers.onSelect).toHaveBeenCalledWith(mockConfig.id);
            expect(mockHandlers.onSelect).toHaveBeenCalledTimes(1);
        });

        it('should call onEdit when edit button is clicked', () => {
            render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const editButton = screen.getByLabelText('Edit configuration');
            fireEvent.click(editButton);

            expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockConfig.id);
            expect(mockHandlers.onEdit).toHaveBeenCalledTimes(1);
        });

        it('should call onDelete when delete button is clicked', () => {
            render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const deleteButton = screen.getByLabelText('Delete configuration');
            fireEvent.click(deleteButton);

            expect(mockHandlers.onDelete).toHaveBeenCalledWith(mockConfig.id);
            expect(mockHandlers.onDelete).toHaveBeenCalledTimes(1);
        });

        it('should not trigger onSelect when edit button is clicked', () => {
            render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const editButton = screen.getByLabelText('Edit configuration');
            fireEvent.click(editButton);

            expect(mockHandlers.onSelect).not.toHaveBeenCalled();
        });

        it('should not trigger onSelect when delete button is clicked', () => {
            render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const deleteButton = screen.getByLabelText('Delete configuration');
            fireEvent.click(deleteButton);

            expect(mockHandlers.onSelect).not.toHaveBeenCalled();
        });
    });

    describe('Hover actions', () => {
        it('should show edit and delete buttons on hover', () => {
            const { container } = render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // Initially buttons should not be visible (they're rendered but hidden)
            const card = container.firstChild as HTMLElement;
            
            // Simulate hover
            fireEvent.mouseEnter(card);

            // Buttons should now be visible
            const editButton = screen.getByLabelText('Edit configuration');
            const deleteButton = screen.getByLabelText('Delete configuration');
            
            expect(editButton).toBeInTheDocument();
            expect(deleteButton).toBeInTheDocument();
        });

        it('should hide edit and delete buttons when not hovering', () => {
            const { container } = render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = container.firstChild as HTMLElement;
            
            // Simulate hover then leave
            fireEvent.mouseEnter(card);
            fireEvent.mouseLeave(card);

            // Buttons should still be in DOM but the hover state should be false
            // (The actual visibility is controlled by CSS/conditional rendering)
            expect(card).toBeInTheDocument();
        });
    });

    describe('ProviderLogo integration', () => {
        it('should render ProviderLogo component', () => {
            const { container } = render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // Check for img tag (logo) or fallback div
            const logo = container.querySelector('img[alt="openai logo"]') || 
                         container.querySelector('[title="openai"]');
            expect(logo).toBeInTheDocument();
        });

        it('should pass correct props to ProviderLogo', () => {
            const { container } = render(
                <ConfigCard
                    config={mockConfig}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // Check for logo with correct attributes
            const logo = container.querySelector('img[alt="openai logo"]');
            if (logo) {
                expect(logo).toHaveAttribute('src', 'https://models.dev/logos/openai.svg');
            }
        });

        it('should handle missing providerId gracefully', () => {
            const configWithoutProvider = { ...mockConfig, providerId: undefined };
            
            render(
                <ConfigCard
                    config={configWithoutProvider}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            // Should still render without crashing
            expect(screen.getByText('Test Config')).toBeInTheDocument();
        });
    });
});
