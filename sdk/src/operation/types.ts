/**
 * AOTUI SDK - Operation Type Definitions
 *
 * [SSOT] 所有 Operation 相关类型的唯一来源
 *
 * 设计原则:
 * - 此文件不导入任何运行时代码 (仅 preact 类型)
 * - 类型按用途分组
 * - 每个类型都有 JSDoc 文档
 *
 * @module @aotui/sdk/operation/types
 */

// ═══════════════════════════════════════════════════════════════
// 1. 基础类型 (Primitives)
// ═══════════════════════════════════════════════════════════════

/**
 * 支持的基础参数类型
 *
 * @description 基本类型用于定义单值参数
 */
export type ParamBaseType = "string" | "number" | "boolean" | "object" | "reference";

/**
 * 支持的参数类型（包含数组和枚举）
 *
 * @description
 * - 基础类型: `string`, `number`, `boolean`, `object`
 * - 复合类型: `array` (需配合 itemType), `enum` (需配合 options)
 */
export type ParamType = ParamBaseType | "array" | "enum";

// ═══════════════════════════════════════════════════════════════
// 2. 参数定义 (Parameter Definition)
// ═══════════════════════════════════════════════════════════════

/**
 * 参数约束配置
 *
 * @description 用于限制参数值的范围或格式
 *
 * @example
 * // 字符串长度约束
 * { minLength: 1, maxLength: 100 }
 *
 * @example
 * // 数字范围约束
 * { min: 0, max: 100 }
 *
 * @example
 * // 正则表达式约束
 * { pattern: '^[a-z]+$' }
 */
export interface ParamConstraints {
  /** 最小长度 (string/array) */
  minLength?: number;
  /** 最大长度 (string/array) */
  maxLength?: number;
  /** 正则表达式模式 (string) */
  pattern?: string;
  /** 最小值 (number) */
  min?: number;
  /** 最大值 (number) */
  max?: number;
}

/**
 * 单个参数的定义
 *
 * @description 定义 Operation 的一个参数，包括类型、是否必需、描述等
 *
 * @example
 * // 必需的字符串参数
 * { type: 'string', required: true, desc: '消息内容' }
 *
 * @example
 * // 带约束的数字参数
 * { type: 'number', constraints: { min: 0, max: 100 } }
 *
 * @example
 * // 枚举参数
 * { type: 'enum', options: ['active', 'inactive'] as const }
 */
export interface ParamDef {
  /** 参数类型 */
  type: ParamType;
  /** 是否必需 (默认: false) */
  required?: boolean;
  /** 参数描述（显示给 Agent） */
  desc?: string;
  /** 参数约束 */
  constraints?: ParamConstraints;
  /** 数组元素类型 (type: 'array' 时必填) */
  itemType?: ParamBaseType;
  /** 枚举选项 (type: 'enum' 时必填) */
  options?: readonly string[];
  /** 默认值 */
  default?: unknown;
  /** 引用类型 (type: 'reference' 时必填，如 'Message', 'Todo') */
  refType?: string;
}

/**
 * 参数 Schema（键值对形式）
 *
 * @description 定义 Operation 的所有参数
 *
 * @example
 * const messageParams: ParamSchema = {
 *     content: { type: 'string', required: true, desc: '消息内容' },
 *     priority: { type: 'enum', options: ['low', 'high'] as const }
 * };
 */
export type ParamSchema = Record<string, ParamDef>;

// ═══════════════════════════════════════════════════════════════
// 3. 类型推断 (Type Inference)
// ═══════════════════════════════════════════════════════════════

/**
 * 从 ParamType 推断 TypeScript 类型
 *
 * @internal 内部使用的类型推断工具
 */
type InferParamType<T extends ParamDef> = T["type"] extends "string"
  ? string
  : T["type"] extends "number"
  ? number
  : T["type"] extends "boolean"
  ? boolean
  : T["type"] extends "object"
  ? Record<string, unknown>
  : T["type"] extends "reference"
  ? Record<string, unknown> // 运行时是对象，但在 LLM 看来是字符串
  : T["type"] extends "array"
  ? T["itemType"] extends "string"
  ? string[]
  : T["itemType"] extends "number"
  ? number[]
  : T["itemType"] extends "boolean"
  ? boolean[]
  : T["itemType"] extends "object"
  ? Record<string, unknown>[]
  : unknown[]
  : T["type"] extends "enum"
  ? T["options"] extends readonly (infer U)[]
  ? U
  : string
  : unknown;

/**
 * 从 ParamSchema 推断 handler 参数类型
 *
 * @description
 * 根据 ParamSchema 自动推断出 handler 函数的参数类型:
 * - `required: true` 的字段为必需
 * - 其他字段为可选
 *
 * @example
 * const schema = {
 *     name: { type: 'string' as const, required: true as const },
 *     age: { type: 'number' as const }
 * } satisfies ParamSchema;
 *
 * type Args = InferArgs<typeof schema>;
 * // => { name: string; age?: number }
 */
export type InferArgs<T extends ParamSchema> = {
  // Required fields
  [K in keyof T as T[K]["required"] extends true ? K : never]: InferParamType<
    T[K]
  >;
} & {
  // Optional fields
  [K in keyof T as T[K]["required"] extends true ? never : K]?: InferParamType<
    T[K]
  >;
};

// ═══════════════════════════════════════════════════════════════
// 4. Runtime Result Types
// ═══════════════════════════════════════════════════════════════

export interface OperationError {
  /** 错误码 */
  code: string;
  /** 错误信息 */
  message: string;
  /** 额外上下文 */
  context?: Record<string, unknown>;
}

/**
 * Operation Handler 的返回结果
 *
 * @description Operation 执行后必须返回的结果结构
 *
 * @example
 * // 成功结果
 * { success: true, data: { messageId: '123' } }
 *
 * @example
 * // 失败结果
 * { success: false, error: { code: 'INVALID_INPUT', message: '内容不能为空' } }
 */
export interface OperationResult {
  /** 是否成功 */
  success: boolean;
  /** 成功时的返回数据 */
  data?: Record<string, unknown>;
  /** 失败时的错误信息 */
  error?: OperationError;
}

// ═══════════════════════════════════════════════════════════════
// 6. 验证相关类型 (Validation Types)
// ═══════════════════════════════════════════════════════════════

/**
 * 参数验证错误
 */
export interface ValidationError {
  /** 参数名 */
  param: string;
  /** 错误类型 */
  type: "missing" | "type_mismatch" | "constraint_violation";
  /** 错误描述 */
  message: string;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误列表 */
  errors: ValidationError[];
}
