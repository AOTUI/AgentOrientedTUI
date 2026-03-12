/**
 * Tests for validateArgs utility
 */
import { describe, it, expect } from 'vitest';
import { validateArgs, formatValidationErrors } from '../../src/utils/validateArgs.js';
import type { ParamSchema } from '../../src/operation/types.js';

describe('validateArgs', () => {
    describe('required parameters', () => {
        const schema: ParamSchema = {
            content: { type: 'string', required: true },
            priority: { type: 'number' }
        };

        it('should pass when required param is provided', () => {
            const errors = validateArgs({ content: 'hello' }, schema);
            expect(errors).toHaveLength(0);
        });

        it('should fail when required param is missing', () => {
            const errors = validateArgs({}, schema);
            expect(errors).toHaveLength(1);
            expect(errors[0].param).toBe('content');
            expect(errors[0].message).toContain('required');
        });

        it('should fail when required param is null', () => {
            const errors = validateArgs({ content: null }, schema);
            expect(errors).toHaveLength(1);
            expect(errors[0].received).toBe('null');
        });

        it('should allow missing optional param', () => {
            const errors = validateArgs({ content: 'hello' }, schema);
            expect(errors).toHaveLength(0);
        });
    });

    describe('type checking', () => {
        it('should validate string type', () => {
            const schema: ParamSchema = { name: { type: 'string', required: true } };

            expect(validateArgs({ name: 'Alice' }, schema)).toHaveLength(0);
            expect(validateArgs({ name: 123 }, schema)).toHaveLength(1);
            expect(validateArgs({ name: 123 }, schema)[0].expected).toBe('string');
            expect(validateArgs({ name: 123 }, schema)[0].received).toBe('number');
        });

        it('should validate number type', () => {
            const schema: ParamSchema = { count: { type: 'number', required: true } };

            expect(validateArgs({ count: 42 }, schema)).toHaveLength(0);
            expect(validateArgs({ count: '42' }, schema)).toHaveLength(1);
        });

        it('should validate boolean type', () => {
            const schema: ParamSchema = { enabled: { type: 'boolean', required: true } };

            expect(validateArgs({ enabled: true }, schema)).toHaveLength(0);
            expect(validateArgs({ enabled: false }, schema)).toHaveLength(0);
            expect(validateArgs({ enabled: 'true' }, schema)).toHaveLength(1);
        });

        it('should validate object type', () => {
            const schema: ParamSchema = { config: { type: 'object', required: true } };

            expect(validateArgs({ config: { key: 'value' } }, schema)).toHaveLength(0);
            expect(validateArgs({ config: null }, schema)).toHaveLength(1);  // null is not object
            expect(validateArgs({ config: 'string' }, schema)).toHaveLength(1);
        });

        it('should detect arrays as non-objects', () => {
            const schema: ParamSchema = { data: { type: 'object', required: true } };
            const errors = validateArgs({ data: [1, 2, 3] }, schema);

            // Arrays have typeof 'object' but we report them as 'array'
            expect(errors).toHaveLength(1);
            expect(errors[0].received).toBe('array');
        });
    });

    describe('multiple errors', () => {
        it('should collect all validation errors', () => {
            const schema: ParamSchema = {
                a: { type: 'string', required: true },
                b: { type: 'number', required: true },
                c: { type: 'boolean', required: true }
            };

            const errors = validateArgs({}, schema);
            expect(errors).toHaveLength(3);
        });
    });

    describe('skip type check for optional undefined', () => {
        it('should not type-check undefined optional params', () => {
            const schema: ParamSchema = {
                optional: { type: 'string', required: false }
            };

            const errors = validateArgs({}, schema);
            expect(errors).toHaveLength(0);
        });
    });
});

describe('formatValidationErrors', () => {
    it('should format single error', () => {
        const errors = [{ param: 'x', expected: 'string', received: 'number', message: "Parameter 'x' expected string, got number" }];
        expect(formatValidationErrors(errors)).toBe("Parameter 'x' expected string, got number");
    });

    it('should format multiple errors with semicolon', () => {
        const errors = [
            { param: 'a', expected: 'string', received: 'undefined', message: 'Error A' },
            { param: 'b', expected: 'number', received: 'string', message: 'Error B' }
        ];
        expect(formatValidationErrors(errors)).toBe('Error A; Error B');
    });
});

// ═══════════════════════════════════════════════════════════════
// [Operation Enhancement] 新类型和约束验证测试
// ═══════════════════════════════════════════════════════════════

describe('validateArgs - array type', () => {
    it('should validate array type', () => {
        const schema: ParamSchema = {
            tags: { type: 'array', itemType: 'string', required: true }
        };

        expect(validateArgs({ tags: ['a', 'b'] }, schema)).toHaveLength(0);
        expect(validateArgs({ tags: 'not-array' }, schema)).toHaveLength(1);
    });

    it('should validate array item types', () => {
        const schema: ParamSchema = {
            numbers: { type: 'array', itemType: 'number', required: true }
        };

        expect(validateArgs({ numbers: [1, 2, 3] }, schema)).toHaveLength(0);

        const errors = validateArgs({ numbers: [1, 'two', 3] }, schema);
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain('numbers[1]');
    });

    it('should allow empty arrays', () => {
        const schema: ParamSchema = {
            items: { type: 'array', itemType: 'string', required: true }
        };

        expect(validateArgs({ items: [] }, schema)).toHaveLength(0);
    });
});

describe('validateArgs - enum type', () => {
    it('should validate enum with valid option', () => {
        const schema: ParamSchema = {
            priority: { type: 'enum', options: ['low', 'medium', 'high'], required: true }
        };

        expect(validateArgs({ priority: 'low' }, schema)).toHaveLength(0);
        expect(validateArgs({ priority: 'medium' }, schema)).toHaveLength(0);
        expect(validateArgs({ priority: 'high' }, schema)).toHaveLength(0);
    });

    it('should reject invalid enum value', () => {
        const schema: ParamSchema = {
            priority: { type: 'enum', options: ['low', 'medium', 'high'], required: true }
        };

        const errors = validateArgs({ priority: 'invalid' }, schema);
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toContain('low');
        expect(errors[0].message).toContain('medium');
        expect(errors[0].message).toContain('high');
    });
});

describe('validateArgs - constraints', () => {
    describe('string constraints', () => {
        it('should validate minLength', () => {
            const schema: ParamSchema = {
                name: { type: 'string', required: true, constraints: { minLength: 3 } }
            };

            expect(validateArgs({ name: 'abc' }, schema)).toHaveLength(0);
            expect(validateArgs({ name: 'ab' }, schema)).toHaveLength(1);
        });

        it('should validate maxLength', () => {
            const schema: ParamSchema = {
                code: { type: 'string', required: true, constraints: { maxLength: 5 } }
            };

            expect(validateArgs({ code: '12345' }, schema)).toHaveLength(0);
            expect(validateArgs({ code: '123456' }, schema)).toHaveLength(1);
        });

        it('should validate pattern', () => {
            const schema: ParamSchema = {
                email: { type: 'string', required: true, constraints: { pattern: '^\\w+@\\w+\\.\\w+$' } }
            };

            expect(validateArgs({ email: 'test@example.com' }, schema)).toHaveLength(0);
            expect(validateArgs({ email: 'invalid-email' }, schema)).toHaveLength(1);
        });
    });

    describe('number constraints', () => {
        it('should validate min', () => {
            const schema: ParamSchema = {
                age: { type: 'number', required: true, constraints: { min: 0 } }
            };

            expect(validateArgs({ age: 0 }, schema)).toHaveLength(0);
            expect(validateArgs({ age: 25 }, schema)).toHaveLength(0);
            expect(validateArgs({ age: -1 }, schema)).toHaveLength(1);
        });

        it('should validate max', () => {
            const schema: ParamSchema = {
                percent: { type: 'number', required: true, constraints: { max: 100 } }
            };

            expect(validateArgs({ percent: 100 }, schema)).toHaveLength(0);
            expect(validateArgs({ percent: 50 }, schema)).toHaveLength(0);
            expect(validateArgs({ percent: 101 }, schema)).toHaveLength(1);
        });
    });

    describe('array length constraints', () => {
        it('should validate array minLength', () => {
            const schema: ParamSchema = {
                items: { type: 'array', itemType: 'string', required: true, constraints: { minLength: 2 } }
            };

            expect(validateArgs({ items: ['a', 'b'] }, schema)).toHaveLength(0);
            expect(validateArgs({ items: ['a'] }, schema)).toHaveLength(1);
        });

        it('should validate array maxLength', () => {
            const schema: ParamSchema = {
                items: { type: 'array', itemType: 'number', required: true, constraints: { maxLength: 3 } }
            };

            expect(validateArgs({ items: [1, 2, 3] }, schema)).toHaveLength(0);
            expect(validateArgs({ items: [1, 2, 3, 4] }, schema)).toHaveLength(1);
        });
    });
});
