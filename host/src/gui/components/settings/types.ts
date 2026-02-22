/**
 * Settings Panel - Type Definitions
 * 
 * TypeScript interfaces for all Settings Panel components
 */

import type { LLMConfigRecord, ProviderInfo } from '../../../types/llm-config.js';
import type { ModelsDevModel } from '../../../services/index.js';

/**
 * SettingsPanel Component Props
 * 
 * Root modal container that manages tab navigation and content display
 */
export interface SettingsPanelProps {
    /** Whether the settings panel is open */
    isOpen: boolean;
    /** Callback when the panel should close */
    onClose: () => void;
    /** Current theme */
    theme: 'dark' | 'light';
    /** Callback when theme changes */
    onThemeChange: (theme: 'dark' | 'light') => void;
}

/**
 * SettingsPanel Component State
 */
export interface SettingsPanelState {
    /** Currently active tab */
    activeTab: 'model' | 'theme' | 'mcp';
}

/**
 * SettingsSidebar Component Props
 * 
 * Left sidebar containing tab navigation buttons
 */
export interface SettingsSidebarProps {
    /** Currently active tab */
    activeTab: 'model' | 'theme' | 'mcp';
    /** Callback when tab changes */
    onTabChange: (tab: 'model' | 'theme' | 'mcp') => void;
}

/**
 * ModelTab Component Props
 * 
 * Displays and manages LLM model configurations
 */
export interface ModelTabProps {
    // No props needed - fetches data from services
}

/**
 * ModelTab Component State
 */
export interface ModelTabState {
    /** All saved configurations */
    configs: LLMConfigRecord[];
    /** ID of the active configuration */
    activeConfigId: number | null;
    /** Whether the configuration form is visible */
    showForm: boolean;
    /** ID of the configuration being edited (null for new) */
    editingConfigId: number | null;
    /** Available providers from models.dev */
    providers: ProviderInfo[];
    /** Currently selected provider in the form */
    selectedProvider: ProviderInfo | null;
    /** Available models for the selected provider */
    availableModels: ModelsDevModel[];
    /** Form data */
    formData: ConfigFormData;
    /** Validation errors */
    validationErrors: Record<string, string>;
    /** Loading state for providers */
    loadingProviders: boolean;
    /** Loading state for models */
    loadingModels: boolean;
}

/**
 * Configuration Form Data
 */
export interface ConfigFormData {
    /** Configuration name */
    name: string;
    /** Provider ID */
    providerId: string;
    /** Model identifier */
    model: string;
    /** API key */
    apiKey: string;
    /** Custom base URL */
    baseUrl: string;
    /** Temperature (0-1) */
    temperature: number;
    /** Max steps */
    maxSteps: number;
}

/**
 * ConfigCard Component Props
 * 
 * Displays a single model configuration with actions
 */
export interface ConfigCardProps {
    /** Configuration to display */
    config: LLMConfigRecord;
    /** Whether this is the active configuration */
    isActive: boolean;
    /** Callback when configuration is selected */
    onSelect: (id: number) => void;
    /** Callback when edit button is clicked */
    onEdit: (id: number) => void;
    /** Callback when delete button is clicked */
    onDelete: (id: number) => void;
}

/**
 * ConfigForm Component Props
 * 
 * Form for adding or editing model configurations
 */
export interface ConfigFormProps {
    /** Configuration being edited (null for new) */
    editingConfig: LLMConfigRecord | null;
    /** Available providers */
    providers: ProviderInfo[];
    /** Callback when form is saved */
    onSave: (data: ConfigFormData) => Promise<void>;
    /** Callback when form is cancelled */
    onCancel: () => void;
}

/**
 * ConfigForm Component State
 */
export interface ConfigFormState {
    /** Form data */
    formData: ConfigFormData;
    /** Currently selected provider */
    selectedProvider: ProviderInfo | null;
    /** Available models for selected provider */
    availableModels: ModelsDevModel[];
    /** Validation errors */
    validationErrors: Record<string, string>;
    /** Loading state for models */
    isLoadingModels: boolean;
}

/**
 * ThemeTab Component Props
 * 
 * Displays theme selection cards
 */
export interface ThemeTabProps {
    /** Current theme */
    currentTheme: 'dark' | 'light';
    /** Callback when theme changes */
    onThemeChange: (theme: 'dark' | 'light') => void;
}

/**
 * ThemeCard Component Props
 * 
 * Displays a single theme option with preview
 */
export interface ThemeCardProps {
    /** Theme to display */
    theme: 'dark' | 'light';
    /** Whether this is the active theme */
    isActive: boolean;
    /** Callback when theme is selected */
    onSelect: () => void;
}

/**
 * ProviderLogo Component Props
 * 
 * Displays provider logo with fallback handling
 */
export interface ProviderLogoProps {
    /** Provider ID (used to construct logo URL) */
    providerId: string;
    /** Provider name (used for fallback initial) */
    providerName: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg' | 'fill';
    /** Additional CSS classes */
    className?: string;
}

/**
 * Validation Error Object
 * 
 * Maps field names to error messages
 */
export type ValidationErrors = Record<string, string>;

/**
 * Form Validation Result
 */
export interface ValidationResult {
    /** Whether the form is valid */
    isValid: boolean;
    /** Validation errors by field */
    errors: ValidationErrors;
}

// ============================================================================
// Settings Panel V2 Types
// ============================================================================

/**
 * Provider Configuration (V2)
 * 
 * Represents a configured provider with custom name and API key
 */
export interface ProviderConfig {
    /** Database ID */
    id: number;
    /** Provider ID from models.dev (e.g., 'openai', 'anthropic') */
    providerId: string;
    /** User-defined custom name */
    customName: string;
    /** Encrypted API key */
    apiKey: string;
    /** Whether this is the active provider */
    isActive: boolean;
    /** Active model for this provider */
    model: string;
    /** Temperature setting */
    temperature: number;
    /** Max steps setting */
    maxSteps: number;
    /** Creation timestamp */
    createdAt: number;
    /** Last update timestamp */
    updatedAt: number;
}

/**
 * New Provider Configuration Input (V2)
 * 
 * Data required to create a new provider configuration
 */
export interface NewProviderConfig {
    /** Provider ID from models.dev */
    providerId: string;
    /** User-defined custom name */
    customName: string;
    /** API key */
    apiKey: string;
    /** Optional model */
    model?: string;
    /** Optional temperature */
    temperature?: number;
    /** Optional max steps */
    maxSteps?: number;
}

/**
 * Provider Updates (V2)
 * 
 * Fields that can be updated for an existing provider
 */
export interface ProviderUpdates {
    /** Updated custom name */
    customName?: string;
    /** Updated API key */
    apiKey?: string;
    /** Updated model */
    model?: string;
    /** Updated temperature */
    temperature?: number;
    /** Updated max steps */
    maxSteps?: number;
}

/**
 * ModelTabHeader Component Props (V2)
 */
export interface ModelTabHeaderProps {
    /** Current search query */
    searchQuery: string;
    /** Callback when search query changes */
    onSearchChange: (query: string) => void;
    /** Callback when add provider button is clicked */
    onAddProvider: () => void;
}

/**
 * ProviderRow Component Props (V2)
 */
export interface ProviderRowProps {
    /** List of providers */
    providers: ProviderConfig[];
    /** Database ID of the selected provider config */
    selectedProviderId: number | null;
    /** Provider ID of the active provider (for backward compatibility, not used) */
    activeProviderId: string | null;
    /** Callback when provider is selected */
    onSelectProvider: (providerConfigId: number) => void;
    /** Callback when edit button is clicked */
    onEditProvider: (provider: ProviderConfig) => void;
    /** Callback when delete button is clicked */
    onDeleteProvider: (provider: ProviderConfig) => void;
    /** Callback when add provider button is clicked */
    onAddProvider?: () => void;
}

/**
 * ProviderCard Component Props (V2)
 */
export interface ProviderCardProps {
    /** Provider to display */
    provider: ProviderConfig;
    /** Whether this provider is selected */
    isSelected: boolean;
    /** Whether this is the active provider */
    isActive: boolean;
    /** Callback when card is clicked */
    onSelect: () => void;
    /** Callback when edit button is clicked */
    onEdit: () => void;
    /** Callback when delete button is clicked */
    onDelete: () => void;
}

/**
 * ModelSearchBar Component Props (V2)
 */
export interface ModelSearchBarProps {
    /** Current search query */
    searchQuery: string;
    /** Callback when search query changes */
    onSearchChange: (query: string) => void;
    /** Whether the search bar is disabled */
    disabled?: boolean;
}

/**
 * ModelList Component Props (V2)
 */
export interface ModelListProps {
    /** List of models */
    models: ModelsDevModel[];
    /** ID of the active model */
    activeModelId: string | null;
    /** Callback when model is selected */
    onSelectModel: (modelId: string) => void;
    /** Whether models are loading */
    isLoading?: boolean;
}

/**
 * ModelCard Component Props (V2)
 */
export interface ModelCardProps {
    /** Model to display */
    model: ModelsDevModel;
    /** Whether this is the active model */
    isActive: boolean;
    /** Callback when card is clicked */
    onSelect: () => void;
}

/**
 * AddProviderModal Component Props (V2)
 */
export interface AddProviderModalProps {
    /** Whether the modal is open */
    isOpen: boolean;
    /** Callback when modal should close */
    onClose: () => void;
    /** Callback when provider is saved */
    onSave: (config: NewProviderConfig) => Promise<void>;
}

/**
 * AddProviderModal Component State (V2)
 */
export interface AddProviderModalState {
    /** Available providers from models.dev */
    availableProviders: ProviderInfo[];
    /** Selected provider ID */
    selectedProviderId: string;
    /** Custom name input */
    customName: string;
    /** API key input */
    apiKey: string;
    /** Validation errors */
    validationErrors: ValidationErrors;
    /** Whether providers are loading */
    isLoading: boolean;
    /** Whether save is in progress */
    isSaving: boolean;
}

/**
 * EditProviderModal Component Props (V2)
 */
export interface EditProviderModalProps {
    /** Whether the modal is open */
    isOpen: boolean;
    /** Provider being edited */
    provider: ProviderConfig | null;
    /** Callback when modal should close */
    onClose: () => void;
    /** Callback when provider is saved */
    onSave: (id: number, updates: ProviderUpdates) => Promise<void>;
}

/**
 * DeleteConfirmDialog Component Props (V2)
 */
export interface DeleteConfirmDialogProps {
    /** Whether the dialog is open */
    isOpen: boolean;
    /** Name of the provider being deleted */
    providerName: string;
    /** Whether this is the active provider */
    isActive: boolean;
    /** Callback when dialog should close */
    onClose: () => void;
    /** Callback when delete is confirmed */
    onConfirm: () => void;
}

/**
 * ProviderSearchBar Component Props (V2)
 */
export interface ProviderSearchBarProps {
    /** Current search query */
    searchQuery: string;
    /** Callback when search query changes */
    onSearchChange: (query: string) => void;
}
