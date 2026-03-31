import { describe, expect, it } from 'vitest';
import { resolvePersistentAppName, shouldHydratePersistentState } from './usePersistentState.js';

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

    it('prefers explicit storageKey over the canonical app_name', () => {
        expect(
            resolvePersistentAppName({
                storageKey: 'custom_namespace',
                appNameFromEnv: 'system_ide',
                appId: 'app_0',
            })
        ).toBe('custom_namespace');
    });

    it('uses the canonical app_name when no explicit storageKey is provided', () => {
        expect(
            resolvePersistentAppName({
                appNameFromEnv: 'system_ide',
                appId: 'app_0',
            })
        ).toBe('system_ide');
    });

    it('falls back to appId only when canonical app_name is unavailable', () => {
        expect(
            resolvePersistentAppName({
                appId: 'app_0',
            })
        ).toBe('app_0');
    });
});
