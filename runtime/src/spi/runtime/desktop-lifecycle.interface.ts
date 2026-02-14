import type { DesktopID } from '../core/types.js';

/**
 * Desktop 生命周期控制接口
 * 
 * 职责: 暂停/恢复 Desktop
 * 消费者: Kernel
 * 
 * 可替换场景: 不同的暂停策略 (冷冻内存/序列化到磁盘)
 */
export interface IDesktopLifecycleController {
    /**
     * 暂停 Desktop
     * 
     * 会调用所有动态 App 的 onPause()
     */
    suspend(desktopId: DesktopID): Promise<void>;

    /**
     * 恢复 Desktop
     * 
     * 会调用所有动态 App 的 onResume()
     */
    resume(desktopId: DesktopID): Promise<void>;
}
