/**
 * ProviderLogo Component - Unit Tests
 * 
 * Tests for ProviderLogo component rendering and fallback behavior
 * Requirements: 2.2, 3.2, 8.1
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProviderLogo } from './ProviderLogo.js';

describe('ProviderLogo', () => {
    describe('logo loading', () => {
        it('should render img element with correct logo URL', () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="openai" 
                    providerName="OpenAI" 
                />
            );
            
            const img = container.querySelector('img');
            expect(img).toBeTruthy();
            expect(img?.src).toBe('https://models.dev/logos/openai.svg');
        });

        it('should set alt text with provider name', () => {
            render(
                <ProviderLogo 
                    providerId="anthropic" 
                    providerName="Anthropic" 
                />
            );
            
            const img = screen.getByAltText('Anthropic logo');
            expect(img).toBeTruthy();
        });

        it('should set title attribute with provider name', () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="google" 
                    providerName="Google" 
                />
            );
            
            const img = container.querySelector('img');
            expect(img?.title).toBe('Google');
        });

        it('should apply rounded corners and border to logo', () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="openai" 
                    providerName="OpenAI" 
                />
            );
            
            const img = container.querySelector('img');
            expect(img?.className).toContain('rounded-md');
            expect(img?.className).toContain('border');
        });
    });

    describe('fallback rendering on error', () => {
        it('should display fallback with provider initial when logo fails to load', async () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="invalid-provider" 
                    providerName="TestProvider" 
                />
            );
            
            // Trigger error on the image
            const img = container.querySelector('img');
            expect(img).toBeTruthy();
            
            // Simulate image load error
            img?.dispatchEvent(new Event('error'));
            
            // Wait for fallback to render
            await waitFor(() => {
                const fallback = container.querySelector('div');
                expect(fallback).toBeTruthy();
                expect(fallback?.textContent).toBe('T');
            });
        });

        it('should display first letter of provider name in fallback', async () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="invalid" 
                    providerName="Anthropic" 
                />
            );
            
            const img = container.querySelector('img');
            img?.dispatchEvent(new Event('error'));
            
            await waitFor(() => {
                const fallback = container.querySelector('div');
                expect(fallback?.textContent).toBe('A');
            });
        });

        it('should display uppercase initial in fallback', async () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="invalid" 
                    providerName="openai" 
                />
            );
            
            const img = container.querySelector('img');
            img?.dispatchEvent(new Event('error'));
            
            await waitFor(() => {
                const fallback = container.querySelector('div');
                expect(fallback?.textContent).toBe('O');
            });
        });

        it('should apply colored background to fallback', async () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="invalid" 
                    providerName="TestProvider" 
                />
            );
            
            const img = container.querySelector('img');
            img?.dispatchEvent(new Event('error'));
            
            await waitFor(() => {
                const fallback = container.querySelector('div') as HTMLElement;
                expect(fallback).toBeTruthy();
                expect(fallback.style.backgroundColor).toBeTruthy();
                // Should be one of the predefined colors (hex or rgb format)
                expect(fallback.style.backgroundColor).toMatch(/^(#[0-9A-F]{6}|rgb\(\d+, \d+, \d+\))$/i);
            });
        });

        it('should apply rounded corners and border to fallback', async () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="invalid" 
                    providerName="TestProvider" 
                />
            );
            
            const img = container.querySelector('img');
            img?.dispatchEvent(new Event('error'));
            
            await waitFor(() => {
                const fallback = container.querySelector('div');
                expect(fallback?.className).toContain('rounded-md');
                expect(fallback?.className).toContain('border');
            });
        });

        it('should set title attribute on fallback', async () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="invalid" 
                    providerName="TestProvider" 
                />
            );
            
            const img = container.querySelector('img');
            img?.dispatchEvent(new Event('error'));
            
            await waitFor(() => {
                const fallback = container.querySelector('div');
                expect(fallback?.title).toBe('TestProvider');
            });
        });

        it('should generate consistent color for same provider name', async () => {
            const { container: container1 } = render(
                <ProviderLogo 
                    providerId="invalid1" 
                    providerName="SameProvider" 
                />
            );
            
            const { container: container2 } = render(
                <ProviderLogo 
                    providerId="invalid2" 
                    providerName="SameProvider" 
                />
            );
            
            const img1 = container1.querySelector('img');
            const img2 = container2.querySelector('img');
            
            img1?.dispatchEvent(new Event('error'));
            img2?.dispatchEvent(new Event('error'));
            
            await waitFor(() => {
                const fallback1 = container1.querySelector('div') as HTMLElement;
                const fallback2 = container2.querySelector('div') as HTMLElement;
                
                expect(fallback1.style.backgroundColor).toBe(fallback2.style.backgroundColor);
            });
        });
    });

    describe('size variants', () => {
        it('should apply small size (24px) when size="sm"', () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="openai" 
                    providerName="OpenAI" 
                    size="sm"
                />
            );
            
            const img = container.querySelector('img') as HTMLElement;
            expect(img.style.width).toBe('24px');
            expect(img.style.height).toBe('24px');
        });

        it('should apply medium size (32px) when size="md"', () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="openai" 
                    providerName="OpenAI" 
                    size="md"
                />
            );
            
            const img = container.querySelector('img') as HTMLElement;
            expect(img.style.width).toBe('32px');
            expect(img.style.height).toBe('32px');
        });

        it('should apply large size (48px) when size="lg"', () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="openai" 
                    providerName="OpenAI" 
                    size="lg"
                />
            );
            
            const img = container.querySelector('img') as HTMLElement;
            expect(img.style.width).toBe('48px');
            expect(img.style.height).toBe('48px');
        });

        it('should default to medium size when size prop is not provided', () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="openai" 
                    providerName="OpenAI" 
                />
            );
            
            const img = container.querySelector('img') as HTMLElement;
            expect(img.style.width).toBe('32px');
            expect(img.style.height).toBe('32px');
        });

        it('should apply size to fallback element', async () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="invalid" 
                    providerName="TestProvider" 
                    size="lg"
                />
            );
            
            const img = container.querySelector('img');
            img?.dispatchEvent(new Event('error'));
            
            await waitFor(() => {
                const fallback = container.querySelector('div') as HTMLElement;
                expect(fallback.style.width).toBe('48px');
                expect(fallback.style.height).toBe('48px');
            });
        });

        it('should scale font size proportionally in fallback', async () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="invalid" 
                    providerName="TestProvider" 
                    size="lg"
                />
            );
            
            const img = container.querySelector('img');
            img?.dispatchEvent(new Event('error'));
            
            await waitFor(() => {
                const fallback = container.querySelector('div') as HTMLElement;
                // Font size should be 50% of container size (48px * 0.5 = 24px)
                expect(fallback.style.fontSize).toBe('24px');
            });
        });
    });

    describe('custom className', () => {
        it('should apply custom className to logo image', () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="openai" 
                    providerName="OpenAI" 
                    className="custom-class"
                />
            );
            
            const img = container.querySelector('img');
            expect(img?.className).toContain('custom-class');
        });

        it('should apply custom className to fallback', async () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="invalid" 
                    providerName="TestProvider" 
                    className="custom-fallback"
                />
            );
            
            const img = container.querySelector('img');
            img?.dispatchEvent(new Event('error'));
            
            await waitFor(() => {
                const fallback = container.querySelector('div');
                expect(fallback?.className).toContain('custom-fallback');
            });
        });

        it('should preserve default classes when custom className is added', () => {
            const { container } = render(
                <ProviderLogo 
                    providerId="openai" 
                    providerName="OpenAI" 
                    className="custom-class"
                />
            );
            
            const img = container.querySelector('img');
            expect(img?.className).toContain('rounded-md');
            expect(img?.className).toContain('border');
            expect(img?.className).toContain('custom-class');
        });
    });
});
