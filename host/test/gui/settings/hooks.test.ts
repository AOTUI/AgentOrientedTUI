/**
 * Settings Hooks - Unit Tests
 * 
 * Unit tests for useProviderConfigs and useModels hooks
 * Focus on testing pure functions (sortProviders, sortModels)
 */

import { describe, it, expect } from 'vitest';
import { sortProviders } from '../../../src/gui/hooks/useProviderConfigs.js';
import { sortModels } from '../../../src/gui/hooks/useModels.js';
import type { ProviderConfig } from '../../../src/gui/hooks/useProviderConfigs.js';
import type { ModelsDevModel } from '@aotui/agent-driver-v2';

describe('sortProviders - Unit Tests', () => {
    it('should sort providers with active first', () => {
        const providers: ProviderConfig[] = [
            {
                id: 1,
                providerId: 'test1',
                customName: 'Provider 1',
                apiKey: 'key1',
                isActive: false,
                model: 'model1',
                temperature: 0.7,
                maxSteps: 10,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            {
                id: 2,
                providerId: 'test2',
                customName: 'Provider 2',
                apiKey: 'key2',
                isActive: true,
                model: 'model2',
                temperature: 0.7,
                maxSteps: 10,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            {
                id: 3,
                providerId: 'test3',
                customName: 'Provider 3',
                apiKey: 'key3',
                isActive: false,
                model: 'model3',
                temperature: 0.7,
                maxSteps: 10,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        ];

        const sorted = sortProviders(providers);

        expect(sorted[0].id).toBe(2);
        expect(sorted[0].isActive).toBe(true);
    });

    it('should not modify original array when sorting', () => {
        const providers: ProviderConfig[] = [
            {
                id: 1,
                providerId: 'test1',
                customName: 'Provider 1',
                apiKey: 'key1',
                isActive: false,
                model: 'model1',
                temperature: 0.7,
                maxSteps: 10,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            {
                id: 2,
                providerId: 'test2',
                customName: 'Provider 2',
                apiKey: 'key2',
                isActive: true,
                model: 'model2',
                temperature: 0.7,
                maxSteps: 10,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        ];

        const originalIds = providers.map(p => p.id);
        sortProviders(providers);
        const currentIds = providers.map(p => p.id);

        expect(originalIds).toEqual(currentIds);
    });

    it('should handle empty array', () => {
        const providers: ProviderConfig[] = [];
        const sorted = sortProviders(providers);

        expect(sorted).toEqual([]);
    });

    it('should handle all inactive providers', () => {
        const providers: ProviderConfig[] = [
            {
                id: 1,
                providerId: 'test1',
                customName: 'Provider 1',
                apiKey: 'key1',
                isActive: false,
                model: 'model1',
                temperature: 0.7,
                maxSteps: 10,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
            {
                id: 2,
                providerId: 'test2',
                customName: 'Provider 2',
                apiKey: 'key2',
                isActive: false,
                model: 'model2',
                temperature: 0.7,
                maxSteps: 10,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            },
        ];

        const sorted = sortProviders(providers);

        // Order should remain unchanged
        expect(sorted[0].id).toBe(1);
        expect(sorted[1].id).toBe(2);
    });
});

describe('sortModels - Unit Tests', () => {
    it('should sort models with active model first', () => {
        const models: ModelsDevModel[] = [
            {
                id: 'openai/gpt-4',
                name: 'GPT-4',
            },
            {
                id: 'openai/gpt-3.5-turbo',
                name: 'GPT-3.5 Turbo',
            },
            {
                id: 'openai/gpt-4-turbo',
                name: 'GPT-4 Turbo',
            },
        ];

        const sorted = sortModels(models, 'openai/gpt-3.5-turbo');

        expect(sorted[0].id).toBe('openai/gpt-3.5-turbo');
    });

    it('should not change order when no active model', () => {
        const models: ModelsDevModel[] = [
            {
                id: 'openai/gpt-4',
                name: 'GPT-4',
            },
            {
                id: 'openai/gpt-3.5-turbo',
                name: 'GPT-3.5 Turbo',
            },
        ];

        const sorted = sortModels(models, null);

        expect(sorted[0].id).toBe('openai/gpt-4');
        expect(sorted[1].id).toBe('openai/gpt-3.5-turbo');
    });

    it('should not change order when active model not found', () => {
        const models: ModelsDevModel[] = [
            {
                id: 'openai/gpt-4',
                name: 'GPT-4',
            },
            {
                id: 'openai/gpt-3.5-turbo',
                name: 'GPT-3.5 Turbo',
            },
        ];

        const sorted = sortModels(models, 'nonexistent/model');

        expect(sorted[0].id).toBe('openai/gpt-4');
        expect(sorted[1].id).toBe('openai/gpt-3.5-turbo');
    });

    it('should not modify original array when sorting', () => {
        const models: ModelsDevModel[] = [
            {
                id: 'openai/gpt-4',
                name: 'GPT-4',
            },
            {
                id: 'openai/gpt-3.5-turbo',
                name: 'GPT-3.5 Turbo',
            },
        ];

        const originalIds = models.map(m => m.id);
        sortModels(models, 'openai/gpt-3.5-turbo');
        const currentIds = models.map(m => m.id);

        expect(originalIds).toEqual(currentIds);
    });

    it('should handle empty array', () => {
        const models: ModelsDevModel[] = [];
        const sorted = sortModels(models, 'some-model');

        expect(sorted).toEqual([]);
    });

    it('should handle single model', () => {
        const models: ModelsDevModel[] = [
            {
                id: 'openai/gpt-4',
                name: 'GPT-4',
            },
        ];

        const sorted = sortModels(models, 'openai/gpt-4');

        expect(sorted.length).toBe(1);
        expect(sorted[0].id).toBe('openai/gpt-4');
    });
});
