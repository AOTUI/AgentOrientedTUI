import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    root: __dirname,
    test: {
        environment: 'node',
        environmentMatchGlobs: [
            ['src/gui/**/*.test.{ts,tsx}', 'happy-dom'],
            ['src/gui/**/*.property.test.{ts,tsx}', 'happy-dom'],
            ['test/gui/**/*.test.{ts,tsx}', 'happy-dom'],
            ['test/gui/**/*.property.test.{ts,tsx}', 'happy-dom']
        ],
        globals: true,
        setupFiles: [path.resolve(__dirname, './test/setup.ts')],
        deps: {
            optimizer: {
                web: {
                    enabled: false
                },
                ssr: {
                    enabled: false
                }
            },
            web: {
                transformAssets: false,
                transformCss: false
            }
        }
    }
});
