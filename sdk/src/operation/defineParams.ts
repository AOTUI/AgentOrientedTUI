import type { ParamSchema } from "./types.js";

/**
 * Define and validate a parameter schema with full type inference.
 */
export function defineParams<T extends ParamSchema>(schema: T): T {
  if (process.env.NODE_ENV !== "production") {
    for (const [name, def] of Object.entries(schema)) {
      const validTypes = ["string", "number", "boolean", "object", "reference", "array", "enum"];
      if (!validTypes.includes(def.type)) {
        throw new Error(
          `[AOTUI SDK] defineParams: Invalid type "${def.type}" for param "${name}". ` +
            `Expected one of: ${validTypes.join(", ")}`,
        );
      }

      if (def.type === "array" && !def.itemType) {
        throw new Error(
          `[AOTUI SDK] defineParams: param "${name}" is array type but missing "itemType". ` +
            `Example: { type: 'array', itemType: 'string' }`,
        );
      }

      const validItemTypes = ["string", "number", "boolean", "object", "reference"];
      if (def.itemType && !validItemTypes.includes(def.itemType)) {
        throw new Error(
          `[AOTUI SDK] defineParams: Invalid itemType "${def.itemType}" for param "${name}". ` +
            `Expected one of: ${validItemTypes.join(", ")}`,
        );
      }

      if (def.type === "enum" && (!def.options || def.options.length === 0)) {
        throw new Error(
          `[AOTUI SDK] defineParams: param "${name}" is enum type but missing "options". ` +
            `Example: { type: 'enum', options: ['a', 'b'] }`,
        );
      }

      const c = def.constraints;
      if (c?.minLength !== undefined && c?.maxLength !== undefined && c.minLength > c.maxLength) {
        throw new Error(
          `[AOTUI SDK] defineParams: param "${name}" has minLength (${c.minLength}) > maxLength (${c.maxLength})`,
        );
      }

      if (c?.min !== undefined && c?.max !== undefined && c.min > c.max) {
        throw new Error(
          `[AOTUI SDK] defineParams: param "${name}" has min (${c.min}) > max (${c.max})`,
        );
      }
    }
  }

  return schema;
}
