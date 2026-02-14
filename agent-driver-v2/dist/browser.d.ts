/**
 * @aotui/agent-driver-v2/browser - Browser-Compatible Model Registry
 *
 * Lightweight version of ModelRegistry for browser environments.
 * Only fetches provider and model metadata from models.dev.
 * Does NOT create ProviderRegistry (which requires Node.js modules).
 */
/**
 * models.dev Model
 */
export interface ModelsDevModel {
    id: string;
    name: string;
    family?: string;
    attachment?: boolean;
    reasoning?: boolean;
    tool_call?: boolean;
    temperature?: boolean;
    vision?: boolean;
    release_date?: string;
    last_updated?: string;
    modalities?: {
        input?: string[];
        output?: string[];
    };
    open_weights?: boolean;
    cost?: {
        input?: number;
        output?: number;
        cache_read?: number;
        cache_write?: number;
    };
    limit?: {
        context?: number;
        output?: number;
    };
}
/**
 * models.dev Provider
 */
export interface ModelsDevProvider {
    id: string;
    name: string;
    env?: string[];
    npm?: string;
    api?: string;
    doc?: string;
    models: Record<string, ModelsDevModel>;
}
/**
 * models.dev API Response
 */
export interface ModelsDevAPI {
    [providerId: string]: ModelsDevProvider;
}
/**
 * Provider Configuration
 */
export interface ProviderConfig {
    id: string;
    name: string;
    baseURL: string;
    envKeys: string[];
    supportedModels: string[];
    modelCount: number;
}
/**
 * Model Filter
 */
export interface ModelFilter {
    providerId?: string;
    capability?: 'tool_call' | 'reasoning' | 'vision';
    maxInputCost?: number;
}
/**
 * Browser-Compatible ModelRegistry
 *
 * Simple version for browser environments that only fetches metadata.
 * Does NOT create Provider instances (which require Node.js modules).
 */
export declare class ModelRegistry {
    private modelsDevData;
    private lastFetched;
    /**
     * Fetch models.dev data with caching
     */
    private fetchModelsDevData;
    /**
     * Get all providers
     */
    getProviders(): Promise<ProviderConfig[]>;
    /**
     * Get models with optional filtering
     */
    getModels(filter?: ModelFilter): Promise<ModelsDevModel[]>;
    /**
     * Get a specific provider's configuration
     */
    getProviderConfig(providerId: string): Promise<ProviderConfig | null>;
}
