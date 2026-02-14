/**
 * AOTUI SDK Components
 *
 * Semantic components for building AOTUI Views with JSX
 */
export { View, type ViewProps } from "./View.js";

// Operation Component API (v3 - Type Safe)
export {
  Operation,
  defineParams,
  type OperationProps,
  type OperationHandler,
  type OperationResult,
  type OperationError,
  // [P0 FIX] New name for handler context
  type OperationHandlerContext,
  type ParamDef,
  type ParamSchema,
  type ParamType,
  type InferArgs,
} from "./Operation.js";
