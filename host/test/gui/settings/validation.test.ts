/**
 * Settings Panel - Form Validation Unit Tests
 * 
 * Unit tests for form validation functions
 */

import { describe, it, expect } from 'vitest';
import { validateConfigForm, validateField } from '../../../src/gui/components/settings/validation.js';
import type { ConfigFormData } from '../../../src/gui/components/settings/types.js';
import type { ProviderInfo } from '../../../src/types/llm-config.js';

describe('validateConfigForm', () => {
    const validFormData: ConfigFormData = {
        name: 'Test Config',
        providerId: 'openai',
        model: 'gpt-4',
        apiKey: 'sk-test123',
        baseUrl: '',
        temperature: 0.7,
        maxSteps: 10,
    };

    describe('name validation', () => {
        it('should pass with valid name', () => {
            const result = validateConfigForm(validFormData);
            expect(result.isValid).toBe(true);
            expect(result.errors.name).toBeUndefined();
        });

        it('should fail when name is empty', () => {
            const formData = { ...validFormData, name: '' };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.name).toBe('Configuration name is required');
        });

        it('should fail when name is only whitespace', () => {
            const formData = { ...validFormData, name: '   ' };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.name).toBe('Configuration name is required');
        });

        it('should fail when name is too short (< 3 chars)', () => {
            const formData = { ...validFormData, name: 'ab' };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.name).toBe('Configuration name must be at least 3 characters');
        });

        it('should fail when name is too long (> 50 chars)', () => {
            const formData = { ...validFormData, name: 'a'.repeat(51) };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.name).toBe('Configuration name must not exceed 50 characters');
        });

        it('should pass with name at minimum length (3 chars)', () => {
            const formData = { ...validFormData, name: 'abc' };
            const result = validateConfigForm(formData);
            expect(result.errors.name).toBeUndefined();
        });

        it('should pass with name at maximum length (50 chars)', () => {
            const formData = { ...validFormData, name: 'a'.repeat(50) };
            const result = validateConfigForm(formData);
            expect(result.errors.name).toBeUndefined();
        });
    });

    describe('providerId validation', () => {
        it('should pass with valid providerId', () => {
            const result = validateConfigForm(validFormData);
            expect(result.isValid).toBe(true);
            expect(result.errors.providerId).toBeUndefined();
        });

        it('should fail when providerId is empty', () => {
            const formData = { ...validFormData, providerId: '' };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.providerId).toBe('Provider is required');
        });

        it('should fail when providerId is only whitespace', () => {
            const formData = { ...validFormData, providerId: '   ' };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.providerId).toBe('Provider is required');
        });
    });

    describe('model validation', () => {
        it('should pass with valid model', () => {
            const result = validateConfigForm(validFormData);
            expect(result.isValid).toBe(true);
            expect(result.errors.model).toBeUndefined();
        });

        it('should fail when model is empty', () => {
            const formData = { ...validFormData, model: '' };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.model).toBe('Model is required');
        });

        it('should fail when model is only whitespace', () => {
            const formData = { ...validFormData, model: '   ' };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.model).toBe('Model is required');
        });
    });

    describe('apiKey validation', () => {
        it('should pass when provider does not require API key', () => {
            const provider: ProviderInfo = {
                id: 'openai',
                name: 'OpenAI',
                requiresApiKey: false,
            };
            const formData = { ...validFormData, apiKey: '' };
            const result = validateConfigForm(formData, provider);
            expect(result.errors.apiKey).toBeUndefined();
        });

        it('should fail when provider requires API key and it is empty', () => {
            const provider: ProviderInfo = {
                id: 'openai',
                name: 'OpenAI',
                requiresApiKey: true,
            };
            const formData = { ...validFormData, apiKey: '' };
            const result = validateConfigForm(formData, provider);
            expect(result.isValid).toBe(false);
            expect(result.errors.apiKey).toBe('API key is required for this provider');
        });

        it('should fail when provider requires API key and it is only whitespace', () => {
            const provider: ProviderInfo = {
                id: 'openai',
                name: 'OpenAI',
                requiresApiKey: true,
            };
            const formData = { ...validFormData, apiKey: '   ' };
            const result = validateConfigForm(formData, provider);
            expect(result.isValid).toBe(false);
            expect(result.errors.apiKey).toBe('API key is required for this provider');
        });

        it('should pass when provider requires API key and it is provided', () => {
            const provider: ProviderInfo = {
                id: 'openai',
                name: 'OpenAI',
                requiresApiKey: true,
            };
            const result = validateConfigForm(validFormData, provider);
            expect(result.errors.apiKey).toBeUndefined();
        });
    });

    describe('baseUrl validation', () => {
        it('should pass when baseUrl is empty', () => {
            const formData = { ...validFormData, baseUrl: '' };
            const result = validateConfigForm(formData);
            expect(result.errors.baseUrl).toBeUndefined();
        });

        it('should pass with valid HTTPS URL', () => {
            const formData = { ...validFormData, baseUrl: 'https://api.example.com' };
            const result = validateConfigForm(formData);
            expect(result.errors.baseUrl).toBeUndefined();
        });

        it('should fail with HTTP URL (not HTTPS)', () => {
            const formData = { ...validFormData, baseUrl: 'http://api.example.com' };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.baseUrl).toBe('Base URL must use HTTPS protocol');
        });

        it('should fail with invalid URL format', () => {
            const formData = { ...validFormData, baseUrl: 'not-a-url' };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.baseUrl).toBe('Invalid URL format (e.g., https://api.example.com)');
        });

        it('should fail with malformed URL', () => {
            const formData = { ...validFormData, baseUrl: 'https://' };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.baseUrl).toBe('Invalid URL format (e.g., https://api.example.com)');
        });
    });

    describe('temperature validation', () => {
        it('should pass with valid temperature', () => {
            const result = validateConfigForm(validFormData);
            expect(result.errors.temperature).toBeUndefined();
        });

        it('should pass with temperature at minimum (0)', () => {
            const formData = { ...validFormData, temperature: 0 };
            const result = validateConfigForm(formData);
            expect(result.errors.temperature).toBeUndefined();
        });

        it('should pass with temperature at maximum (1)', () => {
            const formData = { ...validFormData, temperature: 1 };
            const result = validateConfigForm(formData);
            expect(result.errors.temperature).toBeUndefined();
        });

        it('should fail when temperature is below 0', () => {
            const formData = { ...validFormData, temperature: -0.1 };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.temperature).toBe('Temperature must be between 0 and 1');
        });

        it('should fail when temperature is above 1', () => {
            const formData = { ...validFormData, temperature: 1.1 };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.temperature).toBe('Temperature must be between 0 and 1');
        });

        it('should fail when temperature is NaN', () => {
            const formData = { ...validFormData, temperature: NaN };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.temperature).toBe('Temperature must be a number');
        });

        it('should fail when temperature is not a number', () => {
            const formData = { ...validFormData, temperature: '0.7' as any };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.temperature).toBe('Temperature must be a number');
        });
    });

    describe('maxSteps validation', () => {
        it('should pass with valid maxSteps', () => {
            const result = validateConfigForm(validFormData);
            expect(result.errors.maxSteps).toBeUndefined();
        });

        it('should pass with maxSteps at minimum (1)', () => {
            const formData = { ...validFormData, maxSteps: 1 };
            const result = validateConfigForm(formData);
            expect(result.errors.maxSteps).toBeUndefined();
        });

        it('should fail when maxSteps is 0', () => {
            const formData = { ...validFormData, maxSteps: 0 };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.maxSteps).toBe('Max steps must be a positive number');
        });

        it('should fail when maxSteps is negative', () => {
            const formData = { ...validFormData, maxSteps: -5 };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.maxSteps).toBe('Max steps must be a positive number');
        });

        it('should fail when maxSteps is not an integer', () => {
            const formData = { ...validFormData, maxSteps: 10.5 };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.maxSteps).toBe('Max steps must be an integer');
        });

        it('should fail when maxSteps is NaN', () => {
            const formData = { ...validFormData, maxSteps: NaN };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.maxSteps).toBe('Max steps must be a number');
        });

        it('should fail when maxSteps is not a number', () => {
            const formData = { ...validFormData, maxSteps: '10' as any };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(result.errors.maxSteps).toBe('Max steps must be a number');
        });
    });

    describe('multiple validation errors', () => {
        it('should return multiple errors when multiple fields are invalid', () => {
            const formData: ConfigFormData = {
                name: '',
                providerId: '',
                model: '',
                apiKey: '',
                baseUrl: 'http://api.example.com',
                temperature: 2,
                maxSteps: -1,
            };
            const result = validateConfigForm(formData);
            expect(result.isValid).toBe(false);
            expect(Object.keys(result.errors).length).toBeGreaterThan(1);
            expect(result.errors.name).toBeDefined();
            expect(result.errors.providerId).toBeDefined();
            expect(result.errors.model).toBeDefined();
            expect(result.errors.baseUrl).toBeDefined();
            expect(result.errors.temperature).toBeDefined();
            expect(result.errors.maxSteps).toBeDefined();
        });
    });
});

describe('validateField', () => {
    const validFormData: ConfigFormData = {
        name: 'Test Config',
        providerId: 'openai',
        model: 'gpt-4',
        apiKey: 'sk-test123',
        baseUrl: '',
        temperature: 0.7,
        maxSteps: 10,
    };

    it('should return empty string for valid field', () => {
        const error = validateField('name', 'Test Config', validFormData);
        expect(error).toBe('');
    });

    it('should return error message for invalid field', () => {
        const formData = { ...validFormData, name: '' };
        const error = validateField('name', '', formData);
        expect(error).toBe('Configuration name is required');
    });

    it('should validate temperature field', () => {
        const formData = { ...validFormData, temperature: 2 };
        const error = validateField('temperature', 2, formData);
        expect(error).toBe('Temperature must be between 0 and 1');
    });

    it('should validate maxSteps field', () => {
        const formData = { ...validFormData, maxSteps: -1 };
        const error = validateField('maxSteps', -1, formData);
        expect(error).toBe('Max steps must be a positive number');
    });
});
