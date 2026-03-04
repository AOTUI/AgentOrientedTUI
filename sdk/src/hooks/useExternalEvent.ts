import { useEffect } from 'preact/hooks';

/**
 * Hook to subscribe to external system events.
 * 
 * @deprecated This hook is not currently used or validated. External event handling may be redesigned in a future version.
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
