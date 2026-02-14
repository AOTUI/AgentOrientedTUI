/**
 * App Launch Configuration
 * 
 * Passed to AppKernel during initialization.
 * [RFC-026] Now supports index signature for env vars injection
 */
export interface AppLaunchConfig {
    [key: string]: unknown;
}
