/**
 * AgentEditorModal - Reusable modal wrapper for Agent editors
 */
import React, { useEffect, useRef } from 'react';

export interface AgentEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    width?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export const AgentEditorModal: React.FC<AgentEditorModalProps> = ({
    isOpen,
    onClose,
    title,
    width = 'max-w-[540px]',
    children,
    footer,
}) => {
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--mat-overlay-bg)] backdrop-blur-sm p-4"
            onClick={(e) => {
                if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
                    onClose();
                }
            }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div
                ref={cardRef}
                className={`w-full ${width} mat-lg-regular rounded-[20px] flex flex-col overflow-hidden max-h-[85vh]`}
            >
                <div className="flex flex-col gap-4 p-6 overflow-y-auto custom-scrollbar">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-[17px] font-semibold text-[var(--color-text-primary)]">
                            {title}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-[var(--mat-content-card-hover-bg)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                            aria-label="Close modal"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Content */}
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="flex justify-end gap-3 px-6 pb-5 pt-2">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};
