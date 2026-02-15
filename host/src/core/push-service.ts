/**
 * Push Service
 * 
 * Unified push notification service for bidirectional communication.
 * Handles pushing updates to both TUI Apps and GUI clients.
 */
import { WebSocket } from 'ws';
import type { Message, Topic } from '../types.js';

export type DesktopID = string;

export interface PushEvent {
    type: string;
    desktopId: DesktopID;
    data: unknown;
}

export interface GUIMessageEvent extends PushEvent {
    type: 'message';
    data: {
        message: Message;
        snapshot?: string;
    };
}

export interface SnapshotEvent extends PushEvent {
    type: 'snapshot';
    data: {
        markup: string;
    };
}

/**
 * PushService - Manages push notifications to TUI and GUI clients
 */
export class PushService {
    // GUI subscribers: desktopId -> WebSocket connections
    private guiSubscribers = new Map<DesktopID, Set<WebSocket>>();

    /**
     * Subscribe a GUI client to a desktop
     */
    subscribeGUI(desktopId: DesktopID, ws: WebSocket): void {
        if (!this.guiSubscribers.has(desktopId)) {
            this.guiSubscribers.set(desktopId, new Set());
        }
        this.guiSubscribers.get(desktopId)!.add(ws);

        // Remove on close
        ws.on('close', () => {
            this.unsubscribeGUI(desktopId, ws);
        });
    }

    /**
     * Unsubscribe a GUI client
     */
    unsubscribeGUI(desktopId: DesktopID, ws: WebSocket): void {
        const subs = this.guiSubscribers.get(desktopId);
        if (subs) {
            subs.delete(ws);
            if (subs.size === 0) {
                this.guiSubscribers.delete(desktopId);
            }
        }
    }

    /**
     * Push message to all GUI clients for a desktop
     */
    pushToGUI(desktopId: DesktopID, message: object): void {
        const subs = this.guiSubscribers.get(desktopId);
        if (!subs) return;

        const payload = JSON.stringify(message);
        for (const ws of subs) {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(payload);
            }
        }
    }

    /**
     * Push a new message event to GUI
     */
    pushMessage(desktopId: DesktopID, message: Message, snapshot?: string): void {
        this.pushToGUI(desktopId, {
            type: 'message',
            topicId: desktopId,
            message,
            snapshot
        });
    }

    /**
     * Push a snapshot update to GUI
     */
    pushSnapshot(desktopId: DesktopID, markup: string): void {
        this.pushToGUI(desktopId, {
            type: 'snapshot',
            topicId: desktopId,
            markup
        });
    }

    /**
     * Get number of GUI subscribers for a desktop
     */
    getGUISubscriberCount(desktopId: DesktopID): number {
        return this.guiSubscribers.get(desktopId)?.size ?? 0;
    }
}

// Singleton instance
export const pushService = new PushService();
