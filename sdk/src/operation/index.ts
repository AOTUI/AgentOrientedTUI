/**
 * AOTUI SDK - Operation Domain
 *
 * 统一导出 Operation 相关的所有公开 API
 *
 * @module @aotui/sdk/operation
 */

// ═══════════════════════════════════════════════════════════════
// Types (SSOT from types.ts)
// ═══════════════════════════════════════════════════════════════

export type {
  // 1. Primitives
  ParamBaseType,
  ParamType,

  // 2. Parameter Definition
  ParamConstraints,
  ParamDef,
  ParamSchema,

  // 3. Type Inference
  InferArgs,

  // 4. Handler Types
  OperationHandlerContext,
  OperationError,
  OperationResult,
  OperationHandler,

  // 5. Component Props
  OperationProps,

  // 6. Validation Types
  ValidationError,
  ValidationResult,
} from "./types.js";

// ═══════════════════════════════════════════════════════════════
// Components
// ═══════════════════════════════════════════════════════════════

// Note: Will be moved to this directory in future iteration
export { Operation, defineParams } from "../components/Operation.js";

// ═══════════════════════════════════════════════════════════════
// Hooks
// ═══════════════════════════════════════════════════════════════

// Note: Will be moved to this directory in future iteration
export { useAppOperation } from "../hooks/useAppOperation.js";

// ═══════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════

export { validateArgs, formatValidationErrors } from "../utils/validateArgs.js";
