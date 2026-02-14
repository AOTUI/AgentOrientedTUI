/**
 * AOTUI SDK - HTML Utils Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeJsonForAttr } from '../../src/utils/index.js';

describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
        expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
        expect(escapeHtml("'single'")).toBe('&#39;single&#39;');
        expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('should handle empty strings', () => {
        expect(escapeHtml('')).toBe('');
    });

    it('should handle strings without special characters', () => {
        expect(escapeHtml('hello world')).toBe('hello world');
    });

    it('should handle mixed content', () => {
        expect(escapeHtml('<div class="test">')).toBe('&lt;div class=&quot;test&quot;&gt;');
    });
});

describe('escapeJsonForAttr', () => {
    it('should stringify and escape JSON objects', () => {
        const obj = { name: 'test' };
        const result = escapeJsonForAttr(obj);
        expect(result).toContain('"name":"test"');
    });

    it('should escape single quotes', () => {
        const obj = { text: "it's a test" };
        const result = escapeJsonForAttr(obj);
        expect(result).toContain('&#39;');
        expect(result).not.toContain("'");
    });

    it('should escape angle brackets', () => {
        const obj = { html: '<div>' };
        const result = escapeJsonForAttr(obj);
        expect(result).toContain('&lt;div&gt;');
        expect(result).not.toContain('<div>');
    });

    it('should handle nested objects', () => {
        const obj = { nested: { value: 123 } };
        const result = escapeJsonForAttr(obj);
        expect(result).toContain('"nested"');
        expect(result).toContain('"value":123');
    });

    it('should handle arrays', () => {
        const arr = [1, 2, 3];
        const result = escapeJsonForAttr(arr);
        expect(result).toBe('[1,2,3]');
    });
});
