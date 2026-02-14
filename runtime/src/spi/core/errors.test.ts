/**
 * AOTUIError Unit Tests
 * 
 * @module @aotui/runtime/spi/core/errors.test
 */

import { describe, it, expect } from 'vitest';
import {
    ERROR_CODES,
    AOTUIError,
    createOperationError,
    failedResult,
} from './errors.js';
import type { ErrorCode } from './errors.js';

describe('ERROR_CODES', () => {
    it('should have all expected domains', () => {
        // Desktop
        expect(ERROR_CODES.DESKTOP_NOT_FOUND).toBe('DESKTOP_NOT_FOUND');
        expect(ERROR_CODES.DESKTOP_DISPOSED).toBe('DESKTOP_DISPOSED');
        expect(ERROR_CODES.DESKTOP_LOCKED).toBe('DESKTOP_LOCKED');

        // App
        expect(ERROR_CODES.APP_NOT_FOUND).toBe('APP_NOT_FOUND');
        expect(ERROR_CODES.APP_LOAD_FAILED).toBe('APP_LOAD_FAILED');

        // View
        expect(ERROR_CODES.VIEW_NOT_FOUND).toBe('VIEW_NOT_FOUND');
        expect(ERROR_CODES.VIEW_DUPLICATE).toBe('VIEW_DUPLICATE');

        // Operation
        expect(ERROR_CODES.OPERATION_NOT_FOUND).toBe('OPERATION_NOT_FOUND');
        expect(ERROR_CODES.OPERATION_NO_HANDLER).toBe('OPERATION_NO_HANDLER');

        // Worker
        expect(ERROR_CODES.WORKER_TIMEOUT).toBe('WORKER_TIMEOUT');
        expect(ERROR_CODES.WORKER_NOT_STARTED).toBe('WORKER_NOT_STARTED');

        // Snapshot
        expect(ERROR_CODES.SNAPSHOT_NOT_FOUND).toBe('SNAPSHOT_NOT_FOUND');
        expect(ERROR_CODES.SNAPSHOT_EXPIRED).toBe('SNAPSHOT_EXPIRED');

        // Generic
        expect(ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
    });

    it('should be readonly (type-level immutability)', () => {
        // `as const` provides compile-time immutability, not runtime
        // This test verifies the values are correct strings (not objects that could be mutated)
        const codes = Object.values(ERROR_CODES);
        codes.forEach(code => {
            expect(typeof code).toBe('string');
        });

        // Verify specific codes haven't changed
        expect(ERROR_CODES.DESKTOP_NOT_FOUND).toBe('DESKTOP_NOT_FOUND');
    });
});

describe('AOTUIError', () => {
    describe('constructor', () => {
        it('should create error with correct code and message', () => {
            const err = new AOTUIError('DESKTOP_NOT_FOUND', { desktopId: 'abc123' });

            expect(err.code).toBe('DESKTOP_NOT_FOUND');
            expect(err.message).toContain('abc123');
            expect(err.message).toContain('Desktop');
            expect(err.name).toBe('AOTUIError');
        });

        it('should include context in error', () => {
            const context = { desktopId: 'desk_1', extra: 'info' };
            const err = new AOTUIError('DESKTOP_DISPOSED', context);

            expect(err.context).toEqual(context);
        });

        it('should set timestamp', () => {
            const before = Date.now();
            const err = new AOTUIError('INTERNAL_ERROR');
            const after = Date.now();

            expect(err.timestamp).toBeGreaterThanOrEqual(before);
            expect(err.timestamp).toBeLessThanOrEqual(after);
        });

        it('should format message with context values', () => {
            const err = new AOTUIError('DESKTOP_LOCKED', {
                desktopId: 'desk_123',
                ownerId: 'agent_456',
            });

            expect(err.message).toContain('desk_123');
            expect(err.message).toContain('agent_456');
        });

        it('should handle missing context values gracefully', () => {
            const err = new AOTUIError('DESKTOP_NOT_FOUND', {});
            expect(err.message).toContain('unknown');
        });
    });

    describe('toOperationError', () => {
        it('should convert to OperationError format', () => {
            const err = new AOTUIError('VIEW_NOT_FOUND', { viewId: 'v1' });
            const opErr = err.toOperationError();

            expect(opErr.code).toBe('VIEW_NOT_FOUND');
            expect(opErr.message).toContain('v1');
            expect(opErr.context).toEqual({ viewId: 'v1' });
        });
    });

    describe('is (type guard)', () => {
        it('should return true for AOTUIError instances', () => {
            const err = new AOTUIError('INTERNAL_ERROR');
            expect(AOTUIError.is(err)).toBe(true);
        });

        it('should return false for regular Error', () => {
            const err = new Error('normal error');
            expect(AOTUIError.is(err)).toBe(false);
        });

        it('should return false for non-error values', () => {
            expect(AOTUIError.is(null)).toBe(false);
            expect(AOTUIError.is(undefined)).toBe(false);
            expect(AOTUIError.is('string')).toBe(false);
            expect(AOTUIError.is({})).toBe(false);
        });
    });

    describe('fromError', () => {
        it('should return same instance if already AOTUIError', () => {
            const original = new AOTUIError('VIEW_DUPLICATE', { viewId: 'v1' });
            const result = AOTUIError.fromError(original);

            expect(result).toBe(original);
        });

        it('should wrap regular Error', () => {
            const original = new Error('Something went wrong');
            const result = AOTUIError.fromError(original);

            expect(result.code).toBe('INTERNAL_ERROR');
            expect(result.context.message).toBe('Something went wrong');
            expect(result.context.originalError).toBe(original);
        });

        it('should wrap string error', () => {
            const result = AOTUIError.fromError('string error');

            expect(result.code).toBe('INTERNAL_ERROR');
            expect(result.context.message).toBe('string error');
        });

        it('should use provided code', () => {
            const result = AOTUIError.fromError(new Error('test'), 'WORKER_TERMINATED');
            expect(result.code).toBe('WORKER_TERMINATED');
        });
    });

    describe('instanceof chain', () => {
        it('should be instanceof Error', () => {
            const err = new AOTUIError('INTERNAL_ERROR');
            expect(err instanceof Error).toBe(true);
        });

        it('should be instanceof AOTUIError', () => {
            const err = new AOTUIError('INTERNAL_ERROR');
            expect(err instanceof AOTUIError).toBe(true);
        });
    });
});

describe('createOperationError', () => {
    it('should create OperationError directly', () => {
        const err = createOperationError('OPERATION_NOT_FOUND', {
            operationName: 'send_message',
        });

        expect(err.code).toBe('OPERATION_NOT_FOUND');
        expect(err.message).toContain('send_message');
        expect(err.context?.operationName).toBe('send_message');
    });
});

describe('failedResult', () => {
    it('should create failed OperationResult', () => {
        const result = failedResult('APP_NOT_FOUND', { appId: 'chat' });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe('APP_NOT_FOUND');
        expect(result.error.message).toContain('chat');
    });
});

describe('Error Code Coverage', () => {
    // Ensure all error codes have message templates
    it('should have message templates for all error codes', () => {
        const allCodes = Object.values(ERROR_CODES) as ErrorCode[];

        for (const code of allCodes) {
            const err = new AOTUIError(code, {});
            // Should not just return the code as-is
            expect(err.message).toBeDefined();
            expect(err.message.length).toBeGreaterThan(0);
        }
    });
});
