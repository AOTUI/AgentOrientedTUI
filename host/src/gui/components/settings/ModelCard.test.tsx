/**
 * Settings Panel - ModelCard Unit Tests (V2)
 * 
 * Unit tests for ModelCard component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ModelCard } from './ModelCard.js';
import type { ModelsDevModel } from '../../../services/index.js';

describe('ModelCard', () => {
    const mockModel: ModelsDevModel = {
        id: 'openai/gpt-4',
        name: 'GPT-4',
        family: 'GPT-Family',
        tool_call: true,
        reasoning: true,
        modalities: {
            input: ['text', 'image'],
            output: ['text'],
        },
        cost: {
            input: 0.00003,
            output: 0.00006,
        },
        limit: {
            context: 128000,
            output: 4096,
        },
    };

    const mockHandlers = {
        onSelect: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Model information display', () => {
        it('should display model name', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('GPT-4')).toBeInTheDocument();
        });

        it('should display model family when present', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('GPT-Family')).toBeInTheDocument();
        });

        it('should not display family section when family is undefined', () => {
            const modelWithoutFamily = { ...mockModel, family: undefined };
            render(
                <ModelCard
                    model={modelWithoutFamily}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByText(/Family:/)).not.toBeInTheDocument();
        });

        it('should display model name in aria-label', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('listitem');
            expect(card).toHaveAttribute('aria-label', expect.stringContaining('GPT-4'));
        });
    });

    describe('Capability badges', () => {
        it('should display tool_call badge when model has tool_call capability', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('Tools')).toBeInTheDocument();
        });

        it('should display reasoning badge when model has reasoning capability', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('Reasoning')).toBeInTheDocument();
        });

        it('should display vision badge when model has image input modality', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('Vision')).toBeInTheDocument();
        });

        it('should not display tool_call badge when capability is false', () => {
            const modelWithoutToolCall = { ...mockModel, tool_call: false };
            render(
                <ModelCard
                    model={modelWithoutToolCall}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByText('Tools')).not.toBeInTheDocument();
        });

        it('should not display reasoning badge when capability is false', () => {
            const modelWithoutReasoning = { ...mockModel, reasoning: false };
            render(
                <ModelCard
                    model={modelWithoutReasoning}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByText('Reasoning')).not.toBeInTheDocument();
        });

        it('should not display vision badge when model has no image input', () => {
            const modelWithoutVision = {
                ...mockModel,
                modalities: { input: ['text'], output: ['text'] },
            };
            render(
                <ModelCard
                    model={modelWithoutVision}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByText('Vision')).not.toBeInTheDocument();
        });

        it('should style capability badges correctly', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const toolCallBadge = screen.getByText('Tools');
            expect(toolCallBadge).toHaveClass('bg-[var(--color-bg-surface)]');
            expect(toolCallBadge).toHaveClass('text-[var(--color-text-secondary)]');
        });
    });

    describe('Pricing formatting', () => {
        it('should display input pricing in correct format', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('In:')).toBeInTheDocument();
            expect(screen.getByText('$30.00/1M')).toBeInTheDocument();
        });

        it('should display output pricing in correct format', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('Out:')).toBeInTheDocument();
            expect(screen.getByText('$60.00/1M')).toBeInTheDocument();
        });

        it('should format high cost as per 1K tokens', () => {
            const expensiveModel = {
                ...mockModel,
                cost: { input: 0.003, output: 0.006 },
            };
            render(
                <ModelCard
                    model={expensiveModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('$3.00/1K')).toBeInTheDocument();
            expect(screen.getByText('$6.00/1K')).toBeInTheDocument();
        });
    });

    describe('Edge cases', () => {
        it('should handle zero cost', () => {
            const freeModel = {
                ...mockModel,
                cost: { input: 0, output: 0 },
            };
            render(
                <ModelCard
                    model={freeModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getAllByText('$0.00/1M')).toHaveLength(2);
        });

        it('should handle very long model names', () => {
            const longNameModel = {
                ...mockModel,
                name: 'This is a very long model name that should still display correctly',
            };

            render(
                <ModelCard
                    model={longNameModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('This is a very long model name that should still display correctly')).toBeInTheDocument();
        });

        it('should render minimal model correctly', () => {
            const minimalModel = {
                ...mockModel,
                name: 'Minimal Model',
                family: undefined,
                limit: undefined,
            };

            render(
                <ModelCard
                    model={minimalModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('Minimal Model')).toBeInTheDocument();
            expect(screen.queryByText(/Family:/)).not.toBeInTheDocument();
            expect(screen.getByText('Context:')).toBeInTheDocument();
            expect(screen.getByText(/In:/)).toBeInTheDocument();
        });
    });

    describe('Interaction', () => {
        it('should show Activate button when not active', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const activateButton = screen.getByText('Activate');
            expect(activateButton).toBeInTheDocument();
        });

        it('should call onSelect when Activate button is clicked', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const activateButton = screen.getByText('Activate');
            fireEvent.click(activateButton);
            expect(mockHandlers.onSelect).toHaveBeenCalled();
        });

        it('should not show Activate button when active', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={true}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByText('Activate')).not.toBeInTheDocument();
        });
        
        it('should show Active badge when active', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={true}
                    {...mockHandlers}
                />
            );
            
            const badge = screen.getByText('ACTIVE');
            expect(badge).toBeInTheDocument();
            expect(badge).toHaveClass('bg-[var(--color-success)/15]');
        });

        it('should have hover visibility classes on Activate button', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const activateButton = screen.getByText('Activate');
            expect(activateButton).toHaveClass('opacity-0');
            expect(activateButton).toHaveClass('group-hover:opacity-100');
        });
    });

    describe('Context length formatting', () => {
        it('should format context length in K format', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('Context:')).toBeInTheDocument();
            expect(screen.getByText('128K')).toBeInTheDocument();
        });

        it('should format context length in M format for large values', () => {
            const modelWithLargeContext = {
                ...mockModel,
                limit: { context: 2000000, output: 4096 },
            };
            render(
                <ModelCard
                    model={modelWithLargeContext}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('2M')).toBeInTheDocument();
        });

        it('should display raw number for small context values', () => {
            const modelWithSmallContext = {
                ...mockModel,
                limit: { context: 512, output: 256 },
            };
            render(
                <ModelCard
                    model={modelWithSmallContext}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('512')).toBeInTheDocument();
        });

        it('should display N/A when limit is undefined', () => {
            const modelWithoutLimit = { ...mockModel, limit: undefined };
            render(
                <ModelCard
                    model={modelWithoutLimit}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('Context:')).toBeInTheDocument();
            expect(screen.getByText('N/A')).toBeInTheDocument();
        });

        it('should display N/A when context is undefined', () => {
            const modelWithoutContext = {
                ...mockModel,
                limit: { output: 4096 },
            };
            render(
                <ModelCard
                    model={modelWithoutContext}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('Context:')).toBeInTheDocument();
            expect(screen.getByText('N/A')).toBeInTheDocument();
        });
    });

    describe('Click handler', () => {
        it('should not call onSelect when card container is clicked', () => {
            const { container } = render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = container.firstChild as HTMLElement;
            fireEvent.click(card);

            expect(mockHandlers.onSelect).not.toHaveBeenCalled();
        });
    });

    describe('Selected state styling', () => {
        it('should not apply special border when active', () => {
            const { container } = render(
                <ModelCard
                    model={mockModel}
                    isActive={true}
                    {...mockHandlers}
                />
            );

            // No blue border
            const card = container.querySelector('[class*="border-[var(--color-accent)]"]');
            expect(card).not.toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have role="listitem"', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('listitem');
            expect(card).toBeInTheDocument();
        });

        it('should have descriptive aria-label', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('listitem');
            expect(card).toHaveAttribute('aria-label', 'GPT-4 model');
        });
    });
});
