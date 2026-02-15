/**
 * useScreenReaderAnnouncement Hook
 * 
 * Provides screen reader announcements for accessibility.
 * Uses ARIA live regions to announce dynamic content changes.
 */

import { useEffect, useRef } from 'react';

/**
 * Hook to announce messages to screen readers
 */
export function useScreenReaderAnnouncement() {
    const liveRegionRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Create live region if it doesn't exist
        if (!liveRegionRef.current) {
            const liveRegion = document.createElement('div');
            liveRegion.setAttribute('role', 'status');
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.className = 'sr-only';
            document.body.appendChild(liveRegion);
            liveRegionRef.current = liveRegion;
        }

        return () => {
            // Cleanup on unmount
            if (liveRegionRef.current && document.body.contains(liveRegionRef.current)) {
                document.body.removeChild(liveRegionRef.current);
                liveRegionRef.current = null;
            }
        };
    }, []);

    /**
     * Announce a message to screen readers
     */
    const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
        if (liveRegionRef.current) {
            liveRegionRef.current.setAttribute('aria-live', priority);
            liveRegionRef.current.textContent = message;

            // Clear after announcement
            setTimeout(() => {
                if (liveRegionRef.current) {
                    liveRegionRef.current.textContent = '';
                }
            }, 1000);
        }
    };

    return { announce };
}
