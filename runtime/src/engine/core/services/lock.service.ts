import type { IDesktopLockService, LockInfo, DesktopID } from '../../../spi/index.js';
import { AOTUIError } from '../../../spi/core/errors.js';
import { LOCK_DEFAULTS } from '../../../spi/config/index.js';

interface LockState {
    ownerId: string;
    timestamp: number;
}

/**
 * 内存锁服务实现
 * 
 * 职责: 管理 Desktop 互斥锁。
 * 
 * 特性:
 * - 纯内存存储 (Map)
 * - 支持重入
 * - 自动过期检查
 * - 允许过期接管
 * 
 * 可替换为分布式锁实现 (如 RedisLockService)
 */
export class InMemoryLockService implements IDesktopLockService {
    private locks = new Map<DesktopID, LockState>();
    private readonly ttlMs: number;

    constructor(
        // 依赖注入: 检查 Desktop 是否存在
        private desktopExists: (id: DesktopID) => boolean,
        options?: { ttlMs?: number }
    ) {
        this.ttlMs = options?.ttlMs ?? LOCK_DEFAULTS.ttlMs;
    }

    acquireLock(desktopId: DesktopID, ownerId: string): void {
        if (!this.desktopExists(desktopId)) {
            throw new AOTUIError('DESKTOP_NOT_FOUND', { desktopId });
        }

        const lock = this.locks.get(desktopId);

        if (lock) {
            // 1. 检查是否过期
            if (!this.isLockValid(lock)) {
                // Lock expired, allowing takeover
                // [Strategy] Silent takeover (Last Writer Wins)
                this.locks.set(desktopId, { ownerId, timestamp: Date.now() });
                return;
            }

            // 2. 检查所有者
            if (lock.ownerId !== ownerId) {
                // 有效锁被他人持有 -> 拒绝
                throw new AOTUIError('DESKTOP_LOCKED', {
                    desktopId,
                    ownerId: lock.ownerId,
                    claimant: ownerId,
                });
            }

            // 3. 重入: 刷新时间戳
            lock.timestamp = Date.now();
        } else {
            // 4. 新锁
            this.locks.set(desktopId, { ownerId, timestamp: Date.now() });
        }
    }

    releaseLock(desktopId: DesktopID, ownerId: string): void {
        const lock = this.locks.get(desktopId);
        // 仅 Owner 可释放
        if (lock && lock.ownerId === ownerId) {
            this.locks.delete(desktopId);
        }
    }

    verifyLock(desktopId: DesktopID, ownerId: string): boolean {
        const lock = this.locks.get(desktopId);
        if (!lock) return false;
        if (!this.isLockValid(lock)) return false;
        return lock.ownerId === ownerId;
    }

    refreshLock(desktopId: DesktopID, ownerId: string): void {
        const lock = this.locks.get(desktopId);
        // 仅 Owner 可刷新
        if (lock && lock.ownerId === ownerId) {
            lock.timestamp = Date.now();
        }
    }

    getLockInfo(desktopId: DesktopID): LockInfo | undefined {
        const lock = this.locks.get(desktopId);
        if (!lock) return undefined;
        return {
            ownerId: lock.ownerId,
            acquiredAt: lock.timestamp,
            valid: this.isLockValid(lock)
        };
    }

    /**
     * [Internal] 清理指定 Desktop 的锁
     * 当 Desktop 被销毁时调用
     */
    clearLock(desktopId: DesktopID): void {
        this.locks.delete(desktopId);
    }

    /**
     * [Internal] 清理所有锁
     * 用于 Runtime shutdown。
     */
    clearAll(): void {
        this.locks.clear();
    }

    private isLockValid(lock: LockState): boolean {
        return Date.now() - lock.timestamp < this.ttlMs;
    }
}
