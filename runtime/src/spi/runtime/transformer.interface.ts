/**
 * SPI - ITransformer Interface
 *
 * Defines the contract for DOM-to-TUI transformation.
 * The Kernel depends on this interface, not on concrete implementations.
 *
 * @module @aotui/runtime/spi/runtime
 */

import type { IndexMap } from '../core/index.js';

/**
 * Result of a transformation operation
 */
export interface TransformResult {
    /** Generated TUI Markup (Markdown-like format) */
    markup: string;
    /** Map of data paths to payloads for Agent resolution */
    indexMap: IndexMap;
}

/**
 * Transformer Interface
 *
 * Transforms DOM structures into TUI-compatible markup.
 * Implementations must be stateless and thread-safe.
 *
 * @example
 * ```typescript
 * const transformer: ITransformer = new Transformer();
 * const { markup, indexMap } = transformer.transform(document);
 * ```
 */
export interface ITransformer {
    /**
     * Transforms a full DOM (Window or Document) to TUI Markup
     *
     * @param dom - The DOM object (Window, Document, or DesktopDOM structure)
     * @returns TransformResult with markup and indexMap
     */
    transform(dom: unknown): TransformResult;

    /**
     * Transforms a single Element to TUI Markup
     *
     * @param element - The DOM Element to transform
     * @param appId - Optional App ID for namespacing operations
     * @returns TransformResult with markup and indexMap
     */
    transformElement(element: Element, appId?: string): TransformResult;
}
