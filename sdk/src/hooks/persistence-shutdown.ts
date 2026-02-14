/**
 * 持久化关闭监听器
 * 
 * 监听来自Runtime的shutdown信号，触发所有持久化状态的flush操作
 */

import { persistenceManager } from './persistence-manager.js';

let initialized = false;

/**
 * 初始化持久化关闭监听器
 * 自动在SDK启动时调用，无需手动调用
 */
export function initPersistenceShutdown(): void {
  if (initialized) {
    return;
  }

  if (typeof window === 'undefined') {
    console.warn('[PersistenceShutdown] window is undefined, skip initialization');
    return;
  }

  initialized = true;

  window.addEventListener('aotui:shutdown', async (event) => {
    console.log('[PersistenceShutdown] Received shutdown signal, flushing all states...');
    
    try {
      await persistenceManager.flushAll();
      console.log('[PersistenceShutdown] All states flushed successfully');
      
      // 通知Runtime flush完成
      if (event instanceof CustomEvent && typeof event.detail?.resolve === 'function') {
        event.detail.resolve();
      }
    } catch (error) {
      console.error('[PersistenceShutdown] Error during flush:', error);
      
      // 通知Runtime flush失败
      if (event instanceof CustomEvent && typeof event.detail?.reject === 'function') {
        event.detail.reject(error);
      }
    }
  });

  console.log('[PersistenceShutdown] Shutdown listener initialized');
}
