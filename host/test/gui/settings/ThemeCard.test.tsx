/**
 * ThemeCard Component - Unit Tests
 * 
 * Tests for ThemeCard component rendering and interactions
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeCard } from '../../../src/gui/components/settings/ThemeCard.js';

describe('ThemeCard', () => {
    describe('active state rendering', () => {
        it('should display checkmark icon when active', () => {
            const { container } = render(
                <ThemeCard theme="dark" isActive={true} onSelect={() => {}} />
            );
            
            // Check for checkmark SVG path
            const checkmark = container.querySelector('svg path[d="M20 6L9 17l-5-5"]');
            expect(checkmark).toBeTruthy();
        });

        it('should not display checkmark icon when inactive', () => {
            const { container } = render(
                <ThemeCard theme="dark" isActive={false} onSelect={() => {}} />
            );
            
            // Check for checkmark SVG path
            const checkmark = container.querySelector('svg path[d="M20 6L9 17l-5-5"]');
            expect(checkmark).toBeFalsy();
        });

        it('should apply primary border when active', () => {
            const { container } = render(
                <ThemeCard theme="dark" isActive={true} onSelect={() => {}} />
            );
            
            // Find the MagicCard wrapper (first div child)
            const magicCard = container.firstChild as HTMLElement;
            expect(magicCard.className).toContain('border-2');
            expect(magicCard.className).toContain('border-[var(--color-primary)]');
        });

        it('should apply default border when inactive', () => {
            const { container } = render(
                <ThemeCard theme="dark" isActive={false} onSelect={() => {}} />
            );
            
            // Find the MagicCard wrapper (first div child)
            const magicCard = container.firstChild as HTMLElement;
            expect(magicCard.className).toContain('border');
            expect(magicCard.className).toContain('border-[var(--color-border)]');
            expect(magicCard.className).not.toContain('border-2');
        });
    });

    describe('click handler', () => {
        it('should call onSelect when clicked', () => {
            const onSelect = vi.fn();
            const { container } = render(
                <ThemeCard theme="dark" isActive={false} onSelect={onSelect} />
            );
            
            const magicCard = container.firstChild as HTMLElement;
            magicCard.click();
            
            expect(onSelect).toHaveBeenCalledTimes(1);
        });

        it('should call onSelect when active card is clicked', () => {
            const onSelect = vi.fn();
            const { container } = render(
                <ThemeCard theme="dark" isActive={true} onSelect={onSelect} />
            );
            
            const magicCard = container.firstChild as HTMLElement;
            magicCard.click();
            
            expect(onSelect).toHaveBeenCalledTimes(1);
        });
    });

    describe('theme preview colors', () => {
        it('should display dark theme preview colors', () => {
            const { container } = render(
                <ThemeCard theme="dark" isActive={false} onSelect={() => {}} />
            );
            
            // Check for dark theme background color (happy-dom returns hex format)
            const preview = container.querySelector('[style*="background-color"]') as HTMLElement;
            expect(preview).toBeTruthy();
            const bgColor = preview.style.backgroundColor.toLowerCase();
            expect(bgColor === '#0a0a0a' || bgColor === 'rgb(10, 10, 10)').toBe(true);
        });

        it('should display light theme preview colors', () => {
            const { container } = render(
                <ThemeCard theme="light" isActive={false} onSelect={() => {}} />
            );
            
            // Check for light theme background color (happy-dom returns hex format)
            const preview = container.querySelector('[style*="background-color"]') as HTMLElement;
            expect(preview).toBeTruthy();
            const bgColor = preview.style.backgroundColor.toLowerCase();
            expect(bgColor === '#ffffff' || bgColor === 'rgb(255, 255, 255)').toBe(true);
        });

        it('should display "Dark" label for dark theme', () => {
            render(<ThemeCard theme="dark" isActive={false} onSelect={() => {}} />);
            expect(screen.getByText('Dark')).toBeTruthy();
        });

        it('should display "Light" label for light theme', () => {
            render(<ThemeCard theme="light" isActive={false} onSelect={() => {}} />);
            expect(screen.getByText('Light')).toBeTruthy();
        });

        it('should display preview text in theme card', () => {
            render(<ThemeCard theme="dark" isActive={false} onSelect={() => {}} />);
            expect(screen.getByText('Preview Text')).toBeTruthy();
        });
    });

    describe('theme-specific styling', () => {
        it('should apply dark theme accent color (#3B82F6)', () => {
            const { container } = render(
                <ThemeCard theme="dark" isActive={false} onSelect={() => {}} />
            );
            
            // Find the accent color element (the colored bar in preview)
            const accentElements = Array.from(container.querySelectorAll('[style*="background-color"]')) as HTMLElement[];
            const accentElement = accentElements.find(el => {
                const bgColor = el.style.backgroundColor.toLowerCase();
                return bgColor === '#3b82f6' || bgColor === 'rgb(59, 130, 246)';
            });
            expect(accentElement).toBeTruthy();
        });

        it('should apply light theme accent color (#8B5CF6)', () => {
            const { container } = render(
                <ThemeCard theme="light" isActive={false} onSelect={() => {}} />
            );
            
            // Find the accent color element (the colored bar in preview)
            const accentElements = Array.from(container.querySelectorAll('[style*="background-color"]')) as HTMLElement[];
            const accentElement = accentElements.find(el => {
                const bgColor = el.style.backgroundColor.toLowerCase();
                return bgColor === '#8b5cf6' || bgColor === 'rgb(139, 92, 246)';
            });
            expect(accentElement).toBeTruthy();
        });
    });
});
