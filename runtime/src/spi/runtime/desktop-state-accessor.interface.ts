import type { DesktopID, AppState, DesktopStatus } from '../core/types.js';

/**
 * Desktop 状态访问接口
 * 
 * 职责: 只读访问 Desktop 和 App 状态
 * 消费者: Kernel (序列化)
 * 
 * 可替换场景: 缓存层、远程状态存储
 */
export interface IDesktopStateAccessor {
    /**
     * 获取 App 状态列表 (用于序列化)
     */
    getAppStates(desktopId: DesktopID): AppState[];

    /**
     * 获取 Desktop 状态信息 (用于序列化)
     */
    getDesktopInfo(desktopId: DesktopID): {
        status: DesktopStatus;
        createdAt: number;
    } | undefined;
}
