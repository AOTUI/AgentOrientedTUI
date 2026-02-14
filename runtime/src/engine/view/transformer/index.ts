/**
 * Transformer (Compatibility Layer)
 * 
 * 保持向后兼容的类形式 API。
 * 内部委托给纯函数实现，无状态共享。
 * 
 * @example
 * ```typescript
 * const transformer = new Transformer();
 * const { markup, indexMap } = transformer.transform(dom);
 * ```
 * 
 * @see pure.ts 纯函数实现
 */

import type { IndexMap } from '../../../spi/index.js';
import type { ITransformer } from '../../../spi/runtime/transformer.interface.js';
import { transformDOM, transformElement as transformElementPure } from './pure.js';

// Re-export types
export type { TransformResult, TransformContext } from './types.js';

/**
 * Transformer Class (Compatibility Wrapper)
 * 
 * 这个类现在是无状态的，所有调用都委托给纯函数。
 * 可以安全地在多个 Desktop 之间共享同一实例。
 */
export class Transformer implements ITransformer {
    /**
     * Transforms full DOM (Window or Document) to TUI Markup
     */
    transform(dom: unknown): { markup: string; indexMap: IndexMap } {
        return transformDOM(dom);
    }

    /**
     * Transform a single Element (e.g., app container) to TUI Markup
     */
    transformElement(element: Element, appId?: string): { markup: string; indexMap: IndexMap } {
        return transformElementPure(element, appId);
    }
}

// Re-export pure functions for direct use
export { transformDOM, transformElement } from './pure.js';
