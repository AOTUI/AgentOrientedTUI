/**
 * Host Services - Public API
 * 
 * 导出所有服务的公共接口和类型
 * 
 * 注意：前端代码应该只导入类型（type imports），不要导入实现类。
 * 实现类包含 Node.js 模块（如 fs、path），只能在主进程中使用。
 * 前端应该通过 tRPC 调用服务，而不是直接实例化。
 */

// 只导出类型定义，不导出实现类
export type {
    ModelsDevModel,
    ModelsDevProvider,
    ModelsDevAPI,
    ProviderConfig,
    ModelFilter,
    CacheStatus,
} from './model-registry.js';

// 如果需要在主进程中使用实现类，请直接从 model-registry.js 导入
// import { ModelRegistry } from './model-registry.js';
