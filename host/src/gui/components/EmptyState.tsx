import React from 'react';

interface EmptyStateProps {
    onNewChat: () => void;
}

export function EmptyState({ onNewChat }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] select-none pointer-events-none">
             <div className="flex flex-col items-center gap-4 opacity-40">
                <div className="w-16 h-16 rounded-full border border-dashed border-[var(--color-text-muted)] flex items-center justify-center animate-[spin_10s_linear_infinite]">
                    <div className="w-2 h-2 bg-[var(--color-text-muted)] rounded-full" />
                </div>
                <div className="font-mono text-xs tracking-[0.3em] uppercase">
                    System Online
                </div>
                <div className="font-mono text-[10px] opacity-50">
                    AWAITING INPUT SEQUENCE
                </div>
             </div>
        </div>
    );
}
