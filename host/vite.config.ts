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
            external: (id) => {
                // Node.js built-in modules
                if (['electron', 'fs', 'path', 'os', 'crypto', 'url'].includes(id)) return true;
                // Never exclude npm packages (bare specifiers or resolved node_modules paths)
                if (!id.startsWith('.') && !id.startsWith('/')) return false;
                if (id.includes('node_modules')) return false;
                // Exclude backend-only local modules from the GUI bundle
                if (/\/db\//.test(id)) return true;
                if (/\/services\/model-registry\.js$/.test(id)) return true;
                if (/\/services\/llm-config-manager\.js$/.test(id)) return true;
                if (/\/server\//.test(id)) return true;
                if (/\/electron\//.test(id)) return true;
                return false;
            },
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
