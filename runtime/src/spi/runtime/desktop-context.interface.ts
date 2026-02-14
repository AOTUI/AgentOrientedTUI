/**
 * SPI Layer - Desktop Context Interface
 * 
 * Desktop 的不可变数据容器。
 * 不包含行为，仅作为 Service 调用时的身份标识。
 * 
 * @module @aotui/runtime/spi
 */

import type { DesktopID, DesktopStatus } from '../core/types.js';

// ============================================================================
// Desktop Context Interface
// ============================================================================

/**
 * Desktop 上下文 (只读数据)
 * 
 * 不包含行为，仅作为 Service 调用时的身份标识。
 * 
 * 设计原则:
 * - 不可变性: 所有属性为 readonly
 * - 最小化: 仅包含必要的身份和状态信息
 * - 可序列化: 可安全地跨边界传递
 * 
 * @example
 * ```typescript
 * const ctx: DesktopContext = {
 *     id: 'desktop_123',
 *     createdAt: Date.now(),
 *     status: 'active'
 * };
 * 
 * // 传递给 Service
 * await appHostService.install(ctx.id, './app.js');
 * ```
 */
export interface DesktopContext {
    /** Desktop 唯一标识符 */
    readonly id: DesktopID;

    /** 创建时间戳 */
    readonly createdAt: number;

    /** 当前状态 */
    readonly status: DesktopStatus;
}

/**
 * Desktop Context Factory
 * 
 * 创建 DesktopContext 实例的工厂函数类型。
 */
export type DesktopContextFactory = (id?: DesktopID) => DesktopContext;

