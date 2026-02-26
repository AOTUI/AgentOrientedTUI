/**
 * CustomProviderDetail Component
 *
 * Detail panel for a selected Custom Provider.
 * Shows provider metadata (editable), the list of manually-added models,
 * and controls to add/delete/activate models and delete the provider.
 */

import React, { useState } from 'react';
import { DeleteConfirmDialog } from './DeleteConfirmDialog.js';
import type {
    CustomProviderRecord,
    CustomProviderDetailProps,
    CustomProviderProtocol,
} from './types.js';

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconEdit = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);
const IconTrash = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
);
const IconCheck = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);
const IconPlus = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);
const IconX = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

// ─── Small action button ──────────────────────────────────────────────────────

const Btn: React.FC<{
    onClick: () => void;
    disabled?: boolean;
    variant?: 'default' | 'danger' | 'accent';
    title?: string;
    children: React.ReactNode;
}> = ({ onClick, disabled, variant = 'default', title, children }) => {
    const base = 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed';
    const color = variant === 'danger'
        ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10'
        : variant === 'accent'
            ? 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90 border-transparent'
            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--mat-content-card-hover-bg)]';
    return (
        <button className={`${base} ${color}`} onClick={onClick} disabled={disabled} title={title}>
            {children}
        </button>
    );
};

// ─── Protocol badge ───────────────────────────────────────────────────────────

const ProtocolBadge: React.FC<{ protocol: CustomProviderProtocol }> = ({ protocol }) => (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-[0.05em]
        bg-[var(--mat-lg-clear-accent-bg)] text-[var(--color-accent)] border border-[var(--color-accent)]/20">
        {protocol === 'openai' ? 'OpenAI API' : 'Anthropic API'}
    </span>
);

// ─── Editable info row ────────────────────────────────────────────────────────

const InfoRow: React.FC<{
    label: string;
    value: string;
    editing: boolean;
    inputType?: string;
    inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
    onChange: (v: string) => void;
}> = ({ label, value, editing, inputType = 'text', inputProps, onChange }) => (
    <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">{label}</span>
        {editing ? (
            <input
                type={inputType}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="lg-input h-9 text-[13px]"
                {...inputProps}
            />
        ) : (
            <span className="text-[13px] text-[var(--color-text-primary)] truncate font-mono break-all">
                {value || <span className="text-[var(--color-text-tertiary)] italic">—</span>}
            </span>
        )}
    </div>
);

// ─── PROTOCOLS ────────────────────────────────────────────────────────────────

const PROTOCOL_OPTIONS: { value: CustomProviderProtocol; label: string }[] = [
    { value: 'openai', label: 'OpenAI API' },
    { value: 'anthropic', label: 'Anthropic API' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export const CustomProviderDetail: React.FC<CustomProviderDetailProps> = ({
    provider,
    linkedConfigs,
    isActive,
    onUpdate,
    onDelete,
    onAddModel,
    onDeleteModel,
    onActivateModel,
}) => {
    // ── edit state
    const [editing, setEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [editBaseUrl, setEditBaseUrl] = useState('');
    const [editProtocol, setEditProtocol] = useState<CustomProviderProtocol>('openai');
    const [editApiKey, setEditApiKey] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // ── delete provider dialog
    const [showDeleteProviderDialog, setShowDeleteProviderDialog] = useState(false);

    // ── add model
    const [showAddModelForm, setShowAddModelForm] = useState(false);
    const [newModelId, setNewModelId] = useState('');
    const [isAddingModel, setIsAddingModel] = useState(false);
    const [addModelError, setAddModelError] = useState('');

    // ── delete model
    const [deletingModelId, setDeletingModelId] = useState<number | null>(null);
    const [activatingModelId, setActivatingModelId] = useState<number | null>(null);

    // ── enter edit mode
    const startEdit = () => {
        setEditName(provider.name);
        setEditBaseUrl(provider.baseUrl);
        setEditProtocol(provider.protocol);
        setEditApiKey('');   // never pre-fill secrets
        setEditing(true);
    };

    const cancelEdit = () => setEditing(false);

    const saveEdit = async () => {
        if (!editName.trim() || !editBaseUrl.trim()) return;
        setIsSavingEdit(true);
        try {
            await onUpdate(provider.id, {
                name: editName.trim(),
                baseUrl: editBaseUrl.trim(),
                protocol: editProtocol,
                ...(editApiKey.trim() ? { apiKey: editApiKey.trim() } : {}),
            });
            setEditing(false);
        } finally {
            setIsSavingEdit(false);
        }
    };

    // ── add model
    const handleAddModel = async () => {
        const modelId = newModelId.trim();
        if (!modelId) { setAddModelError('Model ID is required.'); return; }
        setAddModelError('');
        setIsAddingModel(true);
        try {
            await onAddModel({
                name: `${provider.name} / ${modelId}`,
                model: modelId,
                apiKey: '',   // backend fills from CustomProviderStore
            });
            setNewModelId('');
            setShowAddModelForm(false);
        } finally {
            setIsAddingModel(false);
        }
    };

    // ── derived
    const hasModels = linkedConfigs.length > 0;
    const activeModelConfigId = linkedConfigs.find(c => c.isActive)?.id ?? null;

    return (
        <div className="flex flex-col gap-5">

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--color-text-primary)] truncate">
                            {provider.name}
                        </h3>
                        <ProtocolBadge protocol={provider.protocol} />
                        {isActive && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.05em]
                                bg-[var(--color-success)/15] text-[var(--color-success)] border border-[var(--color-success)/15]">
                                Active
                            </span>
                        )}
                    </div>
                    <span className="text-[11px] text-[var(--color-text-tertiary)] uppercase tracking-[0.05em]">Custom Provider</span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                    {!editing && (
                        <>
                            <Btn onClick={startEdit} title="Edit provider">
                                <IconEdit />
                                <span>Edit</span>
                            </Btn>
                            <Btn onClick={() => setShowDeleteProviderDialog(true)} variant="danger" title="Delete provider">
                                <IconTrash />
                            </Btn>
                        </>
                    )}
                </div>
            </div>

            {/* ── Provider Info ────────────────────────────────────────── */}
            <div className="rounded-[12px] border border-[var(--mat-border)] overflow-hidden">
                <div className="grid grid-cols-1 gap-px bg-[var(--mat-border)]">

                    {/* Info rows */}
                    <div className="bg-[var(--mat-content-card-bg)] px-4 py-3 grid grid-cols-1 gap-3">
                        <InfoRow label="Provider Name" value={editing ? editName : provider.name}
                            editing={editing} onChange={setEditName} />

                        <InfoRow label="Base URL" value={editing ? editBaseUrl : provider.baseUrl}
                            editing={editing} inputType="url" onChange={setEditBaseUrl}
                            inputProps={{ placeholder: 'https://api.example.com/v1', className: 'font-mono' }} />

                        {editing ? (
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">API Protocol</span>
                                <div className="flex gap-2">
                                    {PROTOCOL_OPTIONS.map(opt => (
                                        <button key={opt.value} type="button"
                                            onClick={() => setEditProtocol(opt.value)}
                                            className={`flex-1 py-2 rounded-lg border text-[12px] font-medium transition-all ${editProtocol === opt.value
                                                ? 'border-[var(--color-accent)] bg-[var(--mat-lg-clear-accent-bg)] text-[var(--color-accent)]'
                                                : 'border-[var(--mat-border)] text-[var(--color-text-secondary)] hover:border-[var(--mat-border-highlight)]'}`}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">API Protocol</span>
                                <span className="text-[13px] text-[var(--color-text-primary)]">
                                    {provider.protocol === 'openai' ? 'OpenAI API' : 'Anthropic API'}
                                </span>
                            </div>
                        )}

                        {editing && (
                            <InfoRow label="API Key (leave blank to keep existing)"
                                value={editApiKey} editing={editing}
                                inputType="password" onChange={setEditApiKey}
                                inputProps={{ placeholder: 'sk-… (leave blank to keep existing)', className: 'font-mono' }} />
                        )}

                        {!editing && (
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">API Key</span>
                                <span className="text-[13px] text-[var(--color-text-primary)] font-mono">
                                    {provider.apiKey ? '••••••••••••' : <span className="text-[var(--color-text-tertiary)] italic">Not set</span>}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Edit action bar */}
                    {editing && (
                        <div className="bg-[var(--mat-content-card-bg)] px-4 py-3 flex items-center justify-end gap-2">
                            <Btn onClick={cancelEdit} disabled={isSavingEdit}>
                                <IconX /><span>Cancel</span>
                            </Btn>
                            <Btn onClick={saveEdit} disabled={isSavingEdit || !editName.trim() || !editBaseUrl.trim()} variant="accent">
                                <IconCheck /><span>{isSavingEdit ? 'Saving…' : 'Save Changes'}</span>
                            </Btn>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Models Section ───────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-text-secondary)]">
                        Models · {linkedConfigs.length}
                    </span>
                    {!showAddModelForm && (
                        <Btn onClick={() => { setShowAddModelForm(true); setNewModelId(''); setAddModelError(''); }}>
                            <IconPlus /><span>Add Model</span>
                        </Btn>
                    )}
                </div>

                {/* Add model inline form */}
                {showAddModelForm && (
                    <div className="flex flex-col gap-2 p-3 rounded-[10px] border border-[var(--color-accent)]/30 bg-[var(--mat-lg-clear-accent-bg)]">
                        <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-accent)]">New Model</span>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newModelId}
                                onChange={(e) => { setNewModelId(e.target.value); setAddModelError(''); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddModel(); if (e.key === 'Escape') setShowAddModelForm(false); }}
                                placeholder="e.g., llama-3.1-70b-instruct"
                                autoFocus
                                className="flex-1 h-9 px-3 rounded-lg bg-[var(--mat-lg-clear-bg)] border border-[var(--mat-border)] text-[13px] font-mono text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]"
                            />
                            <button
                                onClick={handleAddModel}
                                disabled={isAddingModel || !newModelId.trim()}
                                className="h-9 px-4 rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium disabled:opacity-40 active:scale-95 transition-all">
                                {isAddingModel ? '…' : 'Add'}
                            </button>
                            <button
                                onClick={() => setShowAddModelForm(false)}
                                className="h-9 w-9 rounded-lg flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--mat-content-card-hover-bg)] transition-colors">
                                <IconX />
                            </button>
                        </div>
                        {addModelError && (
                            <p className="text-[11px] text-[var(--color-danger)]">{addModelError}</p>
                        )}
                        <p className="text-[11px] text-[var(--color-text-tertiary)]">
                            Enter the exact model ID string to use when calling the API.
                        </p>
                    </div>
                )}

                {/* Model list */}
                {!hasModels && !showAddModelForm ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 rounded-[12px] border border-dashed border-[var(--mat-border)]">
                        <span className="text-[13px] text-[var(--color-text-tertiary)]">No models added yet</span>
                        <button
                            onClick={() => setShowAddModelForm(true)}
                            className="text-[12px] text-[var(--color-accent)] hover:underline">
                            Add your first model
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {linkedConfigs.map((config) => {
                            const isThisActive = config.isActive;
                            const isActivating = activatingModelId === config.id;
                            const isDeleting = deletingModelId === config.id;
                            return (
                                <div key={config.id}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-[10px] transition-all duration-200
                                        ${isThisActive
                                            ? 'bg-[var(--mat-content-card-hover-bg)] border border-[var(--mat-border-highlight)]'
                                            : 'border border-[var(--mat-border)] hover:border-[var(--mat-border-highlight)] hover:bg-[var(--mat-content-card-bg)]'}`}>
                                    {/* Active dot */}
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isThisActive ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-tertiary)]/40'}`} />

                                    {/* Model ID */}
                                    <span className="flex-1 min-w-0 text-[13px] font-mono text-[var(--color-text-primary)] truncate">
                                        {config.model}
                                    </span>

                                    {/* Active badge */}
                                    {isThisActive && (
                                        <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.05em]
                                            bg-[var(--color-success)/15] text-[var(--color-success)] border border-[var(--color-success)/15]">
                                            Active
                                        </span>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {!isThisActive && (
                                            <button
                                                onClick={async () => {
                                                    setActivatingModelId(config.id);
                                                    try { await onActivateModel(config.id); }
                                                    finally { setActivatingModelId(null); }
                                                }}
                                                disabled={isActivating}
                                                className="h-7 px-3 rounded-lg text-[11px] font-medium text-[var(--color-accent)]
                                                    hover:bg-[var(--mat-lg-clear-accent-bg)] transition-all disabled:opacity-40 active:scale-95">
                                                {isActivating ? '…' : 'Activate'}
                                            </button>
                                        )}
                                        <button
                                            onClick={async () => {
                                                setDeletingModelId(config.id);
                                                try { await onDeleteModel(config.id); }
                                                finally { setDeletingModelId(null); }
                                            }}
                                            disabled={isDeleting}
                                            className="h-7 w-7 flex items-center justify-center rounded-lg
                                                text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10
                                                transition-all disabled:opacity-40 active:scale-95">
                                            <IconTrash />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Delete Provider Dialog ───────────────────────────────── */}
            <DeleteConfirmDialog
                isOpen={showDeleteProviderDialog}
                providerName={provider.name}
                isActive={isActive}
                onClose={() => setShowDeleteProviderDialog(false)}
                onConfirm={() => { setShowDeleteProviderDialog(false); onDelete(provider.id); }}
            />
        </div>
    );
};
