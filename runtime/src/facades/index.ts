/**
 * Facades Layer - Runtime Factory Functions
 * 
 * [P1 FIX] Renamed from "sdk" to "facades" for clarity.
 * 
 * Purpose: Provide simplified factory functions for Product Layer (Server)
 * to create and configure AOTUI Runtime instances.
 * 
 * Note: This is NOT the Developer SDK. For building TUI apps, use @aotui/sdk:
 *   import { ViewBasedApp, View, Operation } from '@aotui/sdk';
 */

// Facade 函数
export { createRuntime, LegacyRuntimeConfig, RuntimeConfig } from './facades.js';
export { defineRuntimeConfig, RuntimeConfigInput } from '../spi/config/index.js';
