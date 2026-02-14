import type { LLMConfig } from './interfaces.js';
export interface ModelTarget {
    providerId: string;
    modelName: string;
    registryModelId: string;
}
export interface ProviderFactoryDeps {
    config: LLMConfig;
    target: ModelTarget;
    warn: (message: string) => void;
}
export declare function createLanguageModel(deps: ProviderFactoryDeps): import("@openrouter/ai-sdk-provider").LanguageModelV3;
