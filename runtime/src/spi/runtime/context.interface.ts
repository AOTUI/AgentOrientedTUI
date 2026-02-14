/**
 * Runtime Context
 * 
 * [RFC-026] Standardized Context Injection
 * Provides environment awareness for the Runtime and Apps.
 */
export interface IRuntimeContext {
    /** Environment Variables (Project Path, User Info, etc.) */
    env: Record<string, string | number | boolean>;
}
