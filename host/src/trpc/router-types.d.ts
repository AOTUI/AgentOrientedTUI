/**
 * tRPC Router Types - Declaration File
 * 
 * This .d.ts file provides type information without triggering
 * module resolution during Vite's dev server bundling.
 */

import type { appRouter } from './router.js';

export type AppRouter = typeof appRouter;

// Re-export for convenience
export type { LLMConfigRecord, LLMConfigInput } from '../types/llm-config.js';
