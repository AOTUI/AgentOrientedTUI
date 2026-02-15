/**
 * ModelTab Component - Property-Based Tests
 * 
 * Property-based tests for ModelTab component using fast-check
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { llmConfigService } from '../../../src/core/llm-config-service.js';
import type { LLMConfigRecord } from '../../../src/types/llm-config.js';
import { initDatabase, getDb } from '../../../src/db/index.js';
import * as llmConfigDb from '../../../src/db/llm-config-db.js';

/**
 * Arbitrary generator for LLMConfigRecord
 */
function arbitraryLLMConfig(overrides?: Partial<LLMConfigRecord>): fc.Arbitrary<LLMConfigRecord> {
    return fc.record({
        id: fc.integer({ min: 1, max: 10000 }),
        name: fc.string({ minLength: 3, maxLength: 50 }),
        model: fc.string({ minLength: 1, maxLength: 100 }),
        providerId: fc.option(fc.string({ minLength: 1 }), { nil: undefined }),
        baseUrl: fc.option(fc.webUrl({ validSchemes: ['https'] }), { nil: undefined }),
        apiKey: fc.option(fc.string({ minLength: 10 }), { nil: undefined }),
        temperature: fc.double({ min: 0, max: 1 }),
        maxSteps: fc.integer({ min: 1, max: 100 }),
        isActive: fc.boolean(),
        createdAt: fc.integer({ min: 1000000000000, max: 9999999999999 }),
        updatedAt: fc.integer({ min: 1000000000000, max: 9999999999999 }),
    }).map(config => ({ ...config, ...overrides }));
}

/**
 * Arbitrary generator for active LLMConfigRecord
 */
function arbitraryActiveLLMConfig(): fc.Arbitrary<LLMConfigRecord> {
    return arbitraryLLMConfig({ isActive: true });
}

/**
 * Arbitrary generator for inactive LLMConfigRecord
 */
function arbitraryInactiveLLMConfig(): fc.Arbitrary<LLMConfigRecord> {
    return arbitraryLLMConfig({ isActive: false });
}

describe('ModelTab - Property-Based Tests', () => {
    // Initialize database before all tests
    beforeAll(async () => {
        await initDatabase(':memory:');
    });

    // Clean up database before and after each test
    beforeEach(() => {
        const db = getDb();
        // Clear all configs
        const configs = llmConfigDb.getAllLLMConfigs(db);
        for (const config of configs) {
            try {
                llmConfigDb.deleteLLMConfig(db, config.id);
            } catch {
                // Ignore errors for active configs
            }
        }
    });

    afterEach(() => {
        const db = getDb();
        // Clear all configs
        const configs = llmConfigDb.getAllLLMConfigs(db);
        for (const config of configs) {
            try {
                llmConfigDb.deleteLLMConfig(db, config.id);
            } catch {
                // Ignore errors for active configs
            }
        }
    });

    /**
     * Feature: settings-panel, Property 2: Configuration Deletion Safety
     * Validates: Requirements 4.6
     * 
     * For any active configuration, attempting to delete it should fail with an error
     */
    it('active configuration cannot be deleted', () => {
        fc.assert(
            fc.property(
                arbitraryActiveLLMConfig(),
                (activeConfigData) => {
                    // Create an active configuration
                    const createdConfig = llmConfigService.createConfig({
                        name: activeConfigData.name,
                        model: activeConfigData.model,
                        providerId: activeConfigData.providerId,
                        baseUrl: activeConfigData.baseUrl,
                        apiKey: activeConfigData.apiKey,
                        temperature: activeConfigData.temperature,
                        maxSteps: activeConfigData.maxSteps,
                    });

                    // Set it as active
                    llmConfigService.setActiveConfig(createdConfig.id);

                    // Verify it's active
                    const activeConfig = llmConfigService.getActiveLLMConfigRecord();
                    expect(activeConfig?.id).toBe(createdConfig.id);

                    // Attempt to delete the active configuration
                    let deletionFailed = false;
                    let errorMessage = '';

                    try {
                        llmConfigService.deleteConfig(createdConfig.id);
                    } catch (err) {
                        deletionFailed = true;
                        errorMessage = err instanceof Error ? err.message : String(err);
                    }

                    // Verify deletion failed
                    const stillExists = llmConfigService.getConfig(createdConfig.id);

                    // Clean up: Create another config and set it as active, then delete the original
                    if (stillExists) {
                        const tempConfig = llmConfigService.createConfig({
                            name: 'Temp Config',
                            model: 'temp-model',
                            providerId: 'temp',
                            temperature: 0.7,
                            maxSteps: 10,
                        });
                        llmConfigService.setActiveConfig(tempConfig.id);
                        llmConfigService.deleteConfig(createdConfig.id);
                        llmConfigService.deleteConfig(tempConfig.id);
                    }

                    // Return property result
                    return (
                        deletionFailed &&
                        errorMessage.toLowerCase().includes('active') &&
                        stillExists !== null
                    );
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any inactive configuration, deletion should succeed
     */
    it('inactive configuration can be deleted', () => {
        fc.assert(
            fc.property(
                arbitraryActiveLLMConfig(),
                arbitraryInactiveLLMConfig(),
                (activeConfigData, inactiveConfigData) => {
                    // Create an active configuration
                    const activeConfig = llmConfigService.createConfig({
                        name: activeConfigData.name,
                        model: activeConfigData.model,
                        providerId: activeConfigData.providerId,
                        baseUrl: activeConfigData.baseUrl,
                        apiKey: activeConfigData.apiKey,
                        temperature: activeConfigData.temperature,
                        maxSteps: activeConfigData.maxSteps,
                    });

                    // Set it as active
                    llmConfigService.setActiveConfig(activeConfig.id);

                    // Create an inactive configuration
                    const inactiveConfig = llmConfigService.createConfig({
                        name: inactiveConfigData.name,
                        model: inactiveConfigData.model,
                        providerId: inactiveConfigData.providerId,
                        baseUrl: inactiveConfigData.baseUrl,
                        apiKey: inactiveConfigData.apiKey,
                        temperature: inactiveConfigData.temperature,
                        maxSteps: inactiveConfigData.maxSteps,
                    });

                    // Verify it's inactive
                    const config = llmConfigService.getConfig(inactiveConfig.id);
                    expect(config?.isActive).toBe(false);

                    // Attempt to delete the inactive configuration
                    let deletionSucceeded = true;

                    try {
                        llmConfigService.deleteConfig(inactiveConfig.id);
                    } catch (err) {
                        deletionSucceeded = false;
                    }

                    // Verify deletion succeeded
                    const stillExists = llmConfigService.getConfig(inactiveConfig.id);

                    // Clean up: Delete the active config
                    const tempConfig = llmConfigService.createConfig({
                        name: 'Temp Config',
                        model: 'temp-model',
                        providerId: 'temp',
                        temperature: 0.7,
                        maxSteps: 10,
                    });
                    llmConfigService.setActiveConfig(tempConfig.id);
                    llmConfigService.deleteConfig(activeConfig.id);
                    llmConfigService.deleteConfig(tempConfig.id);

                    // Return property result
                    return deletionSucceeded && stillExists === null;
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * For any configuration, after deletion attempt, the active configuration should remain unchanged
     */
    it('deletion attempt does not change active configuration', () => {
        fc.assert(
            fc.property(
                arbitraryActiveLLMConfig(),
                arbitraryInactiveLLMConfig(),
                (activeConfigData, inactiveConfigData) => {
                    // Create an active configuration
                    const activeConfig = llmConfigService.createConfig({
                        name: activeConfigData.name,
                        model: activeConfigData.model,
                        providerId: activeConfigData.providerId,
                        baseUrl: activeConfigData.baseUrl,
                        apiKey: activeConfigData.apiKey,
                        temperature: activeConfigData.temperature,
                        maxSteps: activeConfigData.maxSteps,
                    });

                    // Set it as active
                    llmConfigService.setActiveConfig(activeConfig.id);

                    // Create an inactive configuration
                    const inactiveConfig = llmConfigService.createConfig({
                        name: inactiveConfigData.name,
                        model: inactiveConfigData.model,
                        providerId: inactiveConfigData.providerId,
                        baseUrl: inactiveConfigData.baseUrl,
                        apiKey: inactiveConfigData.apiKey,
                        temperature: inactiveConfigData.temperature,
                        maxSteps: inactiveConfigData.maxSteps,
                    });

                    // Get active config before deletion
                    const activeBeforeDeletion = llmConfigService.getActiveLLMConfigRecord();

                    // Attempt to delete the inactive configuration
                    try {
                        llmConfigService.deleteConfig(inactiveConfig.id);
                    } catch {
                        // Ignore errors
                    }

                    // Get active config after deletion
                    const activeAfterDeletion = llmConfigService.getActiveLLMConfigRecord();

                    // Clean up
                    const tempConfig = llmConfigService.createConfig({
                        name: 'Temp Config',
                        model: 'temp-model',
                        providerId: 'temp',
                        temperature: 0.7,
                        maxSteps: 10,
                    });
                    llmConfigService.setActiveConfig(tempConfig.id);
                    llmConfigService.deleteConfig(activeConfig.id);
                    llmConfigService.deleteConfig(tempConfig.id);

                    // Return property result
                    return (
                        activeBeforeDeletion?.id === activeAfterDeletion?.id &&
                        activeAfterDeletion?.id === activeConfig.id
                    );
                }
            ),
            { numRuns: 100 }
        );
    });
});
