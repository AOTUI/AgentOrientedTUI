/**
 * Settings Panel - Form Validation Utilities
 * 
 * Validation functions for configuration form inputs
 */

import type { ConfigFormData, ValidationErrors, ValidationResult, ProviderConfig, NewProviderConfig } from './types.js';
import type { ProviderInfo } from '../../../types/llm-config.js';

/**
 * Validates a configuration form
 * 
 * @param formData - The form data to validate
 * @param selectedProvider - The selected provider (for API key requirement check)
 * @returns Validation result with errors
 */
export function validateConfigForm(
    formData: ConfigFormData,
    selectedProvider?: ProviderInfo | null
): ValidationResult {
    const errors: ValidationErrors = {};

    // Validate name (required, min 3 chars, max 50 chars)
    if (!formData.name || formData.name.trim().length === 0) {
        errors.name = 'Configuration name is required';
    } else if (formData.name.trim().length < 3) {
        errors.name = 'Configuration name must be at least 3 characters';
    } else if (formData.name.length > 50) {
        errors.name = 'Configuration name must not exceed 50 characters';
    }

    // Validate providerId (required)
    if (!formData.providerId || formData.providerId.trim().length === 0) {
        errors.providerId = 'Provider is required';
    }

    // Validate model (required)
    if (!formData.model || formData.model.trim().length === 0) {
        errors.model = 'Model is required';
    }

    // Validate API key (required if provider requires it)
    if (selectedProvider?.requiresApiKey) {
        if (!formData.apiKey || formData.apiKey.trim().length === 0) {
            errors.apiKey = 'API key is required for this provider';
        }
    }

    // Validate base URL (optional, but must be valid URL if provided)
    if (formData.baseUrl && formData.baseUrl.trim().length > 0) {
        try {
            const url = new URL(formData.baseUrl);
            // Enforce HTTPS for security
            if (url.protocol !== 'https:') {
                errors.baseUrl = 'Base URL must use HTTPS protocol';
            }
        } catch {
            errors.baseUrl = 'Invalid URL format (e.g., https://api.example.com)';
        }
    }

    // Validate temperature (must be between 0 and 1)
    if (typeof formData.temperature !== 'number' || isNaN(formData.temperature)) {
        errors.temperature = 'Temperature must be a number';
    } else if (formData.temperature < 0 || formData.temperature > 1) {
        errors.temperature = 'Temperature must be between 0 and 1';
    }

    // Validate maxSteps (must be positive integer)
    if (typeof formData.maxSteps !== 'number' || isNaN(formData.maxSteps)) {
        errors.maxSteps = 'Max steps must be a number';
    } else if (!Number.isInteger(formData.maxSteps)) {
        errors.maxSteps = 'Max steps must be an integer';
    } else if (formData.maxSteps <= 0) {
        errors.maxSteps = 'Max steps must be a positive number';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}

/**
 * Validates a single field
 * 
 * @param fieldName - The field to validate
 * @param value - The field value
 * @param formData - The complete form data (for context)
 * @param selectedProvider - The selected provider (for API key requirement check)
 * @returns Error message or empty string if valid
 */
export function validateField(
    fieldName: keyof ConfigFormData,
    value: any,
    formData: ConfigFormData,
    selectedProvider?: ProviderInfo | null
): string {
    const result = validateConfigForm(formData, selectedProvider);
    return result.errors[fieldName] || '';
}

// ============================================================================
// V2 Provider Configuration Validation
// ============================================================================

/**
 * Validates a provider configuration (V2)
 * 
 * Validates provider ID, custom name, and API key according to requirements:
 * - Provider ID: Required, not empty
 * - Custom Name: Required, not empty, min 3 chars, unique
 * - API Key: Required, not empty, min 10 chars
 * 
 * @param config - The provider configuration to validate
 * @param existingProviders - Array of existing provider configurations (for uniqueness check)
 * @returns Validation result with errors
 * 
 * Requirements: 5.6, 5.7, 5.8
 */
export function validateProviderConfig(
    config: NewProviderConfig,
    existingProviders: ProviderConfig[] = []
): ValidationResult {
    const errors: ValidationErrors = {};

    // Validate provider ID (required, not empty)
    if (!config.providerId || config.providerId.trim().length === 0) {
        errors.providerId = 'Provider is required';
    }

    // Validate custom name (required, not empty, min 3 chars, unique)
    const trimmedCustomName = config.customName?.trim() || '';
    if (!config.customName || trimmedCustomName.length === 0) {
        errors.customName = 'Custom name is required';
    } else if (trimmedCustomName.length < 3) {
        errors.customName = 'Custom name must be at least 3 characters';
    } else {
        // Check uniqueness (case-insensitive)
        const normalizedName = trimmedCustomName.toLowerCase();
        const isDuplicate = existingProviders.some(
            provider => provider.customName.trim().toLowerCase() === normalizedName
        );
        if (isDuplicate) {
            errors.customName = 'This name is already in use';
        }
    }

    // Validate API key (required, not empty, min 10 chars)
    const trimmedApiKey = config.apiKey?.trim() || '';
    if (!config.apiKey || trimmedApiKey.length === 0) {
        errors.apiKey = 'API key is required';
    } else if (trimmedApiKey.length < 10) {
        errors.apiKey = 'API key must be at least 10 characters';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}

/**
 * Validates provider name uniqueness
 * 
 * @param customName - The custom name to validate
 * @param existingProviders - Array of existing provider configurations
 * @param excludeId - Optional ID to exclude from uniqueness check (for editing)
 * @returns Validation result
 * 
 * Requirements: 5.6
 */
export function validateProviderNameUniqueness(
    customName: string,
    existingProviders: ProviderConfig[],
    excludeId?: number
): ValidationResult {
    const errors: ValidationErrors = {};

    const trimmedName = customName?.trim() || '';
    if (!customName || trimmedName.length === 0) {
        errors.customName = 'Custom name is required';
        return { isValid: false, errors };
    }

    const normalizedName = trimmedName.toLowerCase();
    const isDuplicate = existingProviders.some(
        provider => 
            provider.customName.trim().toLowerCase() === normalizedName &&
            provider.id !== excludeId
    );

    if (isDuplicate) {
        errors.customName = 'This name is already in use';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
    };
}
