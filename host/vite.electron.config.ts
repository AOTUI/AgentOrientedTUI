import { defineConfig, UserConfig } from 'vite';
import { resolve } from 'path';
import { builtinModules } from 'module';

// Common external dependencies for both builds
const commonExternal = [
  'electron',
  'electron-trpc',
  'electron-trpc/main',
  'electron-trpc/renderer',
  'better-sqlite3',
  '@aotui/runtime',
  '@aotui/agent-driver',
  '@aotui/sdk',
  '@ai-sdk/anthropic',
  '@ai-sdk/openai',
  '@ai-sdk/google',
  '@ai-sdk/xai',
  'ai',
  ...builtinModules,
  ...builtinModules.map(m => `node:${m}`),
];

// Build target detection from env
const buildTarget = process.env.ELECTRON_BUILD_TARGET || 'all';

// Main process config (ESM)
const mainConfig: UserConfig = {
  mode: 'production',
  build: {
    ssr: true,
    target: 'node20',
    outDir: 'dist/electron',
    emptyOutDir: buildTarget === 'main' || buildTarget === 'all',
    rollupOptions: {
      external: commonExternal,
      input: resolve(__dirname, 'src/electron/main.ts'),
      output: {
        format: 'es',
        entryFileNames: 'main.mjs',
        chunkFileNames: '[name]-[hash].mjs',
      },
    },
    minify: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
};

// Preload script config (CommonJS for Electron compatibility)
const preloadConfig: UserConfig = {
  mode: 'production',
  build: {
    ssr: true,
    target: 'node20',
    outDir: 'dist/electron',
    emptyOutDir: false, // Don't empty - main already built
    rollupOptions: {
      external: commonExternal,
      input: resolve(__dirname, 'src/electron/preload.ts'),
      output: {
        format: 'cjs',
        entryFileNames: 'preload.cjs',
        exports: 'auto',
      },
    },
    minify: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
};

// Export config based on build target
export default defineConfig(
  buildTarget === 'preload' ? preloadConfig :
  buildTarget === 'main' ? mainConfig :
  mainConfig // Default to main, preload will be built separately
);
