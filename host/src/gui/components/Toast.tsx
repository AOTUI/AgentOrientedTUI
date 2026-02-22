import React from 'react';

interface ToastProps {
    message: string | null;
}

export function Toast({ message }: ToastProps) {
    if (!message) return null;
    
    return (
        <div className="fixed top-8 right-8 z-[100] animate-in slide-in-from-top-5 fade-in duration-300">
            <div className="mat-lg-clear px-6 py-3 rounded-full flex items-center gap-3">
                <div className="w-2 h-2 bg-[var(--color-accent)] rounded-full" />
                <span className="text-[13px] font-medium tracking-wide text-[var(--color-text-primary)]">{message}</span>
            </div>
        </div>
    );
}
