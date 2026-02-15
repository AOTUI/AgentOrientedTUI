/**
 * Settings Panel - ModelTabHeader Unit Tests (V2)
 * 
 * Unit tests for ModelTabHeader component
 * 
 * Requirements: 2.1, 2.2, 2.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModelTabHeader } from '../../../src/gui/components/settings/ModelTabHeader.js';

describe('ModelTabHeader', () => {
    const mockHandlers = {
        onSearchChange: vi.fn(),
        onAddProvider: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Title rendering', () => {
        it('should render "Model Configuration" title', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const title = screen.getByText('Model Configuration');
            expect(title).toBeDefined();
        });

        it('should render title as h2 heading', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const title = screen.getByRole('heading', { level: 2 });
            expect(title.textContent).toBe('Model Configuration');
        });

        it('should have correct title styling', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const title = screen.getByText('Model Configuration');
            expect(title.className).toContain('text-2xl');
            expect(title.className).toContain('font-medium');
            expect(title.className).toContain('tracking-tight');
        });
    });

    describe('Search bar integration', () => {
        it('should render ProviderSearchBar component', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const searchInput = screen.getByPlaceholderText('Search providers...');
            expect(searchInput).toBeDefined();
        });

        it('should pass searchQuery prop to ProviderSearchBar', () => {
            render(
                <ModelTabHeader
                    searchQuery="openai"
                    {...mockHandlers}
                />
            );

            const searchInput = screen.getByDisplayValue('openai');
            expect(searchInput).toBeDefined();
        });

        it('should pass onSearchChange handler to ProviderSearchBar', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const searchInput = screen.getByRole('textbox');
            expect(searchInput).toBeDefined();
            
            // The actual debounced call is tested in SearchBars.test.tsx
            // Here we just verify the component is rendered with the handler
        });

        it('should render search bar on the left side', () => {
            const { container } = render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            // Search bar should be in a flex-1 container (takes available space on left)
            const searchContainer = container.querySelector('.flex-1');
            expect(searchContainer).toBeDefined();
            
            const searchInput = searchContainer?.querySelector('input');
            expect(searchInput).toBeDefined();
        });
    });

    describe('Add Provider button', () => {
        it('should render "Add Provider" button', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const button = screen.getByText('Add Provider');
            expect(button).toBeDefined();
        });

        it('should render button with plus icon', () => {
            const { container } = render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const button = screen.getByText('Add Provider').closest('button');
            const icon = button?.querySelector('svg');
            expect(icon).toBeDefined();
        });

        it('should have correct button styling', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const button = screen.getByText('Add Provider').closest('button');
            expect(button?.className).toContain('bg-[var(--color-primary)]');
            expect(button?.className).toContain('text-white');
            expect(button?.className).toContain('font-medium');
            expect(button?.className).toContain('rounded-lg');
        });

        it('should have aria-label for accessibility', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const button = screen.getByLabelText('Add new provider');
            expect(button).toBeDefined();
        });

        it('should call onAddProvider when clicked', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const button = screen.getByText('Add Provider').closest('button');
            fireEvent.click(button!);

            expect(mockHandlers.onAddProvider).toHaveBeenCalledTimes(1);
        });

        it('should not wrap button text', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const button = screen.getByText('Add Provider').closest('button');
            expect(button?.className).toContain('whitespace-nowrap');
        });

        it('should position button on the right side', () => {
            const { container } = render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            // Button should be after the flex-1 search container
            const flexContainer = container.querySelector('.flex.items-center.gap-4');
            const children = flexContainer?.children;
            
            expect(children?.length).toBe(2);
            // First child is search (flex-1), second is button
            expect(children?.[0].className).toContain('flex-1');
            expect(children?.[1].tagName).toBe('BUTTON');
        });
    });

    describe('Layout', () => {
        it('should render title above search/button row', () => {
            const { container } = render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const rootDiv = container.firstChild as HTMLElement;
            expect(rootDiv.className).toContain('space-y-4');
            
            const children = rootDiv.children;
            expect(children.length).toBe(2);
            
            // First child is title (h2)
            expect(children[0].tagName).toBe('H2');
            
            // Second child is flex container with search and button
            expect(children[1].className).toContain('flex');
        });

        it('should have gap between search bar and button', () => {
            const { container } = render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const flexContainer = container.querySelector('.flex.items-center.gap-4');
            expect(flexContainer).toBeDefined();
            expect(flexContainer?.className).toContain('gap-4');
        });

        it('should align search bar and button vertically', () => {
            const { container } = render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const flexContainer = container.querySelector('.flex.items-center');
            expect(flexContainer).toBeDefined();
            expect(flexContainer?.className).toContain('items-center');
        });
    });

    describe('Integration', () => {
        it('should render all components together', () => {
            render(
                <ModelTabHeader
                    searchQuery="test"
                    {...mockHandlers}
                />
            );

            // Title
            expect(screen.getByText('Model Configuration')).toBeDefined();
            
            // Search bar
            expect(screen.getByDisplayValue('test')).toBeDefined();
            
            // Button
            expect(screen.getByText('Add Provider')).toBeDefined();
        });

        it('should handle multiple interactions', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            // Click add button
            const button = screen.getByText('Add Provider').closest('button');
            fireEvent.click(button!);
            expect(mockHandlers.onAddProvider).toHaveBeenCalledTimes(1);

            // Click again
            fireEvent.click(button!);
            expect(mockHandlers.onAddProvider).toHaveBeenCalledTimes(2);
        });

        it('should update when searchQuery prop changes', () => {
            const { rerender } = render(
                <ModelTabHeader
                    searchQuery="initial"
                    {...mockHandlers}
                />
            );

            expect(screen.getByDisplayValue('initial')).toBeDefined();

            rerender(
                <ModelTabHeader
                    searchQuery="updated"
                    {...mockHandlers}
                />
            );

            expect(screen.getByDisplayValue('updated')).toBeDefined();
        });
    });

    describe('Edge cases', () => {
        it('should handle empty search query', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const searchInput = screen.getByRole('textbox') as HTMLInputElement;
            expect(searchInput.value).toBe('');
        });

        it('should handle very long search query', () => {
            const longQuery = 'a'.repeat(200);
            
            render(
                <ModelTabHeader
                    searchQuery={longQuery}
                    {...mockHandlers}
                />
            );

            const searchInput = screen.getByRole('textbox') as HTMLInputElement;
            expect(searchInput.value).toBe(longQuery);
        });

        it('should handle special characters in search query', () => {
            const specialQuery = 'provider-name (v2) [beta]';
            
            render(
                <ModelTabHeader
                    searchQuery={specialQuery}
                    {...mockHandlers}
                />
            );

            const searchInput = screen.getByRole('textbox') as HTMLInputElement;
            expect(searchInput.value).toBe(specialQuery);
        });

        it('should handle rapid button clicks', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const button = screen.getByText('Add Provider').closest('button');
            
            // Click multiple times rapidly
            fireEvent.click(button!);
            fireEvent.click(button!);
            fireEvent.click(button!);

            expect(mockHandlers.onAddProvider).toHaveBeenCalledTimes(3);
        });
    });

    describe('Accessibility', () => {
        it('should have proper heading hierarchy', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const heading = screen.getByRole('heading', { level: 2 });
            expect(heading).toBeDefined();
        });

        it('should have accessible search input', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const searchInput = screen.getByLabelText('Search providers');
            expect(searchInput).toBeDefined();
        });

        it('should have accessible button', () => {
            render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const button = screen.getByLabelText('Add new provider');
            expect(button).toBeDefined();
        });

        it('should have icon marked as decorative', () => {
            const { container } = render(
                <ModelTabHeader
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const button = screen.getByText('Add Provider').closest('button');
            const icon = button?.querySelector('svg');
            expect(icon?.getAttribute('aria-hidden')).toBe('true');
        });
    });
});
