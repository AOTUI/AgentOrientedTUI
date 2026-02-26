/**
 * AddProviderModal Component (V3)
 *
 * Modal for adding a new provider configuration.
 * Two modes:
 *   - Template: pick from models.dev catalogue
 *   - Customize: user-defined Base URL + protocol + API Key
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useChatBridge } from '../../ChatBridge.js';
import { ProviderLogo } from './ProviderLogo.js';
import { validateProviderConfig } from './validation.js';
import { useScreenReaderAnnouncement } from './hooks/useScreenReaderAnnouncement.js';
import type {
    AddProviderModalProps,
    NewProviderConfig,
    ProviderConfig,
    NewCustomProviderInput,
    CustomProviderProtocol,
} from './types.js';

// ─── Icon helpers ────────────────────────────────────────────────────────────

const IconClose = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round"
        {...props} className={`w-5 h-5 ${props.className ?? ''}`}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const IconChevronDown = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round"
        {...props} className={`w-4 h-4 ${props.className ?? ''}`}>
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

interface AvailableProvider {
    id: string;
    name: string;
    baseURL: string;
    modelCount: number;
}

type AddMode = 'template' | 'custom';

// ─── Protocol options ─────────────────────────────────────────────────────────

const PROTOCOLS: { value: CustomProviderProtocol; label: string; hint: string }[] = [
    { value: 'openai', label: 'OpenAI API', hint: '/v1/chat/completions compatible' },
    { value: 'anthropic', label: 'Anthropic API', hint: '/v1/messages compatible' },
];

// ─── Shared field wrapper ─────────────────────────────────────────────────────

const Field = React.forwardRef<HTMLDivElement, {
    label: string;
    htmlFor: string;
    required?: boolean;
    error?: string;
    hint?: string;
    children: React.ReactNode;
}>(({ label, htmlFor, required, error, hint, children }, ref) => (
    <div className="flex flex-col gap-1.5" ref={ref}>
        <label htmlFor={htmlFor}
            className="text-[11px] font-medium text-[var(--color-text-secondary)] uppercase tracking-[0.04em]">
            {label}{required && ' *'}
        </label>
        {children}
        {hint && !error && (
            <p className="text-[11px] text-[var(--color-text-tertiary)]">{hint}</p>
        )}
        {error && (
            <p id={`${htmlFor}-error`} className="text-[11px] text-[var(--color-danger)]" role="alert">
                {error}
            </p>
        )}
    </div>
));

const inputBase = `lg-input h-[44px]`;
const inputError = `border-[var(--color-danger)] ring-1 ring-[var(--color-danger)/15]`;

// ─── AddProviderModal ─────────────────────────────────────────────────────────

export const AddProviderModal: React.FC<AddProviderModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onSaveCustom,
}) => {
    const bridge = useChatBridge();
    const { announce } = useScreenReaderAnnouncement();

    // ── shared
    const [mode, setMode] = useState<AddMode>('template');
    const [isSaving, setIsSaving] = useState(false);

    // ── template mode state
    const [availableProviders, setAvailableProviders] = useState<AvailableProvider[]>([]);
    const [selectedProviderId, setSelectedProviderId] = useState('');
    const [customName, setCustomName] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('');
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [templateErrors, setTemplateErrors] = useState<Record<string, string>>({});
    const [isLoadingProviders, setIsLoadingProviders] = useState(false);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [showProviderDropdown, setShowProviderDropdown] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);
    const [providerSearchQuery, setProviderSearchQuery] = useState('');
    const [modelSearchQuery, setModelSearchQuery] = useState('');
    const providerDropdownRef = useRef<HTMLDivElement>(null);
    const modelDropdownRef = useRef<HTMLDivElement>(null);

    // ── custom mode state
    const [customProviderName, setCustomProviderName] = useState('');
    const [customBaseUrl, setCustomBaseUrl] = useState('');
    const [customProtocol, setCustomProtocol] = useState<CustomProviderProtocol>('openai');
    const [customApiKey, setCustomApiKey] = useState('');
    const [customErrors, setCustomErrors] = useState<Record<string, string>>({});

    // ── load providers on open ────────────────────────────────────────────────
    useEffect(() => {
        if (isOpen) fetchProviders();
    }, [isOpen]);

    // ── reset all state on close ──────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) {
            setMode('template'); setIsSaving(false);
            setSelectedProviderId(''); setCustomName(''); setApiKey(''); setModel('');
            setAvailableModels([]); setTemplateErrors({});
            setShowProviderDropdown(false); setShowModelDropdown(false);
            setProviderSearchQuery(''); setModelSearchQuery('');
            setCustomProviderName(''); setCustomBaseUrl('');
            setCustomProtocol('openai'); setCustomApiKey('');
            setCustomErrors({});
        }
    }, [isOpen]);

    // ── outside-click: close dropdowns ───────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        const handle = (e: MouseEvent) => {
            const t = e.target as Node;
            if (providerDropdownRef.current && !providerDropdownRef.current.contains(t)) setShowProviderDropdown(false);
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(t)) setShowModelDropdown(false);
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [isOpen]);

    // ── fetch providers from models.dev ───────────────────────────────────────
    const fetchProviders = async () => {
        setIsLoadingProviders(true);
        try {
            const list = await bridge.getTrpcClient().modelRegistry.getProviders.query();
            setAvailableProviders(list);
        } catch {
            setAvailableProviders([
                { id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', modelCount: 0 },
                { id: 'anthropic', name: 'Anthropic', baseURL: 'https://api.anthropic.com', modelCount: 0 },
                { id: 'google', name: 'Google', baseURL: 'https://generativelanguage.googleapis.com/v1beta', modelCount: 0 },
            ]);
        } finally {
            setIsLoadingProviders(false);
        }
    };

    // ── fetch models for selected template provider ───────────────────────────
    useEffect(() => {
        if (!selectedProviderId) { setAvailableModels([]); setModel(''); return; }
        (async () => {
            setIsLoadingModels(true);
            try {
                const models = await bridge.getTrpcClient().modelRegistry.getModels.query({ providerId: selectedProviderId });
                const ids = models.map((m) => {
                    const prefix = `${selectedProviderId}/`;
                    return m.id.startsWith(prefix) ? m.id.slice(prefix.length) : m.id;
                });
                setAvailableModels(ids);
                if (ids.length > 0 && !model) setModel(ids[0]);
            } catch {
                setAvailableModels([]);
            } finally {
                setIsLoadingModels(false);
            }
        })();
    }, [selectedProviderId]);

    // ── filtered lists ────────────────────────────────────────────────────────
    const filteredProviders = useMemo(() => {
        const q = providerSearchQuery.trim().toLowerCase();
        return q ? availableProviders.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)) : availableProviders;
    }, [availableProviders, providerSearchQuery]);

    const filteredModels = useMemo(() => {
        const q = modelSearchQuery.trim().toLowerCase();
        return q ? availableModels.filter(id => id.toLowerCase().includes(q)) : availableModels;
    }, [availableModels, modelSearchQuery]);

    // ── template: save ────────────────────────────────────────────────────────
    const handleTemplateSave = async () => {
        const config: NewProviderConfig = { providerId: selectedProviderId, customName, apiKey };
        const result = validateProviderConfig(config, []);
        setTemplateErrors(result.errors);
        if (!result.isValid) {
            announce(`Validation errors: ${Object.values(result.errors).join('. ')}`, 'assertive');
            return;
        }
        setIsSaving(true);
        try { await onSave({ ...config, model: model.trim() || undefined }); onClose(); }
        catch { /* parent handles error */ } finally { setIsSaving(false); }
    };

    // ── custom: validate + save ───────────────────────────────────────────────
    const validateCustomForm = (): boolean => {
        const errs: Record<string, string> = {};
        if (!customProviderName.trim()) errs.name = 'Provider name is required.';
        if (!customBaseUrl.trim()) errs.baseUrl = 'Base URL is required.';
        else if (!/^https?:\/\/.+/.test(customBaseUrl.trim())) errs.baseUrl = 'Base URL must start with http:// or https://';
        setCustomErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleCustomSave = async () => {
        if (!validateCustomForm() || !onSaveCustom) return;
        setIsSaving(true);
        try {
            await onSaveCustom({
                name: customProviderName.trim(),
                baseUrl: customBaseUrl.trim(),
                protocol: customProtocol,
                apiKey: customApiKey.trim() || undefined,
            });
            onClose();
        } catch { /* parent handles error */ } finally { setIsSaving(false); }
    };

    // ── Escape key ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    // ── derived helpers ───────────────────────────────────────────────────────
    const selectedProviderObj = availableProviders.find(p => p.id === selectedProviderId);
    const isTemplateSaveDisabled = !selectedProviderId || !customName.trim() || !apiKey.trim() || isSaving;
    const isCustomSaveDisabled = !customProviderName.trim() || !customBaseUrl.trim() || isSaving || !onSaveCustom;

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--mat-overlay-bg)] backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            role="dialog" aria-modal="true" aria-labelledby="add-provider-modal-title"
        >
            <div className="w-full max-w-[560px] mat-lg-regular rounded-[20px] flex flex-col overflow-hidden max-h-[90vh]">
                <div className="flex flex-col overflow-y-auto custom-scrollbar">

                    {/* ── Header ────────────────────────────────────────── */}
                    <div className="flex items-center justify-between px-6 pt-6 pb-4">
                        <h2 id="add-provider-modal-title"
                            className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--color-text-primary)]">
                            Add Provider
                        </h2>
                        <button onClick={onClose}
                            className="p-2 rounded-full hover:bg-[var(--mat-content-card-hover-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                            aria-label="Close modal">
                            <IconClose />
                        </button>
                    </div>

                    {/* ── Mode Tab Switcher ──────────────────────────────── */}
                    <div className="px-6 pb-5">
                        <div className="relative flex h-9 p-1 rounded-full mat-lg-clear shadow-sm w-fit">
                            <span
                                className="absolute top-1 bottom-1 rounded-full bg-white/15 border border-white/10
                                           transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                                style={{
                                    left: mode === 'template' ? '4px' : 'calc(50% + 2px)',
                                    width: 'calc(50% - 6px)',
                                }}
                            />
                            {(['template', 'custom'] as AddMode[]).map((m) => (
                                <button key={m} onClick={() => setMode(m)}
                                    className={`relative z-10 px-5 text-[13px] font-medium rounded-full transition-colors duration-200 select-none
                                        ${mode === m ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}>
                                    {m === 'template' ? 'Template' : 'Customize'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Form Body ─────────────────────────────────────── */}
                    <div className="px-6 pb-6 flex flex-col gap-5">

                        {/* ══════ TEMPLATE TAB ══════ */}
                        {mode === 'template' && (
                            <>
                                {/* Provider picker */}
                                <Field label="Provider" htmlFor="provider-select" required error={templateErrors.providerId}>
                                    <div className="relative" ref={providerDropdownRef}>
                                        <button id="provider-select"
                                            onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                                            disabled={isLoadingProviders || isSaving}
                                            aria-haspopup="listbox" aria-expanded={showProviderDropdown}
                                            className={`${inputBase} flex items-center justify-between gap-3 w-full ${templateErrors.providerId ? inputError : ''} disabled:opacity-50 cursor-pointer hover:bg-[var(--mat-content-card-hover-bg)]`}>
                                            {selectedProviderObj ? (
                                                <div className="flex items-center gap-3">
                                                    <ProviderLogo providerId={selectedProviderObj.id} providerName={selectedProviderObj.name} size="sm" />
                                                    <span className="text-[13px]">{selectedProviderObj.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-[13px] text-[var(--color-text-tertiary)]">
                                                    {isLoadingProviders ? 'Loading providers…' : 'Select a provider'}
                                                </span>
                                            )}
                                            <IconChevronDown className={`transition-transform ${showProviderDropdown ? 'rotate-180' : ''}`} />
                                        </button>
                                        {showProviderDropdown && !isLoadingProviders && (
                                            <div className="absolute top-full left-0 right-0 mt-2 rounded-[16px] mat-lg-clear shadow-xl z-[70] overflow-hidden" role="listbox">
                                                <div className="p-2 border-b border-[var(--color-border)]">
                                                    <input type="text" value={providerSearchQuery}
                                                        onChange={(e) => setProviderSearchQuery(e.target.value)}
                                                        placeholder="Search provider…"
                                                        className="w-full h-8 px-3 rounded-xl mat-content text-[13px] placeholder:text-[var(--color-text-tertiary)] focus:outline-none" />
                                                </div>
                                                <div className="max-h-[168px] overflow-y-auto">
                                                    {filteredProviders.length === 0 && (
                                                        <div className="px-3 py-2 text-[11px] text-[var(--color-text-tertiary)]">No providers found</div>
                                                    )}
                                                    {filteredProviders.map((p) => (
                                                        <button key={p.id}
                                                            onClick={() => { setSelectedProviderId(p.id); setShowProviderDropdown(false); setProviderSearchQuery(''); if (!customName) { setCustomName(p.name); } setTemplateErrors(prev => { const { providerId: _, ...r } = prev; return r; }); }}
                                                            role="option" aria-selected={selectedProviderId === p.id}
                                                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-bg-surface)] text-left transition-colors">
                                                            <ProviderLogo providerId={p.id} providerName={p.name} size="sm" />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">{p.name}</div>
                                                                <div className="text-[11px] text-[var(--color-text-tertiary)]">{p.modelCount} models</div>
                                                            </div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </Field>

                                <Field label="Display Name" htmlFor="t-custom-name" required error={templateErrors.customName}>
                                    <input id="t-custom-name" type="text" value={customName}
                                        onChange={(e) => { setCustomName(e.target.value); setTemplateErrors(prev => { const { customName: _, ...r } = prev; return r; }); }}
                                        disabled={isSaving} placeholder="e.g., My OpenAI Account"
                                        className={`${inputBase} ${templateErrors.customName ? inputError : ''} disabled:opacity-50`} />
                                </Field>

                                <Field label="API Key" htmlFor="t-api-key" required error={templateErrors.apiKey}>
                                    <input id="t-api-key" type="password" value={apiKey}
                                        onChange={(e) => { setApiKey(e.target.value); setTemplateErrors(prev => { const { apiKey: _, ...r } = prev; return r; }); }}
                                        disabled={isSaving} placeholder="sk-…"
                                        className={`${inputBase} font-mono ${templateErrors.apiKey ? inputError : ''} disabled:opacity-50`} />
                                </Field>

                                {selectedProviderId && (
                                    <Field label="Default Model" htmlFor="t-model" hint="Leave empty to configure later in the Model tab.">
                                        {isLoadingModels ? (
                                            <div className={`${inputBase} flex items-center text-[var(--color-text-tertiary)] text-[13px]`}>Loading models…</div>
                                        ) : availableModels.length > 0 ? (
                                            <div className="relative" ref={modelDropdownRef}>
                                                <button id="t-model"
                                                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                                                    disabled={isSaving}
                                                    aria-haspopup="listbox" aria-expanded={showModelDropdown}
                                                    className={`${inputBase} flex items-center justify-between gap-3 w-full disabled:opacity-50 cursor-pointer hover:bg-[var(--mat-content-card-hover-bg)]`}>
                                                    <span className={`text-[13px] truncate ${model ? '' : 'text-[var(--color-text-tertiary)]'}`}>
                                                        {model || 'Select a model'}
                                                    </span>
                                                    <IconChevronDown className={`transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                                                </button>
                                                {showModelDropdown && (
                                                    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-[16px] mat-lg-clear shadow-xl z-[70] overflow-hidden">
                                                        <div className="p-2 border-b border-[var(--color-border)]">
                                                            <input type="text" value={modelSearchQuery}
                                                                onChange={(e) => setModelSearchQuery(e.target.value)}
                                                                placeholder="Search model…"
                                                                className="w-full h-8 px-3 rounded-xl mat-content text-[13px] placeholder:text-[var(--color-text-tertiary)] focus:outline-none" />
                                                        </div>
                                                        <div className="max-h-[168px] overflow-y-auto">
                                                            <button onClick={() => { setModel(''); setShowModelDropdown(false); }}
                                                                className="w-full text-left px-3 py-2 text-[13px] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] transition-colors">
                                                                No default model
                                                            </button>
                                                            {filteredModels.map((id) => (
                                                                <button key={id} onClick={() => { setModel(id); setShowModelDropdown(false); setModelSearchQuery(''); }}
                                                                    className="w-full text-left px-3 py-2 text-[13px] hover:bg-[var(--color-bg-surface)] transition-colors">
                                                                    {id}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <input id="t-model" type="text" value={model}
                                                onChange={(e) => setModel(e.target.value)}
                                                disabled={isSaving} placeholder="e.g., gpt-4o"
                                                className={`${inputBase} disabled:opacity-50`} />
                                        )}
                                    </Field>
                                )}
                            </>
                        )}

                        {/* ══════ CUSTOMIZE TAB ══════ */}
                        {mode === 'custom' && (
                            <>
                                <Field label="Provider Name" htmlFor="c-name" required error={customErrors.name}>
                                    <input id="c-name" type="text" value={customProviderName}
                                        onChange={(e) => { setCustomProviderName(e.target.value); setCustomErrors(prev => { const { name: _, ...r } = prev; return r; }); }}
                                        disabled={isSaving} placeholder="e.g., My LLaMA Server"
                                        className={`${inputBase} ${customErrors.name ? inputError : ''} disabled:opacity-50`} />
                                </Field>

                                <Field label="API Protocol" htmlFor="c-protocol" required>
                                    <div className="grid grid-cols-2 gap-2" id="c-protocol">
                                        {PROTOCOLS.map((proto) => (
                                            <button key={proto.value}
                                                type="button"
                                                onClick={() => setCustomProtocol(proto.value)}
                                                disabled={isSaving}
                                                className={`flex flex-col items-start gap-0.5 p-3 rounded-[10px] border transition-all duration-200 text-left
                                                    ${customProtocol === proto.value
                                                        ? 'border-[var(--color-accent)] bg-[var(--mat-lg-clear-accent-bg)] text-[var(--color-accent)]'
                                                        : 'border-[var(--mat-border)] mat-content text-[var(--color-text-secondary)] hover:border-[var(--mat-border-highlight)] hover:text-[var(--color-text-primary)]'}
                                                    disabled:opacity-50`}>
                                                <span className="text-[13px] font-medium">{proto.label}</span>
                                                <span className={`text-[11px] ${customProtocol === proto.value ? 'text-[var(--color-accent)]/70' : 'text-[var(--color-text-tertiary)]'}`}>{proto.hint}</span>
                                            </button>
                                        ))}
                                    </div>
                                </Field>

                                <Field label="Base URL" htmlFor="c-base-url" required error={customErrors.baseUrl}
                                    hint="The root API endpoint — e.g. https://my-server.com/v1">
                                    <input id="c-base-url" type="url" value={customBaseUrl}
                                        onChange={(e) => { setCustomBaseUrl(e.target.value); setCustomErrors(prev => { const { baseUrl: _, ...r } = prev; return r; }); }}
                                        disabled={isSaving} placeholder="https://api.example.com/v1"
                                        className={`${inputBase} font-mono text-[13px] ${customErrors.baseUrl ? inputError : ''} disabled:opacity-50`} />
                                </Field>

                                <Field label="API Key" htmlFor="c-api-key" hint="Optional — leave blank if your endpoint needs no authentication.">
                                    <input id="c-api-key" type="password" value={customApiKey}
                                        onChange={(e) => setCustomApiKey(e.target.value)}
                                        disabled={isSaving} placeholder="sk-… (optional)"
                                        className={`${inputBase} font-mono disabled:opacity-50`} />
                                </Field>
                            </>
                        )}

                        {/* ── Action Buttons ────────────────────────────── */}
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={onClose} disabled={isSaving}
                                className="lg-btn hover:bg-[var(--mat-content-card-hover-bg)] disabled:opacity-50">
                                Cancel
                            </button>
                            <button
                                onClick={mode === 'template' ? handleTemplateSave : handleCustomSave}
                                disabled={mode === 'template' ? isTemplateSaveDisabled : isCustomSaveDisabled}
                                className="lg-btn rounded-full bg-[var(--color-accent)] text-white border-transparent hover:bg-[var(--color-accent)]/90 px-6 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95">
                                {isSaving ? 'Saving…' : mode === 'custom' ? 'Create Provider' : 'Add Provider'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


