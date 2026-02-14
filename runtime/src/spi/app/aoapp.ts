/**
 * aoapp.json Manifest Types
 * 
 * 定义第三方 TUI App 的清单文件格式。
 * 每个 TUI App 包必须包含 aoapp.json。
 * 
 * @module @aotui/runtime/spi/aoapp
 */

/**
 * View 定义
 */
export interface AOAppView {
    /** View 名称 */
    name: string;
    /** View 描述 */
    description?: string;
}

/**
 * Runtime 兼容性要求
 */
export interface AOAppRuntime {
    /** 最低支持的 Runtime 版本 */
    minVersion?: string;
    /** 最高支持的 Runtime 版本 */
    maxVersion?: string;
}

/**
 * 入口点配置
 */
export interface AOAppEntry {
    /** 主入口文件 (相对路径) */
    main: string;
    /** TypeScript 类型定义文件 (可选) */
    types?: string;
}

/**
 * aoapp.json 清单文件结构
 * 
 * @example
 * ```json
 * {
 *   "name": "weather",
 *   "displayName": "Weather App",
 *   "version": "1.0.0",
 *   "entry": { "main": "./dist/index.js" }
 * }
 * ```
 */
export interface AOAppManifest {
    /** 
     * App 唯一标识符 (用于安装和卸载)
     * 格式: 小写字母、数字、连字符，如 "weather", "todo-list"
     */
    name: string;

    /** 显示名称 (用于 UI 展示) */
    displayName: string;

    /** 语义化版本号 */
    version: string;

    /** App 描述 */
    description?: string;

    /** App 是什么 (用于 Desktop State 展示) */
    whatItIs?: string;

    /** 什么时候用 (用于 Desktop State 展示) */
    whenToUse?: string;

    /** 作者信息 */
    author?: string;

    /** 许可证 */
    license?: string;

    /** Runtime 兼容性 */
    runtime?: AOAppRuntime;

    /** 入口点 */
    entry: AOAppEntry;

    /** View 列表 (用于文档生成) */
    views?: AOAppView[];

    /** [Fix] App 角色 (用于 LLM Prompt) */
    promptRole?: 'user' | 'assistant';
}

/**
 * 验证 aoapp.json 是否有效
 */
export function validateManifest(manifest: unknown): manifest is AOAppManifest {
    if (typeof manifest !== 'object' || manifest === null) {
        return false;
    }

    const m = manifest as Record<string, unknown>;

    // 必填字段检查
    if (typeof m.name !== 'string' || !m.name) return false;
    if (typeof m.displayName !== 'string' || !m.displayName) return false;
    if (typeof m.version !== 'string' || !m.version) return false;

    // entry 检查
    if (typeof m.entry !== 'object' || m.entry === null) return false;
    const entry = m.entry as Record<string, unknown>;
    if (typeof entry.main !== 'string' || !entry.main) return false;

    return true;
}

/**
 * 验证 App 名称格式
 * 规则: 小写字母、数字、连字符，长度 1-50
 */
export function isValidAppName(name: string): boolean {
    return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name) && name.length <= 50;
}
