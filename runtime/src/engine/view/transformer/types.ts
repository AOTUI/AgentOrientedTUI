/**
 * Transformer Types
 * 
 * 共享类型定义，供纯函数和兼容层使用
 */

import type { IndexMap } from '../../../spi/index.js';

/**
 * Transform 结果
 */
export interface TransformResult {
    markup: string;
    indexMap: IndexMap;
}

/**
 * Transform 上下文 (纯函数内部状态)
 * 
 * 这些数据在单次 transform 调用中积累，
 * 但不跨调用共享，保证线程安全。
 */
export interface TransformContext {
    /** 累积的 IndexMap */
    indexMap: IndexMap;
    /** 当前 App ID 上下文 */
    currentAppId: string | null;
    /** 当前 View ID 上下文 */
    currentViewId: string | null;
}



/**
 * 创建新的 TransformContext
 */
export function createTransformContext(appId?: string): TransformContext {
    return {
        indexMap: {},
        currentAppId: appId || null,
        currentViewId: null
    };
}
