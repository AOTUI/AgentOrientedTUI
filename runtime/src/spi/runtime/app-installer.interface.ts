import type { DesktopID, AppID } from '../core/types.js';
import type { AppLaunchConfig } from '../app/app-config.interface.js';

/**
 * App 安装服务接口
 * 
 * 职责: 在 Desktop 上安装 App
 * 消费者: Kernel, Product Layer
 * 
 * 可替换场景: 不同的 App 加载策略 (Worker/InProcess/Remote)
 */
export interface IAppInstaller {
    /**
     * [Worker-Only] 安装 App
     * 
     * App 运行在独立的 Worker Thread 中。
     * 
     * [C1 Fix] workerScriptPath 现在是可选的，默认使用 Runtime 内置的 worker-runtime
     * 
     * @param desktopId - Desktop ID
     * @param appModulePath - App 模块路径
     * @param options - 安装选项
     */
    installDynamicWorkerApp(
        desktopId: DesktopID,
        appModulePath: string,
        options?: {
            workerScriptPath?: string;
            appId?: string;
            name?: string;
            /** [RFC-013] App description for Agent */
            description?: string;
            whatItIs?: string;
            whenToUse?: string;
            config?: AppLaunchConfig;
        }
    ): Promise<AppID>;
}
