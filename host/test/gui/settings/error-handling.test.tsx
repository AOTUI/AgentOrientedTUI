/**
 * Error Handling Tests
 * 
 * Unit tests for error boundaries, loading states, and toast notifications
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { SettingsErrorBoundary } from '../../../src/gui/components/settings/SettingsErrorBoundary.js';
import { LoadingState } from '../../../src/gui/components/settings/LoadingState.js';
import { Spinner } from '../../../src/gui/components/settings/Spinner.js';
import { ToastNotification } from '../../../src/gui/components/settings/ToastNotification.js';
import { useToast } from '../../../src/gui/components/settings/hooks/useToast.js';

/**
 * Component that throws an error for testing error boundary
 */
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
    if (shouldThrow) {
        throw new Error('Test error');
    }
    return <div>No error</div>;
};

describe('SettingsErrorBoundary', () => {
    // Suppress console.error for these tests
    const originalError = console.error;
    beforeEach(() => {
        console.error = vi.fn();
    });
    afterEach(() => {
        console.error = originalError;
    });

    it('should render children when no error occurs', () => {
        render(
            <SettingsErrorBoundary>
                <div>Test content</div>
            </SettingsErrorBoundary>
        );

        expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should catch errors and display error message', () => {
        render(
            <SettingsErrorBoundary>
                <ThrowError shouldThrow={true} />
            </SettingsErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText(/An error occurred while loading the settings panel/)).toBeInTheDocument();
    });

    it('should display "Try Again" button when error occurs', () => {
        render(
            <SettingsErrorBoundary>
                <ThrowError shouldThrow={true} />
            </SettingsErrorBoundary>
        );

        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('should reset error state when "Try Again" is clicked', async () => {
        const { rerender } = render(
            <SettingsErrorBoundary>
                <ThrowError shouldThrow={true} />
            </SettingsErrorBoundary>
        );

        // Error should be displayed
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();

        // Click "Try Again" - this resets the error boundary state
        const tryAgainButton = screen.getByRole('button', { name: /try again/i });
        fireEvent.click(tryAgainButton);

        // After clicking "Try Again", the error boundary resets its state
        // but the component will throw again if we don't change the prop
        // So we need to wait for the state to reset first
        await waitFor(() => {
            // The error boundary should have reset and be ready to render children again
            expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
        });
    });

    it('should log error to console', () => {
        render(
            <SettingsErrorBoundary>
                <ThrowError shouldThrow={true} />
            </SettingsErrorBoundary>
        );

        expect(console.error).toHaveBeenCalled();
    });
});

describe('Spinner', () => {
    it('should render spinner with default size', () => {
        const { container } = render(<Spinner />);
        const svg = container.querySelector('svg');
        
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveClass('w-6', 'h-6'); // md size
    });

    it('should render spinner with small size', () => {
        const { container } = render(<Spinner size="sm" />);
        const svg = container.querySelector('svg');
        
        expect(svg).toHaveClass('w-4', 'h-4');
    });

    it('should render spinner with large size', () => {
        const { container } = render(<Spinner size="lg" />);
        const svg = container.querySelector('svg');
        
        expect(svg).toHaveClass('w-8', 'h-8');
    });

    it('should apply custom className', () => {
        const { container } = render(<Spinner className="text-red-500" />);
        const svg = container.querySelector('svg');
        
        expect(svg).toHaveClass('text-red-500');
    });

    it('should have spin animation', () => {
        const { container } = render(<Spinner />);
        const svg = container.querySelector('svg');
        
        expect(svg).toHaveClass('animate-spin');
    });
});

describe('LoadingState', () => {
    it('should render loading message', () => {
        render(<LoadingState />);
        
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render custom loading message', () => {
        render(<LoadingState message="Loading configurations..." />);
        
        expect(screen.getByText('Loading configurations...')).toBeInTheDocument();
    });

    it('should render spinner', () => {
        const { container } = render(<LoadingState />);
        const svg = container.querySelector('svg');
        
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveClass('animate-spin');
    });

    it('should render spinner with specified size', () => {
        const { container } = render(<LoadingState size="lg" />);
        const svg = container.querySelector('svg');
        
        expect(svg).toHaveClass('w-8', 'h-8');
    });
});

describe('ToastNotification', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should not render when message is null', () => {
        const { container } = render(<ToastNotification message={null} />);
        
        expect(container.firstChild).toBeNull();
    });

    it('should render success toast', () => {
        render(<ToastNotification message="Success!" type="success" />);
        
        expect(screen.getByText('Success!')).toBeInTheDocument();
    });

    it('should render error toast', () => {
        render(<ToastNotification message="Error occurred" type="error" />);
        
        expect(screen.getByText('Error occurred')).toBeInTheDocument();
    });

    it('should render warning toast', () => {
        render(<ToastNotification message="Warning!" type="warning" />);
        
        expect(screen.getByText('Warning!')).toBeInTheDocument();
    });

    it('should auto-dismiss after duration', async () => {
        const onClose = vi.fn();
        render(
            <ToastNotification 
                message="Test message" 
                duration={3000}
                onClose={onClose}
            />
        );

        expect(screen.getByText('Test message')).toBeInTheDocument();

        // Fast-forward time
        await vi.advanceTimersByTimeAsync(3000);

        await waitFor(() => {
            expect(onClose).toHaveBeenCalled();
        });
    });

    it('should call onClose when close button is clicked', async () => {
        const onClose = vi.fn();
        render(
            <ToastNotification 
                message="Test message"
                onClose={onClose}
            />
        );

        const closeButton = screen.getByRole('button', { name: /close notification/i });
        fireEvent.click(closeButton);

        expect(onClose).toHaveBeenCalled();
    });

    it('should not auto-dismiss when duration is 0', () => {
        const onClose = vi.fn();
        render(
            <ToastNotification 
                message="Test message" 
                duration={0}
                onClose={onClose}
            />
        );

        vi.advanceTimersByTime(5000);

        expect(onClose).not.toHaveBeenCalled();
    });
});

describe('useToast hook', () => {
    const TestComponent: React.FC = () => {
        const { toast, showSuccess, showError, showWarning, clearToast } = useToast();

        return (
            <div>
                <div data-testid="toast-message">{toast.message}</div>
                <div data-testid="toast-type">{toast.type}</div>
                <button onClick={() => showSuccess('Success!')}>Show Success</button>
                <button onClick={() => showError('Error!')}>Show Error</button>
                <button onClick={() => showWarning('Warning!')}>Show Warning</button>
                <button onClick={clearToast}>Clear Toast</button>
            </div>
        );
    };

    it('should initialize with null message', () => {
        render(<TestComponent />);
        
        expect(screen.getByTestId('toast-message')).toHaveTextContent('');
    });

    it('should show success toast', async () => {
        render(<TestComponent />);

        fireEvent.click(screen.getByText('Show Success'));

        expect(screen.getByTestId('toast-message')).toHaveTextContent('Success!');
        expect(screen.getByTestId('toast-type')).toHaveTextContent('success');
    });

    it('should show error toast', async () => {
        render(<TestComponent />);

        fireEvent.click(screen.getByText('Show Error'));

        expect(screen.getByTestId('toast-message')).toHaveTextContent('Error!');
        expect(screen.getByTestId('toast-type')).toHaveTextContent('error');
    });

    it('should show warning toast', async () => {
        render(<TestComponent />);

        fireEvent.click(screen.getByText('Show Warning'));

        expect(screen.getByTestId('toast-message')).toHaveTextContent('Warning!');
        expect(screen.getByTestId('toast-type')).toHaveTextContent('warning');
    });

    it('should clear toast', async () => {
        render(<TestComponent />);

        // Show a toast
        fireEvent.click(screen.getByText('Show Success'));
        expect(screen.getByTestId('toast-message')).toHaveTextContent('Success!');

        // Clear the toast
        fireEvent.click(screen.getByText('Clear Toast'));
        expect(screen.getByTestId('toast-message')).toHaveTextContent('');
    });
});
