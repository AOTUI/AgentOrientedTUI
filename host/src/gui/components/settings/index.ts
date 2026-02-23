/**
 * Settings Panel - Barrel Export
 * 
 * Central export point for all Settings Panel components and types
 */

// ============================================================================
// V1 Types (Existing)
// ============================================================================
export type {
    SettingsPanelProps,
    SettingsPanelState,
    SettingsSidebarProps,
    ModelTabProps,
    ModelTabState,
    ConfigFormData,
    ConfigCardProps,
    ConfigFormProps,
    ConfigFormState,
    ThemeTabProps,
    ThemeCardProps,
    ProviderLogoProps,
    ValidationErrors,
    ValidationResult,
} from './types.js';

// ============================================================================
// V2 Types (Provider-first approach)
// ============================================================================
export type {
    ProviderConfig,
    NewProviderConfig,
    ProviderUpdates,
    ModelTabHeaderProps,
    ProviderRowProps,
    ProviderCardProps,
    ModelSearchBarProps,
    ModelListProps,
    ModelCardProps,
    AddProviderModalProps,
    AddProviderModalState,
    EditProviderModalProps,
    DeleteConfirmDialogProps,
    ProviderSearchBarProps,
} from './types.js';

// Utilities
export { validateConfigForm, validateField } from './validation.js';
export { filterProviders, filterModels } from './filters.js';

// Components
export { SettingsPanel } from './SettingsPanel.js';
export { SettingsSidebar } from './SettingsSidebar.js';
export { ModelTab } from './ModelTab.js';
export { ModelRegistryTab } from './ModelRegistryTab.js';
export { ConfigCard } from './ConfigCard.js';
export { ConfigForm } from './ConfigForm.js';
export { ThemeTab } from './ThemeTab.js';
export { AppsTab } from './apps/AppsTab.js';
export { ThemeCard } from './ThemeCard.js';
export { ProviderLogo } from './ProviderLogo.js';
export { ProviderCard } from './ProviderCard.js';
export { ProviderRow } from './ProviderRow.js';
export { ProviderSelector } from './ProviderSelector.js';
export { ModelCard } from './ModelCard.js';
export { ModelList } from './ModelList.js';
export { ModelSelector } from './ModelSelector.js';
export { ModelDetails } from './ModelDetails.js';
export { ModelRegistryRefresh } from './ModelRegistryRefresh.js';
export { ModelTabHeader } from './ModelTabHeader.js';
export { ProviderSearchBar } from './ProviderSearchBar.js';
export { ModelSearchBar } from './ModelSearchBar.js';
export { AddProviderModal } from './AddProviderModal.js';
export { EditProviderModal } from './EditProviderModal.js';
export { DeleteConfirmDialog } from './DeleteConfirmDialog.js';
export { SettingsErrorBoundary } from './SettingsErrorBoundary.js';
export { Spinner } from './Spinner.js';
export { LoadingState } from './LoadingState.js';
export { ToastNotification } from './ToastNotification.js';
export type { ToastType, ToastNotificationProps } from './ToastNotification.js';

// Hooks
export { useToast } from './hooks/useToast.js';
export type { ToastState, UseToastReturn } from './hooks/useToast.js';
