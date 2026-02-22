import React from 'react';
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";

export function ConnectionScreen({ status, onRetry }: { status: 'connecting' | 'error', onRetry?: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center h-screen w-full bg-transparent text-[var(--color-text-primary)] relative overflow-hidden">
            <div className="z-10 flex flex-col items-center mat-lg-regular p-10 rounded-[20px] w-full max-w-[480px] mx-4 text-center shadow-2xl">
                {status === 'connecting' ? (
                    <>
                        <Spinner size="lg" color="current" className="text-[var(--color-accent)]" />
                        <div className="mt-6 font-display text-[17px] font-medium text-[var(--color-text-primary)]">
                            Connecting to Host
                        </div>
                        <div className="mt-2 font-system text-[13px] text-[var(--color-text-secondary)]">
                            Initializing system components...
                        </div>
                    </>
                ) : (
                    <>
                        <div className="text-[var(--color-danger)] text-[28px] mb-4">⚠</div>
                        <h2 className="font-display text-[22px] font-medium text-[var(--color-text-primary)]">Connection Lost</h2>
                        <p className="font-system text-[13px] text-[var(--color-text-secondary)] mt-2 mb-8">
                            Unable to establish link with Host Core. Please check your connection and try again.
                        </p>
                        <Button 
                            className="bg-[var(--color-accent)] text-white font-system text-[13px] font-medium px-6 rounded-full transition-all active:scale-95"
                            onClick={onRetry}
                        >
                            Retry Connection
                        </Button>
                    </>
                )}
             </div>
        </div>
    );
}
