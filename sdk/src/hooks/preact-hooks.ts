/**
 * AOTUI SDK - Internal Preact Hooks Re-export
 *
 * [P0-1 FIX] This file provides a single-instance guarantee for Preact hooks
 * used within SDK internal modules.
 *
 * SDK internal modules should import hooks from here to avoid circular
 * dependencies with hooks/index.ts while maintaining single Preact instance.
 *
 * @internal This is NOT for external use - external users should import from '@aotui/sdk'
 */
export {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useReducer,
  useContext,
} from "preact/hooks";
