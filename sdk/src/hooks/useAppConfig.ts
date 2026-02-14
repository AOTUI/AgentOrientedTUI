/**
 * AOTUI SDK - App Configuration Hooks
 *
 * Provides access to application launch configuration (env variables, initial state).
 *
 * @module @aotui/sdk/hooks
 */

import { useContext } from "./preact-hooks.js";
import { AppConfigContext } from "../contexts/index.js";

// Note: AppLaunchConfig is merged with Runtime Context in Runtime Layer
// It supports index signature for direct env access
interface AppLaunchConfig {
    [key: string]: unknown;
}

/**
 * 获取应用启动配置
 *
 * 读取 Runtime 在启动时注入的配置（环境变量、初始状态等）。
 * 配置已包含 Runtime Context 注入的全局变量。
 *
 * @example
 * ```tsx
 * function ChatView() {
 *     const config = useAppConfig();
 *     // Directly access merged config
 *     const topicId = config.AOTUI_TopicID as string;
 * }
 * ```
 */
export function useAppConfig(): AppLaunchConfig {
  const config = useContext(AppConfigContext);
  return config as AppLaunchConfig ?? {};
}

/**
 * 类型安全地访问环境变量
 *
 * 访问注入的 Config/Context 变量。
 *
 * @example
 * ```tsx
 * function ChatView() {
 *     const projectPath = useAppEnv<string>('projectPath');
 * }
 * ```
 *
 * @template T 变量值的类型 (默认 string)
 * @param key 变量名
 * @returns 变量值，如果不存在则为 undefined
 */
export function useAppEnv<T = string>(key: string): T | undefined {
  const config = useAppConfig();
  // Config is now a flat merged object
  return config[key] as T | undefined;
}
