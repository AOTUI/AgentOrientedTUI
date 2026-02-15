/**
 * ToastNotification Component
 * 
 * Toast notification system for user feedback
 * Supports success, error, and warning types
 */

import React, { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning';

export interface ToastNotificationProps {
    message: string | null;
    type?: ToastType;
    duration?: number;
    onClose?: () => void;
}

/**
 * Icon components for different toast types
 */
const IconCheck = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
        <path d="M20 6L9 17l-5-5" />
    </svg>
);

const IconX = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

const IconAlertTriangle = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

/**
 * ToastNotification Component
 * 
 * Displays a toast notification with icon and message
 */
export const ToastNotification: React.FC<ToastNotificationProps> = ({
    message,
    type = 'success',
    duration = 3000,
    onClose,
}) => {
    // Auto-dismiss after duration
    useEffect(() => {
        if (message && onClose && duration > 0) {
            const timer = setTimeout(() => {
                onClose();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [message, onClose, duration]);

    if (!message) return null;

    // Type-specific styling
    const typeStyles = {
        success: {
            bg: 'bg-green-500/10',
            border: 'border-green-500/30',
            text: 'text-green-400',
            icon: <IconCheck className="w-5 h-5" />,
        },
        error: {
            bg: 'bg-red-500/10',
            border: 'border-red-500/30',
            text: 'text-red-400',
            icon: <IconX className="w-5 h-5" />,
        },
        warning: {
            bg: 'bg-yellow-500/10',
            border: 'border-yellow-500/30',
            text: 'text-yellow-400',
            icon: <IconAlertTriangle className="w-5 h-5" />,
        },
    };

    const style = typeStyles[type];

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div
                className={`
                    ${style.bg} ${style.border} ${style.text}
                    backdrop-blur-xl border px-6 py-3 rounded-lg shadow-2xl
                    flex items-center gap-3 min-w-[300px]
                `}
            >
                <div className="flex-shrink-0">
                    {style.icon}
                </div>
                <span className="text-sm font-medium tracking-wide flex-1">
                    {message}
                </span>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="flex-shrink-0 hover:opacity-70 transition-opacity"
                        aria-label="Close notification"
                    >
                        <IconX className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
};
