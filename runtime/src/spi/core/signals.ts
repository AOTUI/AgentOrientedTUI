/**
 * SPI Layer - Signal Types
 * 
 * 定义 Runtime 发出的信号类型。
 */

import type { DesktopID } from './types.js';

/**
 * 更新信号
 * 
 * 当 Desktop 状态发生变化时发出。
 */
export interface UpdateSignal {
    desktopId: DesktopID;
    timestamp: number;
    reason: 'dom_mutation' | 'app_opened' | 'app_closed' | 'manual_refresh';
}
