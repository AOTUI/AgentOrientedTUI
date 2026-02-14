/**
 * AOTUI SDK - Global Ref Registry
 *
 * @deprecated This module is deprecated in favor of AppKernel.exportRefsToIndexMap().
 * @internal This module is for SDK internal use only and is not part of the public API.
 *
 * ## Migration Note
 * 
 * As of RFC-002 Phase 3, Ref data is now managed by AppKernel in the Runtime layer:
 * - AppKernel implements IRefExporter interface
 * - Worker Runtime calls kernel.exportRefsToIndexMap() during snapshot generation
 * - This global registry is retained only for backward compatibility
 *
 * ## Legacy Architecture (no longer used):
 * - SDK's useRef/useArrayRef hooks register Refs through ViewContext
 * - Worker Runtime calls exportToIndexMap() to merge data
 *
 * @module @aotui/sdk/ref-registry
 */

import type { DataPayload, IndexMap } from "@aotui/runtime/spi";

// ============================================================================
// Global Registry Instance
// ============================================================================

/**
 * 全局 Ref 注册表
 *
 * Key 格式: `${viewId}:${refId}` (确保跨 View 唯一性)
 * Value: 原始数据对象
 *
 * 注意: 在 Worker 环境中，这是进程内的单例，不涉及跨线程共享。
 */
const globalRegistry = new Map<string, object>();

// ============================================================================
// Public API
// ============================================================================

/**
 * 注册一个 Ref 到全局 Registry
 *
 * @param viewId - View 实例 ID
 * @param refId - Ref ID (View 内唯一)
 * @param data - 数据对象
 */
export function registerRef(viewId: string, refId: string, data: object): void {
  const fullKey = `${viewId}:${refId}`;
  if (process.env.NODE_ENV !== "production") {
    console.log(`[GlobalRefRegistry] Registering: ${fullKey}`);
  }
  globalRegistry.set(fullKey, data);
}

/**
 * 注销一个 Ref
 *
 * @param viewId - View 实例 ID
 * @param refId - Ref ID
 */
export function unregisterRef(viewId: string, refId: string): void {
  const fullKey = `${viewId}:${refId}`;
  if (process.env.NODE_ENV !== "production") {
    console.log(`[GlobalRefRegistry] Unregistering: ${fullKey}`);
  }
  globalRegistry.delete(fullKey);
}

/**
 * 导出所有 Ref 数据为 IndexMap 格式
 *
 * 用于 Worker Runtime 在生成 Snapshot 时合并到 Transformer 的 indexMap。
 *
 * IndexMap 的 key 格式与 Transformer 保持一致:
 * - 单资源: `refId` (如 "current_topic")
 * - 列表项: `refId[index]` (如 "messages[0]")
 *
 * @returns IndexMap 格式的 Ref 数据
 */
export function exportToIndexMap(): IndexMap {
  const result: IndexMap = {};

  for (const [fullKey, data] of globalRegistry) {
    // fullKey = "view_0:messages[0]"
    // 我们需要提取出 refId 部分作为 IndexMap 的 key
    const colonIdx = fullKey.indexOf(":");
    if (colonIdx !== -1) {
      const refId = fullKey.slice(colonIdx + 1);
      result[refId] = data as DataPayload;
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[GlobalRefRegistry] Exporting ${Object.keys(result).length} refs to IndexMap`,
    );
  }
  return result;
}

/**
 * 清空全局 Registry
 *
 * 用于 Worker 重置或测试
 */
export function clearRegistry(): void {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[GlobalRefRegistry] Clearing ${globalRegistry.size} refs`);
  }
  globalRegistry.clear();
}

/**
 * 获取 Registry 大小 (用于调试)
 */
export function getRegistrySize(): number {
  return globalRegistry.size;
}

// [RFC-002] Deprecated: Removed global registration in favor of explicit injection
// (globalThis as any).__AOTUI_REF_REGISTRY__ = ...
