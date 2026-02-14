
import { describe, it, expect } from 'vitest';
import { defineRuntimeConfig, RUNTIME_DEFAULTS } from '../../../src/spi/config/define-config.js';
import { AOTUIError } from '../../../src/spi/core/errors.js';

describe('Configuration Architecture', () => {

    describe('defineRuntimeConfig (Builder)', () => {
        it('should return complete default config when input is empty', () => {
            const config = defineRuntimeConfig();

            expect(config.worker.timeoutMs).toBe(30_000);
            expect(config.bridge.debounceMs).toBe(300);
            expect(config.lock.ttlMs).toBe(300_000);
            expect(config.snapshot.ttlMs).toBe(600_000);

            // Check deep properties
            expect(config.worker.pool.initialSize).toBe(2);
            expect(config.worker.pool.maxSize).toBe(10);
        });

        it('should return a frozen immutable object', () => {
            const config = defineRuntimeConfig();
            expect(Object.isFrozen(config)).toBe(true);

            // Runtime modification attempt should throw in strict mode 
            // or just checking frozen status is enough for unit test
        });

        it('should merge top-level overrides correctly', () => {
            const config = defineRuntimeConfig({
                worker: { timeoutMs: 60_000 }
            });

            expect(config.worker.timeoutMs).toBe(60_000);
            // Non-overridden properties remain default
            expect(config.bridge.debounceMs).toBe(300);
            expect(config.worker.pool.initialSize).toBe(2);
        });

        it('should merge nested overrides deeply', () => {
            const config = defineRuntimeConfig({
                worker: {
                    pool: { maxSize: 20 }
                }
            });

            expect(config.worker.pool.maxSize).toBe(20);
            expect(config.worker.pool.initialSize).toBe(2); // Should persist from existing nested object
            expect(config.worker.timeoutMs).toBe(30_000);  // Sibling prop in parent
        });
    });

    describe('Validation Logic', () => {
        it('should pass with valid custom configuration', () => {
            expect(() => defineRuntimeConfig({
                worker: { timeoutMs: 50_000 }
            })).not.toThrow();
        });

        it('should throw CONFIG_INVALID when worker timeout is too small', () => {
            try {
                defineRuntimeConfig({
                    worker: { timeoutMs: 100 } // Below 1000
                });
                throw new Error('Should have thrown');
            } catch (error: any) {
                expect(error).toBeInstanceOf(AOTUIError);
                expect(error.code).toBe('CONFIG_INVALID');
                expect(error.context.errors).toContain('worker.timeoutMs');
            }
        });

        it('should throw when worker pool maxSize < initialSize', () => {
            try {
                defineRuntimeConfig({
                    worker: {
                        pool: { initialSize: 10, maxSize: 5 }
                    }
                });
                throw new Error('Should have thrown');
            } catch (error: any) {
                expect(error).toBeInstanceOf(AOTUIError);
                // 这里可能需要调整 AOTUIError 使用方式以完全匹配预期，但主要是 verify throw
                expect(error.code).toBe('CONFIG_INVALID');
            }
        });

        it('should validate multiple rules simultaneously', () => {
            try {
                defineRuntimeConfig({
                    worker: { timeoutMs: 0 },
                    bridge: { debounceMs: -1 }
                });
            } catch (error: any) {
                expect(error.context.errors).toContain('worker.timeoutMs');
                expect(error.context.errors).toContain('bridge.debounceMs');
            }
        });
    });
});
