/**
 * SPI Layer - Foundation Types
 * 
 * 最基础的类型定义，零依赖。
 * 这些类型是整个 Runtime 的"语言"。
 */

// ============================================================================
// Branded Type Symbol
// ============================================================================

/**
 * 用于创建 Branded Types 的 unique symbol。
 * 
 * Branded Types 在编译期区分不同的 ID 类型，防止混用。
 * 例如：`getDesktop(appId)` 会在编译时报错。
 * 
 * @internal
 */
declare const __brand: unique symbol;

// ============================================================================
// 标识符类型 (Branded Types)
// ============================================================================

/** 快照唯一标识 (Branded Type) */
export type SnapshotID = string & { readonly [__brand]: 'SnapshotID' };

/** 桌面唯一标识 (Branded Type) */
export type DesktopID = string & { readonly [__brand]: 'DesktopID' };

/** 应用唯一标识 (Branded Type) */
export type AppID = string & { readonly [__brand]: 'AppID' };

/** 视图唯一标识 (Branded Type) */
export type ViewID = string & { readonly [__brand]: 'ViewID' };

/** 操作唯一标识 (Branded Type) */
export type OperationID = string & { readonly [__brand]: 'OperationID' };


// ============================================================================
// 数据结构
// ============================================================================

/** 通用数据载荷 */
export type DataPayload = Record<string, unknown>;

/** 快照数据索引映射 */
export interface IndexMap {
    [path: string]: DataPayload;
}

// ============================================================================
// 状态类型
// ============================================================================

/** Desktop 状态 */
export type DesktopStatus = 'active' | 'suspended' | 'serialized';

/** App 状态 */
export interface AppState {
    appId: AppID;
    name?: string;
    html: string;
    /** [RFC-014] 增加 'pending' 状态用于懒加载 */
    status: 'pending' | 'running' | 'paused' | 'closed' | 'collapsed';
    installedAt: number;
}

/** Desktop 序列化状态 */
export interface DesktopState {
    id: DesktopID;
    status: DesktopStatus;
    createdAt: number;
    serializedAt?: number;
    apps: AppState[];
}

/** App 配置 */
export interface AppConfig {
    /** 应用名称 (语义名称, 必填) */
    name: string;
    /** 应用 HTML 内容 */
    html: string;
}
