/**
 * SettingsErrorBoundary Component
 * 
 * Error boundary specifically for the Settings Panel
 * Displays user-friendly error messages and logs errors to console
 */

import React from 'react';

interface SettingsErrorBoundaryProps {
    children: React.ReactNode;
}

interface SettingsErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * Icon component for error state
 */
const IconAlertCircle = (props: React.SVGProps<SVGSVGElement>) => (
    <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth={2} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        {...props}
        className={`w-12 h-12 ${props.className || ''}`}
    >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
);

/**
 * SettingsErrorBoundary Component
 * 
 * Catches errors in the Settings Panel and displays a user-friendly error message
 */
export class SettingsErrorBoundary extends React.Component<
    SettingsErrorBoundaryProps,
    SettingsErrorBoundaryState
> {
    constructor(props: SettingsErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): SettingsErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error to console for debugging
        console.error('[SettingsPanel] Error caught by boundary:', error);
        console.error('[SettingsPanel] Error info:', errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <IconAlertCircle className="text-[var(--color-danger)] mb-4" />
                    
                    <h2 className="text-[17px] font-medium text-[var(--color-text-primary)] mb-2">
                        Something went wrong
                    </h2>
                    
                    <p className="text-[var(--color-text-secondary)] mb-6 max-w-md">
                        An error occurred while loading the settings panel. 
                        Please try again or contact support if the problem persists.
                    </p>

                    {/* Show error details in development */}
                    {process.env.NODE_ENV === 'development' && this.state.error && (
                        <details className="mb-6 text-left max-w-2xl w-full">
                            <summary className="cursor-pointer text-sm text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] mb-2">
                                Error Details (Development Only)
                            </summary>
                            <pre className="text-xs text-[var(--color-danger)] bg-[var(--color-bg-elevated)] p-4 rounded-lg overflow-auto max-h-48 border border-[var(--color-border)]">
                                {this.state.error.toString()}
                                {this.state.error.stack && `\n\n${this.state.error.stack}`}
                            </pre>
                        </details>
                    )}

                    <button
                        onClick={this.handleReset}
                        className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-full font-medium hover:bg-[var(--color-accent)]/90 transition-all active:scale-95"
                    >
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
