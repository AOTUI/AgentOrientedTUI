/**
 * DeleteConfirmDialog Component (V2)
 * 
 * Confirmation dialog for provider deletion.
 * Shows warning message and special warning if deleting active provider.
 */

import React, { useEffect } from 'react';
import type { DeleteConfirmDialogProps } from './types.js';

/**
 * Icon component for alert triangle
 */
const IconAlertTriangle = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
        className={`w-6 h-6 ${props.className || ''}`}
    >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

/**
 * DeleteConfirmDialog Component
 * 
 * Displays a confirmation dialog when deleting a provider.
 * Shows special warning if deleting the active provider.
 */
export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
    isOpen,
    providerName,
    isActive,
    onClose,
    onConfirm,
}) => {
    /**
     * Handle backdrop click
     */
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    /**
     * Handle Escape key
     */
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    /**
     * Handle confirm button click
     */
    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--mat-overlay-bg)] backdrop-blur-sm p-4"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-dialog-title"
            aria-describedby="delete-confirm-dialog-description"
        >
            <div className="w-full max-w-[450px] mat-lg-regular rounded-[20px] flex flex-col overflow-hidden">
                <div className="flex flex-col gap-6 p-6">
                    {/* Header */}
                    <div className="flex items-start gap-4">
                        <div className="flex-1">
                            <h2 
                                id="delete-confirm-dialog-title"
                                className="text-[17px] font-semibold text-[var(--color-text-primary)]"
                            >
                                Delete Provider
                            </h2>
                        </div>
                    </div>

                    {/* Warning Message */}
                    <div id="delete-confirm-dialog-description" className="flex flex-col gap-3">
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Are you sure you want to delete <span className="font-semibold text-[var(--color-text-primary)]">{providerName}</span>?
                        </p>
                        
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            This action cannot be undone. All configuration data for this provider will be permanently removed.
                        </p>

                        {/* Special Warning for Active Provider */}
                        {isActive && (
                            <div className="p-3 rounded-lg bg-[var(--color-danger)/15] border border-[var(--color-danger)/15]">
                                <p className="text-sm font-medium text-[var(--color-danger)]">
                                    ⚠️ Warning: This is your active provider
                                </p>
                                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                                    Deleting this provider will clear your active model selection. You will need to select a new provider and model to continue using the application.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 mt-2">
                        <button
                            onClick={onClose}
                            className="lg-btn hover:bg-[var(--mat-lg-clear-bg)]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="lg-btn border border-[var(--color-danger)] bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)/90]"
                        >
                            Delete Provider
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
