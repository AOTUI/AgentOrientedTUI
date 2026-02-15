import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocketHandler } from '../../src/host/websocket-handler.js';
import type { ISessionManager } from '../../src/host/types.js';
import type { SignalRouter } from '../../src/host/signal-router.js';
import { WebSocket } from 'ws';

// Mock WebSocket
class MockWebSocket {
    readyState = 1; // OPEN
    on = vi.fn();
    send = vi.fn();
    static OPEN = 1;
}

describe('WebSocketHandler (Zod Validation)', () => {
    let mockSessionManager: any;
    let mockSignalRouter: any;
    let handler: WebSocketHandler;
    let mockWs: any;

    beforeEach(() => {
        mockSessionManager = {
            getAllSessions: vi.fn().mockReturnValue([]),
            getOrCreateSession: vi.fn().mockResolvedValue({ id: 'test-session', bridge: {} }),
            getSession: vi.fn()
        };
        mockSignalRouter = {
            onBroadcast: vi.fn().mockReturnValue(() => {}),
            handleUserMessage: vi.fn().mockResolvedValue({}),
            handlePause: vi.fn(),
            handleResume: vi.fn()
        };
        handler = new WebSocketHandler(
            mockSessionManager as unknown as ISessionManager,
            mockSignalRouter as unknown as SignalRouter
        );
        mockWs = new MockWebSocket();
        
        // Register listeners
        handler.handleConnection(mockWs as any);
    });

    it('should handle valid "subscribe" message via typed handler', async () => {
        const msg = JSON.stringify({
            type: 'subscribe',
            sessionId: 'session-1'
        });

        // Simulating receiving a message
        const messageHandler = getMessageHandler(mockWs);
        await messageHandler(Buffer.from(msg));

        expect(mockSignalRouter.onBroadcast).toHaveBeenCalledWith('session-1', expect.any(Function));
    });

    it('should handle valid "message" message via typed handler', async () => {
        const msg = JSON.stringify({
            type: 'message',
            sessionId: 'session-1',
            content: 'hello'
        });

        const messageHandler = getMessageHandler(mockWs);
        await messageHandler(Buffer.from(msg));

        expect(mockSignalRouter.handleUserMessage).toHaveBeenCalledWith('session-1', 'hello', undefined);
    });

    it('should fallback to legacy handler for GUI compatibility (subscribe_session)', async () => {
        const msg = JSON.stringify({
            type: 'subscribe_session',
            sessionId: 'legacy-session'
        });

        const messageHandler = getMessageHandler(mockWs);
        await messageHandler(Buffer.from(msg));

        expect(mockSignalRouter.onBroadcast).toHaveBeenCalledWith('legacy-session', expect.any(Function));
    });

    it('should send error to client for invalid message format', async () => {
        const msg = 'not-a-json';

        const messageHandler = getMessageHandler(mockWs);
        await messageHandler(Buffer.from(msg));

        expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('"type":"error"'));
    });

    it('should handle "control" message via typed handler', async () => {
        const msg = JSON.stringify({
            type: 'control',
            sessionId: 'session-1',
            action: 'pause'
        });

        const messageHandler = getMessageHandler(mockWs);
        await messageHandler(Buffer.from(msg));

        expect(mockSignalRouter.handlePause).toHaveBeenCalledWith('session-1');
    });
});

// Helper to extract the message listener from mock
function getMessageHandler(ws: any) {
    const call = ws.on.mock.calls.find((c: any) => c[0] === 'message');
    return call ? call[1] : null;
}
