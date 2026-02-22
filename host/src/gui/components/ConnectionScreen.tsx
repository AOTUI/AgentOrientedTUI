import React from 'react';
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";

export function ConnectionScreen({ status, onRetry }: { status: 'connecting' | 'error', onRetry?: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center h-screen w-full bg-[var(--mat-base)] text-white gap-6 relative overflow-hidden">
             <div className="z-10 flex flex-col items-center mat-lg-regular p-12 rounded-2xl border border-white/10">
                {status === 'connecting' ? (
                    <>
                        <Spinner size="lg" color="primary" />
                        <div className="mt-4 font-system text-[13px] font-medium text-[var(--color-text-secondary)]">
                            INITIALIZING SYSTEM...
                        </div>
                    </>
                ) : (
                    <>
                        <div className="text-danger text-4xl mb-2">⚠</div>
                        <h2 className="text-xl font-bold text-danger tracking-wide">CONNECTION LOST</h2>
                        <p className="text-zinc-400 text-sm mt-2 mb-6">Unable to establish link with Host Core.</p>
                        <Button 
                            color="danger" 
                            variant="flat" 
                            onClick={onRetry}
                            className="font-system text-[13px] font-medium text-[var(--color-text-secondary)]"
                        >
                            Retry Connection
                        </Button>
                    </>
                )}
             </div>
        </div>
    );
}
