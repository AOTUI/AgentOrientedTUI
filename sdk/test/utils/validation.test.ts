/**
 * AOTUI SDK - Validation Utils Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
    validateOperationName,
    validateAppId,
    validateViewId,
    validateFunctionName,
    assertValidOperationName
} from '../../src/utils/validation.js';

describe('validateOperationName', () => {
    it('should accept valid snake_case names', () => {
        expect(validateOperationName('send_message')).toBe(true);
        expect(validateOperationName('get_user_info')).toBe(true);
        expect(validateOperationName('a')).toBe(true);
        expect(validateOperationName('action1')).toBe(true);
        expect(validateOperationName('do_something_2')).toBe(true);
    });

    it('should reject invalid names', () => {
        // PascalCase
        expect(validateOperationName('SendMessage')).toBe(false);
        // camelCase
        expect(validateOperationName('sendMessage')).toBe(false);
        // kebab-case
        expect(validateOperationName('send-message')).toBe(false);
        // starts with number
        expect(validateOperationName('1action')).toBe(false);
        // empty
        expect(validateOperationName('')).toBe(false);
        // uppercase
        expect(validateOperationName('SEND')).toBe(false);
    });
});

describe('validateAppId', () => {
    it('should accept valid app IDs', () => {
        expect(validateAppId('app_0')).toBe(true);
        expect(validateAppId('app_1')).toBe(true);
        expect(validateAppId('app_99')).toBe(true);
    });

    it('should reject invalid app IDs', () => {
        expect(validateAppId('app')).toBe(false);
        expect(validateAppId('app_')).toBe(false);
        expect(validateAppId('app_a')).toBe(false);
        expect(validateAppId('application_0')).toBe(false);
        expect(validateAppId('0')).toBe(false);
    });
});

describe('validateViewId', () => {
    it('should accept valid view IDs', () => {
        expect(validateViewId('view_0')).toBe(true);
        expect(validateViewId('view_1')).toBe(true);
        expect(validateViewId('view_99')).toBe(true);
    });

    it('should reject invalid view IDs', () => {
        expect(validateViewId('view')).toBe(false);
        expect(validateViewId('view_')).toBe(false);
        expect(validateViewId('view_a')).toBe(false);
    });
});

describe('validateFunctionName', () => {
    it('should accept valid system commands', () => {
        expect(validateFunctionName('system-open_app')).toBe(true);
        expect(validateFunctionName('system-mount_view')).toBe(true);
    });

    it('should accept valid app operations', () => {
        expect(validateFunctionName('app_0-view_0-send_message')).toBe(true);
        expect(validateFunctionName('app_1-view_2-get_data')).toBe(true);
    });

    it('should reject invalid function names', () => {
        // Missing parts
        expect(validateFunctionName('app_0-view_0')).toBe(false);
        // Invalid app ID
        expect(validateFunctionName('app-view_0-action')).toBe(false);
        // Invalid operation name
        expect(validateFunctionName('app_0-view_0-SendMessage')).toBe(false);
    });
});

describe('assertValidOperationName', () => {
    it('should not throw for valid names', () => {
        expect(() => assertValidOperationName('send_message')).not.toThrow();
    });

    it('should throw for invalid names with context', () => {
        expect(() => assertValidOperationName('SendMessage', 'defineOperation'))
            .toThrow('Invalid operation name "SendMessage" in defineOperation');
    });

    it('should throw for invalid names without context', () => {
        expect(() => assertValidOperationName('bad-name'))
            .toThrow('Must be snake_case');
    });
});
