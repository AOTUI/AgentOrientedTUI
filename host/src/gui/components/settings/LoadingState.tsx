/**
 * LoadingState Component
 * 
 * Displays a loading state with spinner and optional message
 */

import React from 'react';
import { Spinner } from './Spinner.js';

interface LoadingStateProps {
    message?: string;
    size?: 'sm' | 'md' | 'lg';
}

/**
 * LoadingState Component
 * 
 * Displays a centered loading spinner with optional message
 */
export const LoadingState: React.FC<LoadingStateProps> = ({ 
    message = 'Loading...', 
    size = 'md' 
}) => {
    return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Spinner size={size} className="text-[var(--color-accent)]" />
            <p className="text-[var(--color-text-secondary)] text-sm">
                {message}
            </p>
        </div>
    );
};
