import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    root: '.',
    base: './',
    build: {
        outDir: 'dist-gui',
        rollupOptions: {
            external: [
                // Exclude Node.js modules and backend code from frontend bundle
                'electron',
                'fs',
                'path',
                'os',
                'crypto',
                'url',
                // Exclude backend services and database
                /^.*\/db\/.*$/,
                /^.*\/services\/model-registry\.js$/,
                /^.*\/services\/llm-config-manager\.js$/,
                /^.*\/core\/.*$/,
                /^.*\/server\/.*$/,
                /^.*\/electron\/.*$/,
            ],
        },
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
            // Prevent frontend from importing backend modules
            '~/core/llm-config-service': resolve(__dirname, 'src/gui/ChatBridge.ts'),
        }
    },
    optimizeDeps: {
        exclude: [
            // Exclude backend modules from optimization
            'electron',
            'fs',
            'path',
            'os',
            'crypto',
            'url',
        ],
    },
    ssr: {
        // Don't try to externalize these for SSR
        noExternal: ['electron-trpc']
    },
    server: {
        port: 5173,
        open: true
    }
});
