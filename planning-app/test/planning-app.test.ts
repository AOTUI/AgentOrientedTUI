import { describe, expect, it } from 'vitest';
import PlanningAppFactory from '../src/tui/index.js';

describe('planning app factory', () => {
    it('exposes display name', () => {
        const factory = PlanningAppFactory as { displayName?: string };
        expect(factory.displayName).toBe('Planning App');
    });
});
