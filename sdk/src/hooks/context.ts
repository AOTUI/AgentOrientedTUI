/**
 * AOTUI SDK - View Context (兼容层)
 *
 * [RFC-003] 此文件现在是一个重导出层。
 * 所有类型和 Context 定义已移至 `../contexts/index.ts`。
 *
 * 保留此文件以维持现有 import 路径的向后兼容性。
 *
 * @deprecated 新代码请直接从 '../contexts/index.js' 导入
 */

// 重导出所有类型和 Context
export {

  ViewMetaContext,
  OperationRegistryContext,
  MountableViewRegistryContext,
  DynamicViewRegistryContext,
  RefRegistryContext,
  AppConfigContext,

  // 类型
  type SimpleOperationHandler,
  type IViewForContext,
  type IViewMeta,
  type IOperationRegistry,
  type IMountableViewRegistry,
  type IDynamicViewRegistry,
  type IRefRegistry,
  type IAppConfig,

} from "../contexts/index.js";

// 从 Runtime 重导出 Operation 类型
export type { OperationResult, OperationError } from "@aotui/runtime/spi";
