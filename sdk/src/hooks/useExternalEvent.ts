import { useEffect } from 'preact/hooks';

/**
 * Hook to subscribe to external system events.
 * 
 * Part of TUI IDE Phase 1: The Bridge.
 * Allows components to react to events from Host/System Tools (e.g. LSP, Git, Watcher).
 * 
 * @param eventType The specific event type to listen for (e.g., 'grep-result', 'file-changed')
 * @param callback Function to execute when event is received
 * @param inputs Dependency array for the effect
 */
export function useExternalEvent<T = any>(
    eventType: string,
    callback: (data: T, meta: { viewId?: string, timestamp: number }) => void,
    inputs: any[] = []
) {
    useEffect(() => {
        const handler = (e: any) => {
            const detail = e.detail;
            if (!detail) return;

            // Filter by event type
            if (detail.type === eventType) {
                callback(detail.data, {
                    viewId: detail.viewId,
                    timestamp: detail.timestamp
                });
            }
        };

        // Listen for the unified bridge event
        window.addEventListener('aotui:external-event', handler);

        return () => {
            window.removeEventListener('aotui:external-event', handler);
        };
    }, [eventType, ...inputs]);
}
