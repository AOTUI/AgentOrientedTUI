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
        family: 'GPT-4',
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

            expect(screen.getByText(/Family: GPT-4/)).toBeInTheDocument();
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

            expect(screen.getByText('• Tool Call')).toBeInTheDocument();
        });

        it('should display reasoning badge when model has reasoning capability', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('• Reasoning')).toBeInTheDocument();
        });

        it('should display vision badge when model has image input modality', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('• Vision')).toBeInTheDocument();
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

            expect(screen.queryByText('• Tool Call')).not.toBeInTheDocument();
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

            expect(screen.queryByText('• Reasoning')).not.toBeInTheDocument();
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

            expect(screen.queryByText('• Vision')).not.toBeInTheDocument();
        });

        it('should not display capability section when no capabilities are present', () => {
            const modelWithoutCapabilities = {
                ...mockModel,
                tool_call: false,
                reasoning: false,
                modalities: { input: ['text'], output: ['text'] },
            };
            const { container } = render(
                <ModelCard
                    model={modelWithoutCapabilities}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByText('• Tool Call')).not.toBeInTheDocument();
            expect(screen.queryByText('• Reasoning')).not.toBeInTheDocument();
            expect(screen.queryByText('• Vision')).not.toBeInTheDocument();
        });

        it('should style capability badges correctly', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const toolCallBadge = screen.getByText('• Tool Call');
            expect(toolCallBadge).toHaveClass('bg-[var(--color-bg-elevated)]');
            expect(toolCallBadge).toHaveClass('text-[var(--color-text-primary)]');
            expect(toolCallBadge).toHaveClass('border-[var(--color-border)]');
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

            expect(screen.getByText(/Input: \$30\.00\/1M/)).toBeInTheDocument();
        });

        it('should display output pricing in correct format', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText(/Output: \$60\.00\/1M/)).toBeInTheDocument();
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

            expect(screen.getByText(/Input: \$3\.00\/1K/)).toBeInTheDocument();
            expect(screen.getByText(/Output: \$6\.00\/1K/)).toBeInTheDocument();
        });

        it('should display N/A when input cost is undefined', () => {
            const modelWithoutInputCost = {
                ...mockModel,
                cost: { output: 0.00006 },
            };
            render(
                <ModelCard
                    model={modelWithoutInputCost}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByText(/Input:/)).not.toBeInTheDocument();
        });

        it('should display N/A when output cost is undefined', () => {
            const modelWithoutOutputCost = {
                ...mockModel,
                cost: { input: 0.00003 },
            };
            render(
                <ModelCard
                    model={modelWithoutOutputCost}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByText(/Output:/)).not.toBeInTheDocument();
        });

        it('should not display pricing section when cost is undefined', () => {
            const modelWithoutCost = { ...mockModel, cost: undefined };
            render(
                <ModelCard
                    model={modelWithoutCost}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByText(/Input:/)).not.toBeInTheDocument();
            expect(screen.queryByText(/Output:/)).not.toBeInTheDocument();
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

            expect(screen.getByText(/Context: 128K tokens/)).toBeInTheDocument();
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

            expect(screen.getByText(/Context: 2M tokens/)).toBeInTheDocument();
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

            expect(screen.getByText(/Context: 512 tokens/)).toBeInTheDocument();
        });

        it('should not display context when limit is undefined', () => {
            const modelWithoutLimit = { ...mockModel, limit: undefined };
            render(
                <ModelCard
                    model={modelWithoutLimit}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByText(/Context:/)).not.toBeInTheDocument();
        });

        it('should not display context when context is undefined', () => {
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

            expect(screen.queryByText(/Context:/)).not.toBeInTheDocument();
        });
    });

    describe('Active badge', () => {
        it('should display "Active" badge when isActive is true', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={true}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('Active')).toBeInTheDocument();
        });

        it('should not display "Active" badge when isActive is false', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.queryByText('Active')).not.toBeInTheDocument();
        });

        it('should style active badge with primary color', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={true}
                    {...mockHandlers}
                />
            );

            const badge = screen.getByText('Active');
            expect(badge).toHaveClass('bg-[var(--color-primary)]');
            expect(badge).toHaveClass('text-white');
        });

        it('should include active state in aria-label', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={true}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('listitem');
            expect(card).toHaveAttribute('aria-label', expect.stringContaining('(active)'));
        });

        it('should not include active state in aria-label when not active', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('listitem');
            expect(card).toHaveAttribute('aria-label', expect.not.stringContaining('(active)'));
        });
    });

    describe('Click handler', () => {
        it('should call onSelect when card is clicked', () => {
            const { container } = render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = container.firstChild as HTMLElement;
            fireEvent.click(card);

            expect(mockHandlers.onSelect).toHaveBeenCalledTimes(1);
        });

        it('should handle keyboard Enter key to select', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('listitem');
            fireEvent.keyDown(card, { key: 'Enter' });

            expect(mockHandlers.onSelect).toHaveBeenCalledTimes(1);
        });

        it('should handle keyboard Space key to select', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('listitem');
            fireEvent.keyDown(card, { key: ' ' });

            expect(mockHandlers.onSelect).toHaveBeenCalledTimes(1);
        });

        it('should not call onSelect for other keyboard keys', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('listitem');
            fireEvent.keyDown(card, { key: 'Tab' });

            expect(mockHandlers.onSelect).not.toHaveBeenCalled();
        });
    });

    describe('Selected state styling', () => {
        it('should apply primary border when active', () => {
            const { container } = render(
                <ModelCard
                    model={mockModel}
                    isActive={true}
                    {...mockHandlers}
                />
            );

            const card = container.querySelector('[class*="border-2"]');
            expect(card).toBeInTheDocument();
            expect(card?.className).toContain('border-[var(--color-primary)]');
        });

        it('should apply default border when not active', () => {
            const { container } = render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = container.querySelector('[class*="border-[var(--color-border)]"]');
            expect(card).toBeInTheDocument();
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

        it('should be keyboard focusable', () => {
            render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = screen.getByRole('listitem');
            expect(card).toHaveAttribute('tabIndex', '0');
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

        it('should have cursor-pointer class for visual feedback', () => {
            const { container } = render(
                <ModelCard
                    model={mockModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            const card = container.firstChild as HTMLElement;
            expect(card.className).toContain('cursor-pointer');
        });
    });

    describe('Edge cases', () => {
        it('should handle model with minimal data', () => {
            const minimalModel: ModelsDevModel = {
                id: 'test/minimal',
                name: 'Minimal Model',
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
            expect(screen.queryByText(/Context:/)).not.toBeInTheDocument();
            expect(screen.queryByText(/Input:/)).not.toBeInTheDocument();
        });

        it('should handle model with all capabilities', () => {
            const fullModel: ModelsDevModel = {
                ...mockModel,
                tool_call: true,
                reasoning: true,
                modalities: { input: ['text', 'image'], output: ['text'] },
            };

            render(
                <ModelCard
                    model={fullModel}
                    isActive={false}
                    {...mockHandlers}
                />
            );

            expect(screen.getByText('• Tool Call')).toBeInTheDocument();
            expect(screen.getByText('• Reasoning')).toBeInTheDocument();
            expect(screen.getByText('• Vision')).toBeInTheDocument();
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

            expect(screen.getByText(/Input: \$0\.00\/1M/)).toBeInTheDocument();
            expect(screen.getByText(/Output: \$0\.00\/1M/)).toBeInTheDocument();
        });
    });
});
