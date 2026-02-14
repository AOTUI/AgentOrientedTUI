import { describe, expect, it } from 'vitest';
import TokenMonitorAppFactory from '../src/tui/index.js';

describe('token monitor app factory', () => {
    it('exposes display name', () => {
        const factory = TokenMonitorAppFactory as { displayName?: string };
        expect(factory.displayName).toBe('Token Monitor App');
    });
});
