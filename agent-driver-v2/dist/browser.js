/**
 * @aotui/agent-driver-v2/browser - Browser-Compatible Model Registry
 *
 * Lightweight version of ModelRegistry for browser environments.
 * Only fetches provider and model metadata from models.dev.
 * Does NOT create ProviderRegistry (which requires Node.js modules).
 */
/**
 * models.dev API URL
 */
const MODELS_DEV_URL = 'https://models.dev/api/v1/all';
/**
 * Cache duration: 24 hours
 */
const CACHE_TTL = 24 * 60 * 60 * 1000;
/**
 * Browser-Compatible ModelRegistry
 *
 * Simple version for browser environments that only fetches metadata.
 * Does NOT create Provider instances (which require Node.js modules).
 */
export class ModelRegistry {
    modelsDevData = null;
    lastFetched = 0;
    /**
     * Fetch models.dev data with caching
     */
    async fetchModelsDevData() {
        const now = Date.now();
        // Return cached data if still valid
        if (this.modelsDevData && (now - this.lastFetched) < CACHE_TTL) {
            return this.modelsDevData;
        }
        try {
            const response = await fetch(MODELS_DEV_URL);
            if (!response.ok) {
                throw new Error(`models.dev API returned ${response.status}`);
            }
            const data = (await response.json());
            this.modelsDevData = data;
            this.lastFetched = now;
            return data;
        }
        catch (error) {
            console.error('[ModelRegistry] Failed to fetch models.dev data:', error);
            // Return cached data if available, even if expired
            if (this.modelsDevData) {
                console.warn('[ModelRegistry] Using expired cache due to fetch error');
                return this.modelsDevData;
            }
            throw error;
        }
    }
    /**
     * Get all providers
     */
    async getProviders() {
        const data = await this.fetchModelsDevData();
        return Object.values(data).map(provider => ({
            id: provider.id,
            name: provider.name,
            baseURL: provider.api || '',
            envKeys: provider.env || [],
            supportedModels: Object.keys(provider.models),
            modelCount: Object.keys(provider.models).length,
        }));
    }
    /**
     * Get models with optional filtering
     */
    async getModels(filter) {
        const data = await this.fetchModelsDevData();
        let models = [];
        // Collect models from all providers
        for (const [providerId, provider] of Object.entries(data)) {
            // Filter by provider if specified
            if (filter?.providerId && providerId !== filter.providerId) {
                continue;
            }
            Object.values(provider.models).forEach(model => {
                // Filter by capability
                if (filter?.capability) {
                    const hasCapability = model[filter.capability];
                    if (!hasCapability)
                        return;
                }
                // Filter by max input cost
                if (filter?.maxInputCost && model.cost?.input) {
                    if (model.cost.input > filter.maxInputCost)
                        return;
                }
                models.push(model);
            });
        }
        return models;
    }
    /**
     * Get a specific provider's configuration
     */
    async getProviderConfig(providerId) {
        const data = await this.fetchModelsDevData();
        const provider = data[providerId];
        if (!provider) {
            return null;
        }
        return {
            id: provider.id,
            name: provider.name,
            baseURL: provider.api || '',
            envKeys: provider.env || [],
            supportedModels: Object.keys(provider.models),
            modelCount: Object.keys(provider.models).length,
        };
    }
}
