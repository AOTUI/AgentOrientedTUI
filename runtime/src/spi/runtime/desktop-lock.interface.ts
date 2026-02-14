import type { DesktopID } from '../core/types.js';

/**
 * 锁状态信息
 */
export interface LockInfo {
    /** 锁持有者 ID */
    ownerId: string;
    /** 锁获取时间戳 */
    acquiredAt: number;
    /** 锁是否有效 (未过期) */
    valid: boolean;
}

/**
 * Desktop 锁服务接口
 * 
 * 职责: 并发控制，防止多 Agent 同时操作同一 Desktop
 * 消费者: Kernel (验证/刷新), Bridge (获取/释放)
 * 
 * 可替换场景: 分布式锁实现 (Redis/Zookeeper)
 */
export interface IDesktopLockService {
    /**
     * 获取 Desktop 写锁
     * 
     * - 支持重入: 同一 owner 多次获取会刷新时间戳
     * - 锁过期时: 允许新 owner 接管
     * 
     * @throws {AOTUIError} DESKTOP_LOCKED 如果已被其他 owner 锁定且未过期
     */
    acquireLock(desktopId: DesktopID, ownerId: string): void;

    /**
     * 释放 Desktop 写锁
     * 仅锁持有者可释放，其他人调用静默忽略
     */
    releaseLock(desktopId: DesktopID, ownerId: string): void;

    /**
     * 验证锁所有权
     * @returns true 如果 ownerId 持有有效锁
     */
    verifyLock(desktopId: DesktopID, ownerId: string): boolean;

    /**
     * 刷新锁时间戳
     * 防止长时间操作导致锁过期
     */
    refreshLock(desktopId: DesktopID, ownerId: string): void;

    /**
     * 获取锁信息 (用于调试/监控)
     */
    getLockInfo(desktopId: DesktopID): LockInfo | undefined;
}
