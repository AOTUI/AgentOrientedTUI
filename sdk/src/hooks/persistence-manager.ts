/**
 * 持久化状态管理器
 * 
 * 功能：
 * - 注册所有活跃的 usePersistentState 实例
 * - 在应用关闭时批量刷新所有状态到磁盘
 * - 运行时不进行任何写操作
 */

import { writeJson } from './usePersistentState.js';

export interface PersistentStateEntry {
  /** 状态存储文件路径 */
  filePath: string;
  /** 获取当前状态的函数 */
  getState: () => unknown;
}

class PersistenceManager {
  private entries = new Map<string, PersistentStateEntry>();
  private flushing = false;

  /**
   * 注册一个持久化状态
   */
  register(key: string, entry: PersistentStateEntry): void {
    this.entries.set(key, entry);
    console.log(`[PersistenceManager] Registered state: ${key}`);
  }

  /**
   * 注销一个持久化状态
   */
  unregister(key: string): void {
    this.entries.delete(key);
    console.log(`[PersistenceManager] Unregistered state: ${key}`);
  }

  /**
   * 刷新所有持久化状态到磁盘
   * 仅在应用关闭时调用
   */
  async flushAll(): Promise<void> {
    if (this.flushing) {
      console.warn('[PersistenceManager] Flush already in progress');
      return;
    }

    this.flushing = true;
    console.log(`[PersistenceManager] Flushing ${this.entries.size} state(s) to disk...`);

    const promises: Promise<void>[] = [];

    for (const [key, entry] of this.entries) {
      try {
        const state = entry.getState();
        const promise = writeJson(entry.filePath, state)
          .then(() => {
            console.log(`[PersistenceManager] ✓ Flushed state: ${key}`);
          })
          .catch((error: unknown) => {
            console.error(`[PersistenceManager] ✗ Failed to flush state: ${key}`, error);
          });
        promises.push(promise);
      } catch (error) {
        console.error(`[PersistenceManager] Error getting state for ${key}:`, error);
      }
    }

    await Promise.all(promises);
    this.flushing = false;
    console.log('[PersistenceManager] Flush complete');
  }

  /**
   * 获取当前注册的状态数量
   */
  get size(): number {
    return this.entries.size;
  }
}

/** 全局单例 */
export const persistenceManager = new PersistenceManager();
