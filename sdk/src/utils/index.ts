/**
 * AOTUI SDK Utilities
 */

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape JSON for safe embedding in HTML attributes
 */
export function escapeJsonForAttr(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Argument validation
export {
  validateArgs,
  formatValidationErrors,
  type ValidationError,
} from "./validateArgs.js";
