import React from 'react';

interface EmptyStateProps {
    onNewChat: () => void;
}

export function EmptyState({ onNewChat }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-tertiary)] select-none pointer-events-none">
             <div className="flex flex-col items-center gap-4 opacity-40">
                <div className="w-16 h-16 rounded-full border border-dashed border-[var(--color-text-tertiary)] flex items-center justify-center">
                    <div className="w-2 h-2 bg-[var(--color-text-tertiary)] rounded-full" />
                </div>
                <div className="font-system text-[13px] font-medium text-[var(--color-text-secondary)]">
                    System Online
                </div>
                <div className="font-mono text-[10px] opacity-50">
                    Awaiting Input Sequence
                </div>
             </div>
        </div>
    );
}
