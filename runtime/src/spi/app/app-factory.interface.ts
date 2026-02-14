/**
 * TUI App Factory Interface
 *
 * 第三方 App 开发者需要导出符合此接口的 factory 对象。
 * Runtime 通过此接口创建 App 实例。
 *
 * [方案 B] 支持两种模式：
 * - 传统模式：manifest + create() - 第三方 App
 * - KernelConfig 模式：kernelConfig - SDK 工厂返回
 *
 * @module @aotui/runtime/spi/app-factory
 */

import type { IAOTUIApp } from './app.interface.js';
import type { AOAppManifest } from './aoapp.js';
import type { AppKernelConfig } from './app-kernel.interface.js';

/**
 * TUI App 工厂接口 (支持双模式)
 *
 * 模式 1 (传统)：第三方 App 使用
 * @example
 * ```typescript
 * export const factory: TUIAppFactory = {
 *     manifest,
 *     create: () => new WeatherApp()
 * };
 * ```
 *
 * 模式 2 (方案 B)：SDK 工厂返回
 * @example
 * ```typescript
 * export default createTUIApp({ name: 'Chat', component: ChatApp });
 * // 返回 { kernelConfig, displayName, create: () => throw... }
 * ```
 */
export interface TUIAppFactory {
    /**
     * App 清单 (传统模式)
     * 包含 App 的元数据，如名称、版本、描述等。
     */
    readonly manifest?: AOAppManifest;

    /**
     * 创建 App 实例 (传统模式)
     * 每次调用应返回一个新的 IAOTUIApp 实例。
     * [方案 B] 新模式下此方法可能抛错，应检查 kernelConfig
     */
    create?(): IAOTUIApp;

    /**
     * [方案 B] App 内核配置
     * 由 SDK 工厂返回，Worker Runtime 用此配置实例化 AppKernel
     */
    readonly kernelConfig?: AppKernelConfig;

    /**
     * [方案 B] 显示名称
     * 用于日志和调试
     */
    readonly displayName?: string;
}

/**
 * 验证对象是否为有效的 TUIAppFactory
 *
 * [方案 B] 支持两种模式：
 * - 传统模式：有 manifest + create
 * - KernelConfig 模式：有 kernelConfig
 */
export function isTUIAppFactory(obj: unknown): obj is TUIAppFactory {
    if (typeof obj !== 'object' || obj === null) {
        return false;
    }

    const factory = obj as Record<string, unknown>;

    // 方案 B: kernelConfig 模式
    if (factory.kernelConfig && typeof factory.kernelConfig === 'object') {
        return true;
    }

    // 传统模式: manifest + create
    if (typeof factory.manifest === 'object' && factory.manifest !== null) {
        if (typeof factory.create === 'function') {
            return true;
        }
    }

    return false;
}

/**
 * 检查工厂是否是 KernelConfig 模式 (方案 B)
 */
export function isKernelConfigFactory(factory: TUIAppFactory): factory is TUIAppFactory & { kernelConfig: AppKernelConfig } {
    return factory.kernelConfig !== undefined;
}

/**
 * 检查工厂是否是传统模式
 */
export function isLegacyFactory(factory: TUIAppFactory): factory is TUIAppFactory & { manifest: AOAppManifest; create: () => IAOTUIApp } {
    return factory.manifest !== undefined && typeof factory.create === 'function';
}
