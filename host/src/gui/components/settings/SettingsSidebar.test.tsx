/**
 * SettingsSidebar Component - Unit Tests
 * 
 * Tests for tab rendering, active tab highlighting, and tab click handlers
 * Requirements: 6.1, 6.2, 6.3
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsSidebar } from './SettingsSidebar.js';

describe('SettingsSidebar', () => {
    describe('tab rendering', () => {
        it('should render both Model and Theme tab buttons', () => {
            const onTabChange = vi.fn();
            render(<SettingsSidebar activeTab="model" onTabChange={onTabChange} />);

            expect(screen.getByText('Model')).toBeInTheDocument();
            expect(screen.getByText('Theme')).toBeInTheDocument();
        });

        it('should render tab buttons with icons', () => {
            const onTabChange = vi.fn();
            const { container } = render(
                <SettingsSidebar activeTab="model" onTabChange={onTabChange} />
            );

            // Check that SVG icons are present (both tabs should have icons)
            const svgIcons = container.querySelectorAll('svg');
            expect(svgIcons.length).toBe(2);
        });

        it('should render sidebar with glass panel styling', () => {
            const onTabChange = vi.fn();
            const { container } = render(
                <SettingsSidebar activeTab="model" onTabChange={onTabChange} />
            );

            const sidebar = container.firstChild;
            expect(sidebar).toHaveClass('glass-panel');
            expect(sidebar).toHaveClass('rounded-[var(--radius-lg)]');
        });

        it('should render sidebar with correct width', () => {
            const onTabChange = vi.fn();
            const { container } = render(
                <SettingsSidebar activeTab="model" onTabChange={onTabChange} />
            );

            const sidebar = container.firstChild;
            expect(sidebar).toHaveClass('md:w-[200px]');
        });
    });

    describe('active tab highlighting', () => {
        it('should highlight Model tab when activeTab is "model"', () => {
            const onTabChange = vi.fn();
            const { container } = render(
                <SettingsSidebar activeTab="model" onTabChange={onTabChange} />
            );

            const modelButton = screen.getByText('Model').closest('button');
            expect(modelButton).toHaveClass('bg-primary/10');
            expect(modelButton).toHaveClass('border-primary/30');
            expect(modelButton).toHaveClass('text-primary');
        });

        it('should highlight Theme tab when activeTab is "theme"', () => {
            const onTabChange = vi.fn();
            const { container } = render(
                <SettingsSidebar activeTab="theme" onTabChange={onTabChange} />
            );

            const themeButton = screen.getByText('Theme').closest('button');
            expect(themeButton).toHaveClass('bg-primary/10');
            expect(themeButton).toHaveClass('border-primary/30');
            expect(themeButton).toHaveClass('text-primary');
        });

        it('should not highlight Model tab when activeTab is "theme"', () => {
            const onTabChange = vi.fn();
            render(<SettingsSidebar activeTab="theme" onTabChange={onTabChange} />);

            const modelButton = screen.getByText('Model').closest('button');
            expect(modelButton).not.toHaveClass('bg-primary/10');
            expect(modelButton).toHaveClass('bg-transparent');
        });

        it('should not highlight Theme tab when activeTab is "model"', () => {
            const onTabChange = vi.fn();
            render(<SettingsSidebar activeTab="model" onTabChange={onTabChange} />);

            const themeButton = screen.getByText('Theme').closest('button');
            expect(themeButton).not.toHaveClass('bg-primary/10');
            expect(themeButton).toHaveClass('bg-transparent');
        });

        it('should apply primary color glow to active tab', () => {
            const onTabChange = vi.fn();
            render(<SettingsSidebar activeTab="model" onTabChange={onTabChange} />);

            const modelButton = screen.getByText('Model').closest('button');
            expect(modelButton?.className).toContain('shadow-[0_0_15px_rgba(59,130,246,0.15)]');
        });
    });

    describe('tab click handlers', () => {
        it('should call onTabChange with "model" when Model tab is clicked', () => {
            const onTabChange = vi.fn();
            render(<SettingsSidebar activeTab="theme" onTabChange={onTabChange} />);

            const modelButton = screen.getByText('Model').closest('button');
            fireEvent.click(modelButton!);

            expect(onTabChange).toHaveBeenCalledWith('model');
            expect(onTabChange).toHaveBeenCalledTimes(1);
        });

        it('should call onTabChange with "theme" when Theme tab is clicked', () => {
            const onTabChange = vi.fn();
            render(<SettingsSidebar activeTab="model" onTabChange={onTabChange} />);

            const themeButton = screen.getByText('Theme').closest('button');
            fireEvent.click(themeButton!);

            expect(onTabChange).toHaveBeenCalledWith('theme');
            expect(onTabChange).toHaveBeenCalledTimes(1);
        });

        it('should allow clicking the currently active tab', () => {
            const onTabChange = vi.fn();
            render(<SettingsSidebar activeTab="model" onTabChange={onTabChange} />);

            const modelButton = screen.getByText('Model').closest('button');
            fireEvent.click(modelButton!);

            // Should still call the handler (even though it's already active)
            expect(onTabChange).toHaveBeenCalledWith('model');
            expect(onTabChange).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple clicks correctly', () => {
            const onTabChange = vi.fn();
            render(<SettingsSidebar activeTab="model" onTabChange={onTabChange} />);

            const modelButton = screen.getByText('Model').closest('button');
            const themeButton = screen.getByText('Theme').closest('button');

            fireEvent.click(themeButton!);
            fireEvent.click(modelButton!);
            fireEvent.click(themeButton!);

            expect(onTabChange).toHaveBeenCalledTimes(3);
            expect(onTabChange).toHaveBeenNthCalledWith(1, 'theme');
            expect(onTabChange).toHaveBeenNthCalledWith(2, 'model');
            expect(onTabChange).toHaveBeenNthCalledWith(3, 'theme');
        });
    });

    describe('styling and transitions', () => {
        it('should apply transition classes to tab buttons', () => {
            const onTabChange = vi.fn();
            render(<SettingsSidebar activeTab="model" onTabChange={onTabChange} />);

            const modelButton = screen.getByText('Model').closest('button');
            const themeButton = screen.getByText('Theme').closest('button');

            expect(modelButton).toHaveClass('transition-all');
            expect(modelButton).toHaveClass('duration-300');
            expect(themeButton).toHaveClass('transition-all');
            expect(themeButton).toHaveClass('duration-300');
        });

        it('should apply uppercase and tracking to tab labels', () => {
            const onTabChange = vi.fn();
            render(<SettingsSidebar activeTab="model" onTabChange={onTabChange} />);

            const modelLabel = screen.getByText('Model');
            const themeLabel = screen.getByText('Theme');

            expect(modelLabel).toHaveClass('uppercase');
            expect(modelLabel).toHaveClass('tracking-wide');
            expect(themeLabel).toHaveClass('uppercase');
            expect(themeLabel).toHaveClass('tracking-wide');
        });

        it('should apply hover styles to inactive tabs', () => {
            const onTabChange = vi.fn();
            render(<SettingsSidebar activeTab="model" onTabChange={onTabChange} />);

            const themeButton = screen.getByText('Theme').closest('button');
            expect(themeButton?.className).toContain('hover:bg-[var(--color-bg-highlight)]');
            expect(themeButton?.className).toContain('hover:text-[var(--color-text-primary)]');
        });
    });
});
