import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Bridge } from './index.js';
import { IKernel, Operation, CachedSnapshot } from '../../spi/index.js';

describe('Bridge', () => {
    let bridge: Bridge;
    let mockKernel: any;
    let mockDesktop: any;

    beforeEach(() => {
        vi.useFakeTimers();

        mockKernel = {
            acquireSnapshot: vi.fn().mockResolvedValue({ id: 'snap_new', markup: '# New', refCount: 1 }),
            releaseSnapshot: vi.fn(),
            execute: vi.fn().mockResolvedValue({ success: true }),
            acquireLock: vi.fn(),
            releaseLock: vi.fn(),
            createDesktop: vi.fn().mockResolvedValue('dt_1')
        };

        mockDesktop = {
            id: 'dt_1',
            output: { subscribe: vi.fn(), unsubscribe: vi.fn() }
        };

        // Bridge usually creates or connects to a desktop. 
        // Assuming Bridge manages one active desktop for simplicity of v1?
        // Or Bridge manages multiple sessions?
        // Let's assume Bridge is instantiated PER SESSION or manages map?
        // "Bridge Interface ... Input: Raw JSON, Session Context."
        // Let's make Bridge a single instance managing a specific Desktop for a Session.

        bridge = new Bridge(mockKernel, 'dt_1', 'agent_1');
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('acquireSnapshot acquires new snapshot and releases old one', async () => {
        // First call
        const snap1 = await bridge.acquireSnapshot();
        expect(snap1.id).toBe('snap_new');
        expect(mockKernel.acquireSnapshot).toHaveBeenCalledWith('dt_1');
        expect(mockKernel.releaseSnapshot).not.toHaveBeenCalled();

        // Second call
        mockKernel.acquireSnapshot.mockResolvedValue({ id: 'snap_newer', markup: '# Newer', refCount: 1 });
        const snap2 = await bridge.acquireSnapshot();
        expect(snap2.id).toBe('snap_newer');

        // Should release 'snap_new'
        expect(mockKernel.releaseSnapshot).toHaveBeenCalledWith('snap_new');
    });

    it('executeOperations passes operations to kernel with provided snapshot ID', async () => {
        // Setup active snapshot
        const snap = await bridge.acquireSnapshot(); // snap_new

        // Use Operation structure
        const op = {
            context: { appId: 'app' },
            operation: 'op' as OperationID,
            args: {}
        };

        // Pass array and snapshotId
        const results = await bridge.executeOperations([op], snap.id);

        expect(mockKernel.execute).toHaveBeenCalledWith(
            'dt_1',
            expect.objectContaining({
                context: expect.objectContaining({ snapshotId: 'snap_new' })
            }),
            'agent_1'
        );
        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
    });

    it('signals are throttled', async () => {
        const listener = vi.fn();
        bridge.onUpdate(listener);

        // Simulate Desktop Signal
        bridge.handleSignal({ desktopId: 'dt_1', timestamp: 1, reason: 'dom_mutation' });
        bridge.handleSignal({ desktopId: 'dt_1', timestamp: 2, reason: 'dom_mutation' });
        bridge.handleSignal({ desktopId: 'dt_1', timestamp: 3, reason: 'dom_mutation' });

        // Should not fire yet (debounce)
        expect(listener).not.toHaveBeenCalled();

        // Fast forward debounce time (300ms)
        vi.advanceTimersByTime(300);

        expect(listener).toHaveBeenCalledTimes(1);
    });
});
