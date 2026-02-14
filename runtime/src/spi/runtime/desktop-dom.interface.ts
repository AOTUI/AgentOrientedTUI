/**
 * SPI Layer - IDesktopDOM Interface
 * 
 * [C2 FIX] 从 AppManager 提取的接口，定义 Engine 层模块与 Desktop 交互的最小契约。
 * 
 * 设计原则:
 * - Interface Segregation: 只暴露 AppManager 等模块真正需要的方法
 * - Stable Dependency: Engine 层模块依赖此 SPI 接口，而非具体 Desktop 实现
 * 
 * @module @aotui/runtime/spi
 */

import type { DesktopID, AppID } from '../core/types.js';

/**
 * Desktop DOM 操作接口
 * 
 * Engine 层模块（如 AppManager, ViewManager）通过此接口与 Desktop 交互，
 * 而非直接依赖 Desktop 类。这实现了依赖反转，使模块可独立测试。
 * 
 * @example
 * ```typescript
 * class AppManager {
 *     constructor(private readonly desktop: IDesktopDOM) {}
 *     
 *     async installStatic(name: string, html: string): Promise<AppID> {
 *         const doc = this.desktop.getDocument();
 *         // ...
 *     }
 * }
 * ```
 */
export interface IDesktopDOM {
    /** Desktop 唯一标识 */
    readonly id: DesktopID;

    /** 获取 Document 对象 (用于 DOM 操作) */
    getDocument(): Document;

    /** 获取 Window 对象 (linkedom Window) */
    getWindow(): any;

    /** 发送更新信号 */
    emitSignal(reason: string): void;

    /** 记录系统日志 */
    logSystem(message: string, level?: 'info' | 'warn' | 'error'): void;

    /** 记录 App 操作日志 */
    logAppOperation(appId: AppID, message: string, level?: 'info' | 'warn' | 'error'): void;

    /** [A1] 观察 App 沙箱的 DOM 变化 */
    observeAppDOM(appId: AppID, window: any): void;

    /** [A1] 停止观察 App 沙箱 */
    stopObservingApp(appId: AppID): void;
}
