/**
 * AOTUI SDK - Argument Validation (Enhanced)
 *
 * Runtime validation for Operation parameters.
 * Bridges the gap between compile-time TypeScript and runtime Agent calls.
 *
 * [Operation Enhancement] Supports:
 * - Basic types: string, number, boolean, object
 * - Array types with itemType validation
 * - Enum types with options validation
 * - Constraints: minLength, maxLength, pattern, min, max
 *
 * @example
 * ```typescript
 * const errors = validateArgs(
 *     { content: 'hello', tags: ['a', 'b'] },
 *     {
 *         content: { type: 'string', required: true, constraints: { maxLength: 100 } },
 *         tags: { type: 'array', itemType: 'string' },
 *         priority: { type: 'enum', options: ['low', 'medium', 'high'] }
 *     }
 * );
 * ```
 */

import type {
  ParamSchema,
  ParamType,
  ParamDef,
  ParamBaseType,
  ParamConstraints,
} from "../operation/types.js";

/**
 * Validation error for a single parameter
 */
export interface ValidationError {
  /** Parameter name */
  param: string;
  /** Expected type description */
  expected: string;
  /** Actual received type */
  received: string;
  /** Human-readable error message */
  message: string;
}

/**
 * Validate arguments against a ParamSchema
 *
 * @param args - Arguments received from Agent
 * @param schema - Parameter schema defined by developer
 * @returns Array of validation errors (empty if valid)
 */
export function validateArgs(
  args: Record<string, unknown>,
  schema: ParamSchema,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [name, def] of Object.entries(schema)) {
    const value = args[name];

    // Check required
    if (def.required === true && (value === undefined || value === null)) {
      errors.push({
        param: name,
        expected: formatExpected(def),
        received: value === null ? "null" : "undefined",
        message: `Parameter '${name}' is required but was ${value === null ? "null" : "undefined"}`,
      });
      continue;
    }

    // Skip validation if optional and not provided
    if (value === undefined) continue;

    // Type validation
    const typeError = validateType(name, value, def);
    if (typeError) {
      errors.push(typeError);
      continue; // Skip constraint validation if type is wrong
    }

    // Constraint validation
    const constraintErrors = validateConstraints(name, value, def);
    errors.push(...constraintErrors);
  }

  return errors;
}

/**
 * Validate type of a value against ParamDef
 */
function validateType(
  name: string,
  value: unknown,
  def: ParamDef,
): ValidationError | null {
  const actualType = getActualType(value);

  switch (def.type) {
    case "array":
      if (!Array.isArray(value)) {
        return {
          param: name,
          expected: `array<${def.itemType || "any"}>`,
          received: actualType,
          message: `Parameter '${name}' expected array, got ${actualType}`,
        };
      }
      // Validate item types if itemType is specified
      if (def.itemType) {
        for (let i = 0; i < (value as unknown[]).length; i++) {
          const item = (value as unknown[])[i];
          const itemType = getActualType(item);
          if (!isBaseTypeMatch(itemType, def.itemType)) {
            return {
              param: name,
              expected: `array<${def.itemType}>`,
              received: `array containing ${itemType} at index ${i}`,
              message: `Parameter '${name}[${i}]' expected ${def.itemType}, got ${itemType}`,
            };
          }
        }
      }
      return null;

    case "enum":
      if (!def.options || !def.options.includes(String(value))) {
        return {
          param: name,
          expected: `enum(${def.options?.join(" | ") || "no options"})`,
          received: String(value),
          message: `Parameter '${name}' must be one of [${def.options?.join(", ")}], got '${value}'`,
        };
      }
      return null;

    case "reference":
      // [RFC-Reference] Reference types can be:
      // 1. String (Raw Reference ID from LLM, e.g. "recent_msgs[0]")
      // 2. Object (Resolved Reference from Runtime, e.g. Message object)
      // Both are valid depending on the resolution stage.
      if (actualType === "string" || actualType === "object") {
        return null;
      }
      return {
        param: name,
        expected: `reference<${def.refType || "any"}>`,
        received: actualType,
        message: `Parameter '${name}' expected reference (string or object), got ${actualType}`,
      };

    default:
      // Basic types: string, number, boolean, object
      if (!isBaseTypeMatch(actualType, def.type as ParamBaseType)) {
        return {
          param: name,
          expected: def.type,
          received: actualType,
          message: `Parameter '${name}' expected ${def.type}, got ${actualType}`,
        };
      }
      return null;
  }
}

/**
 * Validate constraints
 */
function validateConstraints(
  name: string,
  value: unknown,
  def: ParamDef,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const c = def.constraints;
  if (!c) return errors;

  // String constraints
  if (typeof value === "string") {
    if (c.minLength !== undefined && value.length < c.minLength) {
      errors.push({
        param: name,
        expected: `length >= ${c.minLength}`,
        received: `length = ${value.length}`,
        message: `Parameter '${name}' must have at least ${c.minLength} characters`,
      });
    }
    if (c.maxLength !== undefined && value.length > c.maxLength) {
      errors.push({
        param: name,
        expected: `length <= ${c.maxLength}`,
        received: `length = ${value.length}`,
        message: `Parameter '${name}' must have at most ${c.maxLength} characters`,
      });
    }
    if (c.pattern !== undefined) {
      try {
        const regex = new RegExp(c.pattern);
        if (!regex.test(value)) {
          errors.push({
            param: name,
            expected: `match pattern ${c.pattern}`,
            received: value,
            message: `Parameter '${name}' must match pattern /${c.pattern}/`,
          });
        }
      } catch {
        // Invalid regex pattern - skip validation
      }
    }
  }

  // Number constraints
  if (typeof value === "number") {
    if (c.min !== undefined && value < c.min) {
      errors.push({
        param: name,
        expected: `>= ${c.min}`,
        received: String(value),
        message: `Parameter '${name}' must be at least ${c.min}`,
      });
    }
    if (c.max !== undefined && value > c.max) {
      errors.push({
        param: name,
        expected: `<= ${c.max}`,
        received: String(value),
        message: `Parameter '${name}' must be at most ${c.max}`,
      });
    }
  }

  // Array length constraints
  if (Array.isArray(value)) {
    if (c.minLength !== undefined && value.length < c.minLength) {
      errors.push({
        param: name,
        expected: `length >= ${c.minLength}`,
        received: `length = ${value.length}`,
        message: `Parameter '${name}' must have at least ${c.minLength} items`,
      });
    }
    if (c.maxLength !== undefined && value.length > c.maxLength) {
      errors.push({
        param: name,
        expected: `length <= ${c.maxLength}`,
        received: `length = ${value.length}`,
        message: `Parameter '${name}' must have at most ${c.maxLength} items`,
      });
    }
  }

  return errors;
}

/**
 * Format expected type description
 */
function formatExpected(def: ParamDef): string {
  switch (def.type) {
    case "array":
      return `array<${def.itemType || "any"}>${def.required ? " (required)" : ""}`;
    case "enum":
      return `enum(${def.options?.join(" | ") || "no options"})${def.required ? " (required)" : ""}`;
    default:
      return `${def.type}${def.required ? " (required)" : ""}`;
  }
}

/**
 * Get the runtime type of a value
 */
function getActualType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Check if actual type matches expected base ParamType
 */
function isBaseTypeMatch(actual: string, expected: ParamBaseType): boolean {
  if (expected === "object") {
    // object type should match plain objects, not null or array
    return actual === "object";
  }
  return actual === expected;
}

/**
 * Format validation errors into a single message
 *
 * @param errors - Array of validation errors
 * @returns Formatted error message
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 1) {
    return errors[0].message;
  }
  return errors.map((e) => e.message).join("; ");
}
