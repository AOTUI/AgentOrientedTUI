/**
 * SystemOperationRegistry Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemOperationRegistry } from './registry.js';
import type { ISystemOperation, SystemOperationContext, IDesktopForOperation, OperationResult } from '../../../spi/index.js';

// Mock Desktop for operations
function createMockDesktop(): IDesktopForOperation {
    return {
        id: 'dt_test' as any,
        openApp: vi.fn().mockResolvedValue(undefined),
        closeApp: vi.fn().mockResolvedValue(undefined),
        collapseApp: vi.fn().mockResolvedValue(undefined),
        showApp: vi.fn().mockResolvedValue(undefined),

        dismountView: vi.fn().mockResolvedValue(undefined),
        hideView: vi.fn().mockResolvedValue(undefined),
        showView: vi.fn().mockResolvedValue(undefined),
        mountViewByLink: vi.fn().mockResolvedValue(undefined)
    };
}

// Mock operation for testing
function createMockOperation(name: string, aliases?: string[]): ISystemOperation {
    return {
        name,
        aliases: aliases as readonly string[] | undefined,
        execute: vi.fn().mockResolvedValue({ success: true }),
        toolDefinition: {
            type: 'function',
            function: {
                name: name,
                description: 'Mock operation',
                parameters: {
                    type: 'object',
                    properties: {},
                    required: []
                }
            }
        }
    };
}

describe('SystemOperationRegistry', () => {
    let registry: SystemOperationRegistry;
    let mockDesktop: IDesktopForOperation;

    beforeEach(() => {
        registry = new SystemOperationRegistry();
        mockDesktop = createMockDesktop();
    });

    describe('register()', () => {
        it('registers an operation by name', () => {
            const op = createMockOperation('test_op');
            registry.register(op);

            expect(registry.has('test_op')).toBe(true);
        });

        it('registers an operation with aliases', () => {
            const op = createMockOperation('open', ['open_app']);
            registry.register(op);

            expect(registry.has('open')).toBe(true);
            expect(registry.has('open_app')).toBe(true);
        });

        it('throws on duplicate operation name', () => {
            const op1 = createMockOperation('duplicate');
            const op2 = createMockOperation('duplicate');

            registry.register(op1);
            expect(() => registry.register(op2)).toThrow(/OPERATION_DUPLICATE|already registered/);
        });

        it('throws on duplicate alias', () => {
            const op1 = createMockOperation('op1', ['shared_alias']);
            const op2 = createMockOperation('op2', ['shared_alias']);

            registry.register(op1);
            expect(() => registry.register(op2)).toThrow(/OPERATION_DUPLICATE|conflicts|already registered/);
        });
    });

    describe('has()', () => {
        it('returns true for registered operation', () => {
            registry.register(createMockOperation('exists'));
            expect(registry.has('exists')).toBe(true);
        });

        it('returns false for unregistered operation', () => {
            expect(registry.has('not_exists')).toBe(false);
        });

        it('finds operation by alias', () => {
            registry.register(createMockOperation('main', ['alias1', 'alias2']));

            expect(registry.has('main')).toBe(true);
            expect(registry.has('alias1')).toBe(true);
            expect(registry.has('alias2')).toBe(true);
        });
    });

    describe('get()', () => {
        it('returns registered operation by name', () => {
            const op = createMockOperation('getme');
            registry.register(op);

            expect(registry.get('getme')).toBe(op);
        });

        it('returns registered operation by alias', () => {
            const op = createMockOperation('primary', ['secondary']);
            registry.register(op);

            expect(registry.get('secondary')).toBe(op);
        });

        it('returns undefined for unregistered operation', () => {
            expect(registry.get('unknown')).toBeUndefined();
        });
    });

    describe('execute()', () => {
        it('executes registered operation', async () => {
            const op = createMockOperation('exec_test');
            registry.register(op);

            const ctx: SystemOperationContext = {
                desktopId: 'dt_1' as any,
                args: { foo: 'bar' }
            };

            const result = await registry.execute('exec_test', ctx, mockDesktop);

            expect(result.success).toBe(true);
            expect(op.execute).toHaveBeenCalledWith(ctx, mockDesktop);
        });

        it('executes operation by alias', async () => {
            const op = createMockOperation('main_name', ['alias_name']);
            registry.register(op);

            const ctx: SystemOperationContext = {
                desktopId: 'dt_1' as any,
                args: {}
            };

            await registry.execute('alias_name', ctx, mockDesktop);
            expect(op.execute).toHaveBeenCalled();
        });

        it('returns error for unknown operation', async () => {
            const ctx: SystemOperationContext = {
                desktopId: 'dt_1' as any,
                args: {}
            };

            const result = await registry.execute('unknown_op', ctx, mockDesktop);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('OPERATION_NOT_FOUND');
        });

        it('wraps operation errors in result', async () => {
            const op: ISystemOperation = {
                name: 'throws',
                execute: vi.fn().mockRejectedValue(new Error('Internal failure')),
                toolDefinition: {
                    type: 'function',
                    function: {
                        name: 'throws',
                        description: 'Mock throws',
                        parameters: {
                            type: 'object',
                            properties: {},
                            required: []
                        }
                    }
                }
            };
            registry.register(op);

            const ctx: SystemOperationContext = {
                desktopId: 'dt_1' as any,
                args: {}
            };

            const result = await registry.execute('throws', ctx, mockDesktop);

            expect(result.success).toBe(false);
            expect(result.error?.code).toBe('EXECUTION_FAILED');
            // Original message is wrapped in context
            expect(result.error?.message).toContain('Internal failure');
        });
    });
});
