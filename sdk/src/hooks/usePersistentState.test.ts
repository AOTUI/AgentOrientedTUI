import { describe, expect, it } from 'vitest';
import { shouldHydratePersistentState } from './usePersistentState.js';

describe('shouldHydratePersistentState', () => {
    it('hydrates on normal startup by default', () => {
        expect(
            shouldHydratePersistentState({ startupKind: 'normal' })
        ).toBe(true);
    });

    it('does not hydrate on reinitialize by default', () => {
        expect(
            shouldHydratePersistentState({ startupKind: 'reinitialize', reason: 'context_compaction' })
        ).toBe(false);
    });

    it('allows opt-in hydration on reinitialize', () => {
        expect(
            shouldHydratePersistentState(
                { startupKind: 'reinitialize', reason: 'context_compaction' },
                { rehydrateOnReinitialize: true }
            )
        ).toBe(true);
    });
});
