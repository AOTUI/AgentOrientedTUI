import React from 'react';

interface ToastProps {
    message: string | null;
}

export function Toast({ message }: ToastProps) {
    if (!message) return null;
    
    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
                <div className="w-2 h-2 bg-[var(--color-accent)] rounded-full" />
                <span className="text-sm font-medium tracking-wide">{message}</span>
            </div>
        </div>
    );
}
