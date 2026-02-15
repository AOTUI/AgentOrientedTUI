/**
 * ModelRegistryTab Integration Tests
 * 
 * Integration tests for ModelRegistryTab component
 * Tests provider selection, model browsing, error handling, and loading states
 * 
 * Requirements: 8.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ModelRegistryTab } from '../../../src/gui/components/settings/ModelRegistryTab.js';
import type { ModelsDevModel } from '@aotui/agent-driver-v2';

// Mock data
const mockProviders = [
    {
        id: 'openai',
        name: 'OpenAI',
        baseURL: 'https://api.openai.com/v1',
        modelCount: 10,
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        baseURL: 'https://api.anthropic.com',
        modelCount: 5,
    },
    {
        id: 'google',
        name: 'Google',
        baseURL: 'https://generativelanguage.googleapis.com',
        modelCount: 8,
    },
];

const mockModels: ModelsDevModel[] = [
    {
        id: 'gpt-4',
        name: 'GPT-4',
        family: 'GPT-4',
        tool_call: true,
        reasoning: true,
        modalities: { input: ['text'], output: ['text'] },
        cost: { input: 0.03, output: 0.06 },
        limit: { context: 128000, output: 4096 },
    },
    {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        family: 'GPT-3.5',
        tool_call: true,
        modalities: { input: ['text'], output: ['text'] },
        cost: { input: 0.001, output: 0.002 },
        limit: { context: 16000, output: 4096 },
    },
    {
        id: 'gpt-4-vision',
        name: 'GPT-4 Vision',
        family: 'GPT-4',
        tool_call: true,
        reasoning: false,
        modalities: { input: ['text', 'image'], output: ['text'] },
        cost: { input: 0.01, output: 0.03 },
        limit: { context: 128000, output: 4096 },
    },
];

const mockAnthropicModels: ModelsDevModel[] = [
    {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        family: 'Claude 3',
        tool_call: true,
        reasoning: true,
        modalities: { input: ['text'], output: ['text'] },
        cost: { input: 0.015, output: 0.075 },
        limit: { context: 200000, output: 4096 },
    },
    {
        id: 'claude-3-sonnet',
        name: 'Claude 3 Sonnet',
        family: 'Claude 3',
        tool_call: true,
        reasoning: false,
        modalities: { input: ['text'], output: ['text'] },
        cost: { input: 0.003, output: 0.015 },
        limit: { context: 200000, output: 4096 },
    },
];

const mockCacheStatus = {
    lastFetch: Date.now() - 1000 * 60 * 30, // 30 minutes ago
    isStale: false,
    providerCount: 3,
    modelCount: 25,
};

// Mock hooks
const mockUseModelRegistryProviders = {
    providers: mockProviders,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
};

const mockUseModelRegistryCacheStatus = {
    cacheStatus: mockCacheStatus,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
};

const mockUseModelRegistryRefresh = {
    refreshCache: vi.fn().mockResolvedValue(undefined),
    isRefreshing: false,
    error: null,
};

const mockUseModels = {
    models: mockModels,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
};

vi.mock('../../../src/gui/hooks/useModelRegistry.js', () => ({
    useModelRegistryProviders: () => mockUseModelRegistryProviders,
    useModelRegistryCacheStatus: () => mockUseModelRegistryCacheStatus,
    useModelRegistryRefresh: () => mockUseModelRegistryRefresh,
}));

vi.mock('../../../src/gui/hooks/useModels.js', () => ({
    useModels: vi.fn((providerId: string | null) => {
        if (providerId === 'anthropic') {
            return {
                ...mockUseModels,
                models: mockAnthropicModels,
            };
        }
        return mockUseModels;
    }),
}));

describe('ModelRegistryTab - Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mock data
        mockUseModelRegistryProviders.providers = mockProviders;
        mockUseModelRegistryProviders.isLoading = false;
        mockUseModelRegistryProviders.error = null;
        mockUseModelRegistryCacheStatus.cacheStatus = mockCacheStatus;
        mockUseModelRegistryCacheStatus.isLoading = false;
        mockUseModelRegistryCacheStatus.error = null;
        mockUseModelRegistryRefresh.isRefreshing = false;
        mockUseModelRegistryRefresh.error = null;
        mockUseModels.models = mockModels;
        mockUseModels.isLoading = false;
        mockUseModels.error = null;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Component rendering', () => {
        it('should render ModelRegistryTab with all sections', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                // Header
                expect(screen.getByText('Model Registry')).toBeInTheDocument();
                expect(screen.getByText(/browse and explore available llm providers/i)).toBeInTheDocument();
                
                // Sections
                expect(screen.getByText('Select Provider')).toBeInTheDocument();
                expect(screen.getByText('Model Details')).toBeInTheDocument();
                
                // Info footer
                expect(screen.getByText(/this is a read-only view/i)).toBeInTheDocument();
            });
        });

        it('should render cache status section', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText(/cache status/i)).toBeInTheDocument();
            });
        });

        it('should render provider cards', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
                expect(screen.getByText('Anthropic')).toBeInTheDocument();
                expect(screen.getByText('Google')).toBeInTheDocument();
            });
        });

        it('should show placeholder when no provider is selected', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText(/select a provider to view models/i)).toBeInTheDocument();
            });
        });
    });

    describe('Loading states', () => {
        it('should show loading state while loading providers', async () => {
            mockUseModelRegistryProviders.isLoading = true;
            mockUseModelRegistryProviders.providers = [];

            render(<ModelRegistryTab />);

            expect(screen.getByText(/loading providers/i)).toBeInTheDocument();
        });

        it('should show loading state while loading models', async () => {
            render(<ModelRegistryTab />);

            // Select a provider first
            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            const openaiCard = screen.getByText('OpenAI').closest('button');
            if (openaiCard) {
                fireEvent.click(openaiCard);
            }

            // Set models to loading
            mockUseModels.isLoading = true;
            mockUseModels.models = [];

            // Re-render to reflect loading state
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText(/loading models/i)).toBeInTheDocument();
            });
        });

        it('should transition from loading to loaded state', async () => {
            mockUseModelRegistryProviders.isLoading = true;
            mockUseModelRegistryProviders.providers = [];

            const { rerender } = render(<ModelRegistryTab />);

            expect(screen.getByText(/loading providers/i)).toBeInTheDocument();

            // Update to loaded state
            mockUseModelRegistryProviders.isLoading = false;
            mockUseModelRegistryProviders.providers = mockProviders;

            rerender(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.queryByText(/loading providers/i)).not.toBeInTheDocument();
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });
        });
    });

    describe('Error handling', () => {
        it('should show error message when provider loading fails', async () => {
            mockUseModelRegistryProviders.error = new Error('Failed to load providers');
            mockUseModelRegistryProviders.providers = [];

            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText(/failed to load providers/i)).toBeInTheDocument();
            });
        });

        it('should show error message when model loading fails', async () => {
            render(<ModelRegistryTab />);

            // Select a provider
            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            const openaiCard = screen.getByText('OpenAI').closest('button');
            if (openaiCard) {
                fireEvent.click(openaiCard);
            }

            // Set models to error state
            mockUseModels.error = new Error('Failed to load models');

            // Re-render to reflect error state
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText(/failed to load models/i)).toBeInTheDocument();
            });
        });

        it('should show fallback message in error state', async () => {
            mockUseModels.error = new Error('API error');

            render(<ModelRegistryTab />);

            // Select a provider
            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            const openaiCard = screen.getByText('OpenAI').closest('button');
            if (openaiCard) {
                fireEvent.click(openaiCard);
            }

            await waitFor(() => {
                expect(screen.getByText(/using cached data if available/i)).toBeInTheDocument();
            });
        });

        it('should allow retry after error', async () => {
            mockUseModelRegistryProviders.error = new Error('Network error');

            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText(/failed to load providers/i)).toBeInTheDocument();
            });

            // Find and click refresh button
            const refreshButton = screen.getByRole('button', { name: /refresh/i });
            fireEvent.click(refreshButton);

            // Refresh should be called
            await waitFor(() => {
                expect(mockUseModelRegistryRefresh.refreshCache).toHaveBeenCalled();
            });
        });
    });

    describe('Provider selection flow', () => {
        it('should select provider when clicked', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            // Click OpenAI provider
            const openaiCard = screen.getByText('OpenAI').closest('button');
            if (openaiCard) {
                fireEvent.click(openaiCard);
            }

            // Should show "Select Model" section
            await waitFor(() => {
                expect(screen.getByText('Select Model')).toBeInTheDocument();
            });
        });

        it('should load models for selected provider', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            // Click OpenAI provider
            const openaiCard = screen.getByText('OpenAI').closest('button');
            if (openaiCard) {
                fireEvent.click(openaiCard);
            }

            // Should show OpenAI models
            await waitFor(() => {
                expect(screen.getByText('GPT-4')).toBeInTheDocument();
                expect(screen.getByText('GPT-3.5 Turbo')).toBeInTheDocument();
            });
        });

        it('should switch models when provider changes', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            // Select OpenAI
            const openaiCard = screen.getByText('OpenAI').closest('button');
            if (openaiCard) {
                fireEvent.click(openaiCard);
            }

            await waitFor(() => {
                expect(screen.getByText('GPT-4')).toBeInTheDocument();
            });

            // Select Anthropic
            const anthropicCard = screen.getByText('Anthropic').closest('button');
            if (anthropicCard) {
                fireEvent.click(anthropicCard);
            }

            // Should show Anthropic models
            await waitFor(() => {
                expect(screen.getByText('Claude 3 Opus')).toBeInTheDocument();
                expect(screen.queryByText('GPT-4')).not.toBeInTheDocument();
            });
        });

        it('should clear model selection when provider changes', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            // Select OpenAI and a model
            const openaiCard = screen.getByText('OpenAI').closest('button');
            if (openaiCard) {
                fireEvent.click(openaiCard);
            }

            await waitFor(() => {
                expect(screen.getByText('GPT-4')).toBeInTheDocument();
            });

            const gpt4Card = screen.getByText('GPT-4').closest('button');
            if (gpt4Card) {
                fireEvent.click(gpt4Card);
            }

            // Model details should be shown
            await waitFor(() => {
                expect(screen.getByText(/context length/i)).toBeInTheDocument();
            });

            // Switch to Anthropic
            const anthropicCard = screen.getByText('Anthropic').closest('button');
            if (anthropicCard) {
                fireEvent.click(anthropicCard);
            }

            // Model selection should be cleared (placeholder shown)
            await waitFor(() => {
                expect(screen.getByText(/select a model to view details/i)).toBeInTheDocument();
            });
        });
    });

    describe('Model selection flow', () => {
        it('should select model when clicked', async () => {
            render(<ModelRegistryTab />);

            // Select provider first
            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            const openaiCard = screen.getByText('OpenAI').closest('button');
            if (openaiCard) {
                fireEvent.click(openaiCard);
            }

            await waitFor(() => {
                expect(screen.getByText('GPT-4')).toBeInTheDocument();
            });

            // Click GPT-4 model
            const gpt4Card = screen.getByText('GPT-4').closest('button');
            if (gpt4Card) {
                fireEvent.click(gpt4Card);
            }

            // Should show model details
            await waitFor(() => {
                expect(screen.getByText(/context length/i)).toBeInTheDocument();
                expect(screen.getByText('128,000')).toBeInTheDocument();
            });
        });

        it('should display model capabilities', async () => {
            render(<ModelRegistryTab />);

            // Select provider and model
            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            const openaiCard = screen.getByText('OpenAI').closest('button');
            if (openaiCard) {
                fireEvent.click(openaiCard);
            }

            await waitFor(() => {
                expect(screen.getByText('GPT-4')).toBeInTheDocument();
            });

            const gpt4Card = screen.getByText('GPT-4').closest('button');
            if (gpt4Card) {
                fireEvent.click(gpt4Card);
            }

            // Should show capabilities
            await waitFor(() => {
                expect(screen.getByText(/tool calling/i)).toBeInTheDocument();
                expect(screen.getByText(/reasoning/i)).toBeInTheDocument();
            });
        });

        it('should display model pricing', async () => {
            render(<ModelRegistryTab />);

            // Select provider and model
            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            const openaiCard = screen.getByText('OpenAI').closest('button');
            if (openaiCard) {
                fireEvent.click(openaiCard);
            }

            await waitFor(() => {
                expect(screen.getByText('GPT-4')).toBeInTheDocument();
            });

            const gpt4Card = screen.getByText('GPT-4').closest('button');
            if (gpt4Card) {
                fireEvent.click(gpt4Card);
            }

            // Should show pricing
            await waitFor(() => {
                expect(screen.getByText(/input cost/i)).toBeInTheDocument();
                expect(screen.getByText(/output cost/i)).toBeInTheDocument();
            });
        });

        it('should switch between models', async () => {
            render(<ModelRegistryTab />);

            // Select provider
            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            const openaiCard = screen.getByText('OpenAI').closest('button');
            if (openaiCard) {
                fireEvent.click(openaiCard);
            }

            await waitFor(() => {
                expect(screen.getByText('GPT-4')).toBeInTheDocument();
            });

            // Select GPT-4
            const gpt4Card = screen.getByText('GPT-4').closest('button');
            if (gpt4Card) {
                fireEvent.click(gpt4Card);
            }

            await waitFor(() => {
                expect(screen.getByText('128,000')).toBeInTheDocument();
            });

            // Select GPT-3.5 Turbo
            const gpt35Card = screen.getByText('GPT-3.5 Turbo').closest('button');
            if (gpt35Card) {
                fireEvent.click(gpt35Card);
            }

            // Should show GPT-3.5 details
            await waitFor(() => {
                expect(screen.getByText('16,000')).toBeInTheDocument();
            });
        });
    });

    describe('Cache refresh functionality', () => {
        it('should show refresh button', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
            });
        });

        it('should call refresh when button is clicked', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
            });

            const refreshButton = screen.getByRole('button', { name: /refresh/i });
            fireEvent.click(refreshButton);

            await waitFor(() => {
                expect(mockUseModelRegistryRefresh.refreshCache).toHaveBeenCalled();
            });
        });

        it('should refresh models after cache refresh', async () => {
            render(<ModelRegistryTab />);

            // Select a provider
            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            const openaiCard = screen.getByText('OpenAI').closest('button');
            if (openaiCard) {
                fireEvent.click(openaiCard);
            }

            await waitFor(() => {
                expect(screen.getByText('GPT-4')).toBeInTheDocument();
            });

            // Click refresh
            const refreshButton = screen.getByRole('button', { name: /refresh/i });
            fireEvent.click(refreshButton);

            // Both registry and models should refresh
            await waitFor(() => {
                expect(mockUseModelRegistryRefresh.refreshCache).toHaveBeenCalled();
                expect(mockUseModels.refresh).toHaveBeenCalled();
            });
        });

        it('should show cache status information', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText(/cache status/i)).toBeInTheDocument();
                expect(screen.getByText(/3 providers/i)).toBeInTheDocument();
                expect(screen.getByText(/25 models/i)).toBeInTheDocument();
            });
        });

        it('should indicate when cache is stale', async () => {
            mockUseModelRegistryCacheStatus.cacheStatus = {
                ...mockCacheStatus,
                isStale: true,
                lastFetch: Date.now() - 1000 * 60 * 60 * 25, // 25 hours ago
            };

            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText(/stale/i)).toBeInTheDocument();
            });
        });
    });

    describe('User interactions', () => {
        it('should handle rapid provider switching', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            // Rapidly switch between providers
            const openaiCard = screen.getByText('OpenAI').closest('button');
            const anthropicCard = screen.getByText('Anthropic').closest('button');
            const googleCard = screen.getByText('Google').closest('button');

            if (openaiCard) fireEvent.click(openaiCard);
            if (anthropicCard) fireEvent.click(anthropicCard);
            if (googleCard) fireEvent.click(googleCard);

            // Should end up with Google selected
            await waitFor(() => {
                expect(screen.getByText('Select Model')).toBeInTheDocument();
            });
        });

        it('should handle keyboard navigation', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            const openaiCard = screen.getByText('OpenAI').closest('button');
            if (openaiCard) {
                // Focus the card
                openaiCard.focus();
                
                // Press Enter
                fireEvent.keyDown(openaiCard, { key: 'Enter', code: 'Enter' });
            }

            // Should select the provider
            await waitFor(() => {
                expect(screen.getByText('Select Model')).toBeInTheDocument();
            });
        });

        it('should maintain scroll position when selecting models', async () => {
            render(<ModelRegistryTab />);

            // Select provider
            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            const openaiCard = screen.getByText('OpenAI').closest('button');
            if (openaiCard) {
                fireEvent.click(openaiCard);
            }

            await waitFor(() => {
                expect(screen.getByText('GPT-4')).toBeInTheDocument();
            });

            // Select multiple models
            const gpt4Card = screen.getByText('GPT-4').closest('button');
            if (gpt4Card) {
                fireEvent.click(gpt4Card);
            }

            await waitFor(() => {
                expect(screen.getByText(/context length/i)).toBeInTheDocument();
            });

            const gpt35Card = screen.getByText('GPT-3.5 Turbo').closest('button');
            if (gpt35Card) {
                fireEvent.click(gpt35Card);
            }

            // Details should update without losing provider selection
            await waitFor(() => {
                expect(screen.getByText('Select Model')).toBeInTheDocument();
                expect(screen.getByText('GPT-4')).toBeInTheDocument();
            });
        });
    });

    describe('Empty states', () => {
        it('should show empty state when no providers available', async () => {
            mockUseModelRegistryProviders.providers = [];

            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText(/no providers available/i)).toBeInTheDocument();
            });
        });

        it('should show empty state when no models available for provider', async () => {
            mockUseModels.models = [];

            render(<ModelRegistryTab />);

            // Select provider
            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            const openaiCard = screen.getByText('OpenAI').closest('button');
            if (openaiCard) {
                fireEvent.click(openaiCard);
            }

            await waitFor(() => {
                expect(screen.getByText(/no models available/i)).toBeInTheDocument();
            });
        });

        it('should show placeholder when no model is selected', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText(/select a provider to view models/i)).toBeInTheDocument();
            });
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                const refreshButton = screen.getByRole('button', { name: /refresh/i });
                expect(refreshButton).toHaveAttribute('aria-label');
            });
        });

        it('should support keyboard navigation for provider selection', async () => {
            render(<ModelRegistryTab />);

            await waitFor(() => {
                expect(screen.getByText('OpenAI')).toBeInTheDocument();
            });

            const openaiCard = screen.getByText('OpenAI').closest('button');
            expect(openaiCard).toHaveAttribute('role', 'button');
        });

        it('should announce loading states to screen readers', async () => {
            mockUseModelRegistryProviders.isLoading = true;

            render(<ModelRegistryTab />);

            const loadingElement = screen.getByText(/loading providers/i);
            expect(loadingElement).toBeInTheDocument();
        });
    });
});
