/**
 * Settings Panel - Search Bars Unit Tests (V2)
 * 
 * Unit tests for ProviderSearchBar and ModelSearchBar components
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProviderSearchBar } from '../../../src/gui/components/settings/ProviderSearchBar.js';
import { ModelSearchBar } from '../../../src/gui/components/settings/ModelSearchBar.js';

describe('ProviderSearchBar', () => {
    const mockHandlers = {
        onSearchChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.restoreAllMocks();
    });

    describe('Input rendering', () => {
        it('should render search input with placeholder', () => {
            render(
                <ProviderSearchBar
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const input = screen.getByPlaceholderText('Search providers...');
            expect(input).toBeDefined();
        });

        it('should render search icon', () => {
            const { container } = render(
                <ProviderSearchBar
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const icon = container.querySelector('svg');
            expect(icon).toBeDefined();
        });

        it('should display current search query value', () => {
            render(
                <ProviderSearchBar
                    searchQuery="openai"
                    {...mockHandlers}
                />
            );

            const input = screen.getByDisplayValue('openai');
            expect(input).toBeDefined();
        });

        it('should have aria-label for accessibility', () => {
            render(
                <ProviderSearchBar
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const input = screen.getByLabelText('Search providers');
            expect(input).toBeDefined();
        });

        it('should have correct input type', () => {
            render(
                <ProviderSearchBar
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            expect(input.getAttribute('type')).toBe('text');
        });
    });

    describe('Debounce behavior', () => {
        it('should not call onSearchChange immediately on input', () => {
            render(
                <ProviderSearchBar
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'test' } });

            expect(mockHandlers.onSearchChange).not.toHaveBeenCalled();
        });

        it('should call onSearchChange after 300ms debounce', () => {
            render(
                <ProviderSearchBar
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'test' } });

            // Fast forward 300ms
            vi.advanceTimersByTime(300);

            expect(mockHandlers.onSearchChange).toHaveBeenCalledTimes(1);
            expect(mockHandlers.onSearchChange).toHaveBeenCalledWith('test');
        });

        it('should debounce multiple rapid inputs', () => {
            render(
                <ProviderSearchBar
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            
            // Type multiple characters rapidly
            fireEvent.change(input, { target: { value: 't' } });
            vi.advanceTimersByTime(100);
            
            fireEvent.change(input, { target: { value: 'te' } });
            vi.advanceTimersByTime(100);
            
            fireEvent.change(input, { target: { value: 'tes' } });
            vi.advanceTimersByTime(100);
            
            fireEvent.change(input, { target: { value: 'test' } });
            
            // Should not have been called yet
            expect(mockHandlers.onSearchChange).not.toHaveBeenCalled();
            
            // Fast forward final 300ms
            vi.advanceTimersByTime(300);

            // Should only be called once with final value
            expect(mockHandlers.onSearchChange).toHaveBeenCalledTimes(1);
            expect(mockHandlers.onSearchChange).toHaveBeenCalledWith('test');
        });

        it('should update local value immediately for responsive UI', () => {
            render(
                <ProviderSearchBar
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'test' } });

            // Local value should update immediately
            expect(input.value).toBe('test');
        });
    });

    describe('External value updates', () => {
        it('should update local value when searchQuery prop changes', () => {
            const { rerender } = render(
                <ProviderSearchBar
                    searchQuery="initial"
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox') as HTMLInputElement;
            expect(input.value).toBe('initial');

            // Update prop
            rerender(
                <ProviderSearchBar
                    searchQuery="updated"
                    {...mockHandlers}
                />
            );

            expect(input.value).toBe('updated');
        });

        it('should handle clearing search query externally', () => {
            const { rerender } = render(
                <ProviderSearchBar
                    searchQuery="test"
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox') as HTMLInputElement;
            expect(input.value).toBe('test');

            // Clear externally
            rerender(
                <ProviderSearchBar
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            expect(input.value).toBe('');
        });
    });

    describe('Styling', () => {
        it('should have focus styles', () => {
            render(
                <ProviderSearchBar
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            expect(input.className).toContain('focus:border-[var(--color-primary)]');
        });

        it('should have proper padding for icon', () => {
            render(
                <ProviderSearchBar
                    searchQuery=""
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            expect(input.className).toContain('pl-10');
        });
    });
});

describe('ModelSearchBar', () => {
    const mockHandlers = {
        onSearchChange: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.restoreAllMocks();
    });

    describe('Input rendering', () => {
        it('should render search input with placeholder when enabled', () => {
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const input = screen.getByPlaceholderText('Search models...');
            expect(input).toBeDefined();
        });

        it('should render different placeholder when disabled', () => {
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={true}
                    {...mockHandlers}
                />
            );

            const input = screen.getByPlaceholderText('Select a provider to search models...');
            expect(input).toBeDefined();
        });

        it('should render search icon', () => {
            const { container } = render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const icon = container.querySelector('svg');
            expect(icon).toBeDefined();
        });

        it('should display current search query value', () => {
            render(
                <ModelSearchBar
                    searchQuery="gpt-4"
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const input = screen.getByDisplayValue('gpt-4');
            expect(input).toBeDefined();
        });

        it('should have aria-label for accessibility', () => {
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const input = screen.getByLabelText('Search models');
            expect(input).toBeDefined();
        });
    });

    describe('Disabled state', () => {
        it('should be disabled when disabled prop is true', () => {
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={true}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            expect(input.hasAttribute('disabled')).toBe(true);
        });

        it('should not be disabled when disabled prop is false', () => {
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            expect(input.hasAttribute('disabled')).toBe(false);
        });

        it('should have aria-disabled attribute when disabled', () => {
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={true}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            expect(input.getAttribute('aria-disabled')).toBe('true');
        });

        it('should have opacity and cursor styles when disabled', () => {
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={true}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            expect(input.className).toContain('opacity-50');
            expect(input.className).toContain('cursor-not-allowed');
        });

        it('should not call onSearchChange when disabled', () => {
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={true}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            
            // Try to change input (should be blocked by disabled attribute)
            fireEvent.change(input, { target: { value: 'test' } });
            vi.advanceTimersByTime(300);

            expect(mockHandlers.onSearchChange).not.toHaveBeenCalled();
        });

        it('should dim icon when disabled', () => {
            const { container } = render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={true}
                    {...mockHandlers}
                />
            );

            const iconContainer = container.querySelector('.absolute');
            expect(iconContainer?.className).toContain('opacity-50');
        });
    });

    describe('Debounce behavior', () => {
        it('should not call onSearchChange immediately on input', () => {
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'gpt' } });

            expect(mockHandlers.onSearchChange).not.toHaveBeenCalled();
        });

        it('should call onSearchChange after 300ms debounce', () => {
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: 'gpt' } });

            // Fast forward 300ms
            vi.advanceTimersByTime(300);

            expect(mockHandlers.onSearchChange).toHaveBeenCalledTimes(1);
            expect(mockHandlers.onSearchChange).toHaveBeenCalledWith('gpt');
        });

        it('should debounce multiple rapid inputs', () => {
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            
            // Type multiple characters rapidly
            fireEvent.change(input, { target: { value: 'g' } });
            vi.advanceTimersByTime(100);
            
            fireEvent.change(input, { target: { value: 'gp' } });
            vi.advanceTimersByTime(100);
            
            fireEvent.change(input, { target: { value: 'gpt' } });
            
            // Should not have been called yet
            expect(mockHandlers.onSearchChange).not.toHaveBeenCalled();
            
            // Fast forward final 300ms
            vi.advanceTimersByTime(300);

            // Should only be called once with final value
            expect(mockHandlers.onSearchChange).toHaveBeenCalledTimes(1);
            expect(mockHandlers.onSearchChange).toHaveBeenCalledWith('gpt');
        });

        it('should update local value immediately for responsive UI', () => {
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox') as HTMLInputElement;
            fireEvent.change(input, { target: { value: 'gpt' } });

            // Local value should update immediately
            expect(input.value).toBe('gpt');
        });
    });

    describe('External value updates', () => {
        it('should update local value when searchQuery prop changes', () => {
            const { rerender } = render(
                <ModelSearchBar
                    searchQuery="initial"
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox') as HTMLInputElement;
            expect(input.value).toBe('initial');

            // Update prop
            rerender(
                <ModelSearchBar
                    searchQuery="updated"
                    disabled={false}
                    {...mockHandlers}
                />
            );

            expect(input.value).toBe('updated');
        });

        it('should handle clearing search query externally', () => {
            const { rerender } = render(
                <ModelSearchBar
                    searchQuery="gpt-4"
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox') as HTMLInputElement;
            expect(input.value).toBe('gpt-4');

            // Clear externally
            rerender(
                <ModelSearchBar
                    searchQuery=""
                    disabled={false}
                    {...mockHandlers}
                />
            );

            expect(input.value).toBe('');
        });
    });

    describe('Styling', () => {
        it('should have focus styles when enabled', () => {
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            expect(input.className).toContain('focus:border-[var(--color-primary)]');
        });

        it('should not have focus styles when disabled', () => {
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={true}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            expect(input.className).not.toContain('focus:border-[var(--color-primary)]');
        });

        it('should have proper padding for icon', () => {
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            expect(input.className).toContain('pl-10');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty string input', () => {
            render(
                <ModelSearchBar
                    searchQuery="test"
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: '' } });

            vi.advanceTimersByTime(300);

            expect(mockHandlers.onSearchChange).toHaveBeenCalledWith('');
        });

        it('should handle very long search queries', () => {
            const longQuery = 'a'.repeat(200);
            
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: longQuery } });

            vi.advanceTimersByTime(300);

            expect(mockHandlers.onSearchChange).toHaveBeenCalledWith(longQuery);
        });

        it('should handle special characters in search', () => {
            const specialQuery = 'gpt-4.5 (turbo) [beta]';
            
            render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={false}
                    {...mockHandlers}
                />
            );

            const input = screen.getByRole('textbox');
            fireEvent.change(input, { target: { value: specialQuery } });

            vi.advanceTimersByTime(300);

            expect(mockHandlers.onSearchChange).toHaveBeenCalledWith(specialQuery);
        });

        it('should handle toggling disabled state', () => {
            const { rerender } = render(
                <ModelSearchBar
                    searchQuery=""
                    disabled={false}
                    {...mockHandlers}
                />
            );

            let input = screen.getByRole('textbox');
            expect(input.hasAttribute('disabled')).toBe(false);

            // Disable
            rerender(
                <ModelSearchBar
                    searchQuery=""
                    disabled={true}
                    {...mockHandlers}
                />
            );

            input = screen.getByRole('textbox');
            expect(input.hasAttribute('disabled')).toBe(true);

            // Re-enable
            rerender(
                <ModelSearchBar
                    searchQuery=""
                    disabled={false}
                    {...mockHandlers}
                />
            );

            input = screen.getByRole('textbox');
            expect(input.hasAttribute('disabled')).toBe(false);
        });
    });
});
