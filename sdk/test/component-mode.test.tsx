/**
 * [RFC-027] Component Mode Integration Test
 * 
 * 验证createTUIApp + View组件的基础功能
 */
import { describe, it, expect } from 'vitest';
import { createTUIApp, View } from '../src/index.js';
import { h } from 'preact';

describe('[RFC-027] Component Mode', () => {
    it('should create TUIApp with component field', () => {
        function TestApp() {
            return h(View, { name: 'TestView' }, 'Hello');
        }

        const app = createTUIApp({
            appName: 'test_app',
            name: 'Test App',
            component: TestApp,
        });

        expect(app).toBeDefined();
        expect(app.displayName).toBe('Test App');
        // component字段被转换为factory对象
        expect(app.kernelConfig.component).toBeDefined();
        expect(app.kernelConfig.component.displayName).toBe('Test App');
        expect(app.kernelConfig.name).toBe('Test App');
    });



    it('kernelConfig should support component field (root removed)', () => {
        function TestApp() {
            return h(View, { name: 'TestView' }, 'Hello');
        }

        const app = createTUIApp({
            appName: 'test_app',
            name: 'Test App',
            component: TestApp,
        });

        // component字段应该存在(已转换为factory)
        expect(app.kernelConfig.component).toBeDefined();
        // root字段不应该存在(已废弃)
        expect(app.kernelConfig.root).toBeUndefined();
    });
});
