import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
    },
    esbuild: {
        jsx: 'automatic',
        jsxImportSource: 'preact',
    },
    resolve: {
        alias: {
            // 确保测试使用编译后的代码
            '../../src/utils/validateArgs.js': resolve(__dirname, 'dist/utils/validateArgs.js'),
            '../../src/components/Operation.js': resolve(__dirname, 'dist/components/Operation.js'),
        }
    }
});

