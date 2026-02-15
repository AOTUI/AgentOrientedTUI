/**
 * useToast Hook
 * 
 * Custom hook for managing toast notifications
 */

import { useState, useCallback } from 'react';
import type { ToastType } from '../ToastNotification.js';

export interface ToastState {
    message: string | null;
    type: ToastType;
}

export interface UseToastReturn {
    /** Current toast state */
    toast: ToastState;
    /** Show a success toast */
    showSuccess: (message: string) => void;
    /** Show an error toast */
    showError: (message: string) => void;
    /** Show a warning toast */
    showWarning: (message: string) => void;
    /** Clear the current toast */
    clearToast: () => void;
}

/**
 * useToast Hook
 * 
 * Provides methods to show and clear toast notifications
 */
export function useToast(): UseToastReturn {
    const [toast, setToast] = useState<ToastState>({
        message: null,
        type: 'success',
    });

    const showSuccess = useCallback((message: string) => {
        setToast({ message, type: 'success' });
    }, []);

    const showError = useCallback((message: string) => {
        setToast({ message, type: 'error' });
    }, []);

    const showWarning = useCallback((message: string) => {
        setToast({ message, type: 'warning' });
    }, []);

    const clearToast = useCallback(() => {
        setToast({ message: null, type: 'success' });
    }, []);

    return {
        toast,
        showSuccess,
        showError,
        showWarning,
        clearToast,
    };
}
