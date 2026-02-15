/**
 * ProviderLogo Component - Property-Based Tests
 * 
 * Property-based tests for ProviderLogo component using fast-check
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { render, waitFor } from '@testing-library/react';
import { ProviderLogo } from './ProviderLogo.js';

/**
 * Arbitrary generator for provider ID
 */
const arbitraryProviderId = (): fc.Arbitrary<string> => {
    return fc.oneof(
        fc.constantFrom('openai', 'anthropic', 'google', 'cohere', 'mistral'),
        fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s))
    );
};

/**
 * Arbitrary generator for provider name
 */
const arbitraryProviderName = (): fc.Arbitrary<string> => {
    return fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
};

/**
 * Arbitrary generator for size variant
 */
const arbitrarySize = (): fc.Arbitrary<'sm' | 'md' | 'lg'> => {
    return fc.constantFrom('sm', 'md', 'lg');
};

/**
 * Feature: settings-panel-v2, Property 10: Provider Logo Fallback
 * Validates: Requirements 3.4
 * 
 * For any provider logo load failure, the system should display a fallback
 * with the provider's initial in a colored circle.
 */
describe('ProviderLogo - Property-Based Tests', () => {
    it('Property 10: Provider Logo Fallback - logo load failure shows fallback with initial', async () => {
        await fc.assert(
            fc.asyncProperty(
                arbitraryProviderId(),
                arbitraryProviderName(),
                async (providerId, providerName) => {
                    const { container } = render(
                        <ProviderLogo 
                            providerId={providerId}
                            providerName={providerName}
                        />
                    );

                    // Trigger error on the image to simulate load failure
                    const img = container.querySelector('img');
                    if (!img) return false;

                    img.dispatchEvent(new Event('error'));

                    // Wait for fallback to render
                    try {
                        await waitFor(() => {
                            const fallback = container.querySelector('div');
                            if (!fallback) throw new Error('Fallback not found');

                            // Verify fallback contains the provider's initial
                            const expectedInitial = providerName.charAt(0).toUpperCase();
                            const actualContent = fallback.textContent;

                            // Verify fallback has colored background
                            const hasBackgroundColor = fallback.style.backgroundColor !== '';

                            // Verify fallback has proper styling
                            const hasRoundedCorners = fallback.className.includes('rounded-md');
                            const hasBorder = fallback.className.includes('border');

                            if (!(actualContent === expectedInitial &&
                                hasBackgroundColor &&
                                hasRoundedCorners &&
                                hasBorder)) {
                                throw new Error('Fallback validation failed');
                            }
                        });
                        return true;
                    } catch {
                        return false;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Fallback initial is always uppercase
     * 
     * Verifies that the fallback always displays an uppercase initial,
     * regardless of the case of the provider name.
     */
    it('fallback initial is always uppercase', async () => {
        await fc.assert(
            fc.asyncProperty(
                arbitraryProviderId(),
                arbitraryProviderName(),
                async (providerId, providerName) => {
                    const { container } = render(
                        <ProviderLogo 
                            providerId={providerId}
                            providerName={providerName}
                        />
                    );

                    const img = container.querySelector('img');
                    if (!img) return false;

                    img.dispatchEvent(new Event('error'));

                    try {
                        await waitFor(() => {
                            const fallback = container.querySelector('div');
                            if (!fallback) throw new Error('Fallback not found');

                            const initial = fallback.textContent || '';
                            const expectedInitial = providerName.charAt(0).toUpperCase();

                            if (!(initial === expectedInitial && initial === initial.toUpperCase())) {
                                throw new Error('Initial validation failed');
                            }
                        });
                        return true;
                    } catch {
                        return false;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Fallback size matches requested size
     * 
     * Verifies that the fallback element has the correct dimensions
     * based on the size prop.
     */
    it('fallback size matches requested size', async () => {
        const sizeMap = { sm: 24, md: 32, lg: 48 };

        await fc.assert(
            fc.asyncProperty(
                arbitraryProviderId(),
                arbitraryProviderName(),
                arbitrarySize(),
                async (providerId, providerName, size) => {
                    const { container } = render(
                        <ProviderLogo 
                            providerId={providerId}
                            providerName={providerName}
                            size={size}
                        />
                    );

                    const img = container.querySelector('img');
                    if (!img) return false;

                    img.dispatchEvent(new Event('error'));

                    try {
                        await waitFor(() => {
                            const fallback = container.querySelector('div') as HTMLElement;
                            if (!fallback) throw new Error('Fallback not found');

                            const expectedSize = sizeMap[size];
                            const actualWidth = parseInt(fallback.style.width);
                            const actualHeight = parseInt(fallback.style.height);

                            if (!(actualWidth === expectedSize && actualHeight === expectedSize)) {
                                throw new Error('Size validation failed');
                            }
                        });
                        return true;
                    } catch {
                        return false;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Same provider name generates consistent color
     * 
     * Verifies that the same provider name always generates the same
     * background color for the fallback.
     */
    it('same provider name generates consistent color', async () => {
        await fc.assert(
            fc.asyncProperty(
                arbitraryProviderId(),
                arbitraryProviderName(),
                async (providerId, providerName) => {
                    // Render twice with same provider name
                    const { container: container1 } = render(
                        <ProviderLogo 
                            providerId={`${providerId}-1`}
                            providerName={providerName}
                        />
                    );

                    const { container: container2 } = render(
                        <ProviderLogo 
                            providerId={`${providerId}-2`}
                            providerName={providerName}
                        />
                    );

                    const img1 = container1.querySelector('img');
                    const img2 = container2.querySelector('img');

                    if (!img1 || !img2) return false;

                    img1.dispatchEvent(new Event('error'));
                    img2.dispatchEvent(new Event('error'));

                    try {
                        const [color1, color2] = await Promise.all([
                            waitFor(() => {
                                const fallback1 = container1.querySelector('div') as HTMLElement;
                                if (!fallback1) throw new Error('Fallback 1 not found');
                                return fallback1.style.backgroundColor;
                            }),
                            waitFor(() => {
                                const fallback2 = container2.querySelector('div') as HTMLElement;
                                if (!fallback2) throw new Error('Fallback 2 not found');
                                return fallback2.style.backgroundColor;
                            })
                        ]);
                        return color1 !== null && color1 === color2;
                    } catch {
                        return false;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Fallback font size scales with container size
     * 
     * Verifies that the font size in the fallback is proportional
     * to the container size (50% of container size).
     */
    it('fallback font size scales with container size', async () => {
        const sizeMap = { sm: 24, md: 32, lg: 48 };

        await fc.assert(
            fc.asyncProperty(
                arbitraryProviderId(),
                arbitraryProviderName(),
                arbitrarySize(),
                async (providerId, providerName, size) => {
                    const { container } = render(
                        <ProviderLogo 
                            providerId={providerId}
                            providerName={providerName}
                            size={size}
                        />
                    );

                    const img = container.querySelector('img');
                    if (!img) return false;

                    img.dispatchEvent(new Event('error'));

                    try {
                        await waitFor(() => {
                            const fallback = container.querySelector('div') as HTMLElement;
                            if (!fallback) throw new Error('Fallback not found');

                            const containerSize = sizeMap[size];
                            const expectedFontSize = containerSize * 0.5;
                            const actualFontSize = parseInt(fallback.style.fontSize);

                            if (actualFontSize !== expectedFontSize) {
                                throw new Error('Font size validation failed');
                            }
                        });
                        return true;
                    } catch {
                        return false;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Custom className is preserved in fallback
     * 
     * Verifies that custom className prop is applied to the fallback element.
     */
    it('custom className is preserved in fallback', async () => {
        await fc.assert(
            fc.asyncProperty(
                arbitraryProviderId(),
                arbitraryProviderName(),
                fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z-]+$/.test(s)),
                async (providerId, providerName, customClass) => {
                    const { container } = render(
                        <ProviderLogo 
                            providerId={providerId}
                            providerName={providerName}
                            className={customClass}
                        />
                    );

                    const img = container.querySelector('img');
                    if (!img) return false;

                    img.dispatchEvent(new Event('error'));

                    try {
                        await waitFor(() => {
                            const fallback = container.querySelector('div');
                            if (!fallback) throw new Error('Fallback not found');

                            if (!fallback.className.includes(customClass)) {
                                throw new Error('Custom class validation failed');
                            }
                        });
                        return true;
                    } catch {
                        return false;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Fallback has title attribute with provider name
     * 
     * Verifies that the fallback element has a title attribute
     * containing the provider name for accessibility.
     */
    it('fallback has title attribute with provider name', async () => {
        await fc.assert(
            fc.asyncProperty(
                arbitraryProviderId(),
                arbitraryProviderName(),
                async (providerId, providerName) => {
                    const { container } = render(
                        <ProviderLogo 
                            providerId={providerId}
                            providerName={providerName}
                        />
                    );

                    const img = container.querySelector('img');
                    if (!img) return false;

                    img.dispatchEvent(new Event('error'));

                    try {
                        await waitFor(() => {
                            const fallback = container.querySelector('div');
                            if (!fallback) throw new Error('Fallback not found');

                            if (fallback.title !== providerName) {
                                throw new Error('Title validation failed');
                            }
                        });
                        return true;
                    } catch {
                        return false;
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});
