/**
 * Element Visitor Interface
 * 
 * Each Visitor is responsible for identifying and processing a specific type of DOM element.
 * Visitors should be stateless pure functions.
 */

import type { TransformContext } from '../types.js';

export interface IElementVisitor {
    /** 
     * Visitor name (for debugging and logging)
     */
    readonly name: string;

    /**
     * Processing priority
     * 
     * Lower numbers execute earlier. A rule of thumb:
     * - 0-30: Structural (Application, View, ViewLink)
     * - 30-60: Semantic (Operation)
     * - 60-99: Reserved for extensions
     * - 100+: General HTML fallback
     */
    readonly priority: number;

    /**
     * Determines if this visitor should handle the element
     */
    matches(el: Element, ctx: Readonly<TransformContext>): boolean;

    /**
     * Executes the transformation
     * 
     * @param el - The current element
     * @param ctx - Transformation context (can modify indexMap)
     * @param children - Function to traverse child nodes
     * @param traverseElement - Function to traverse a single element with full Visitor Chain
     * @returns TUI Markup string
     */
    transform(
        el: Element,
        ctx: TransformContext,
        children: ChildrenTraverser,
        traverseElement?: ElementTraverser
    ): string;
}

/**
 * Child node traverser type
 * 
 * Used by Visitors to recursively process child nodes of an element.
 * This does NOT apply Visitor matching to the element itself.
 */
export type ChildrenTraverser = (
    el: Element,
    ctx: TransformContext
) => string[];

/**
 * Element traverser type
 * 
 * Used by Visitors to recursively process a single element with full Visitor Chain.
 * This DOES apply Visitor matching, allowing Operation/ViewLink/etc to be recognized.
 * 
 * [RFC-FIX] Added to support semantic elements inside List items.
 */
export type ElementTraverser = (
    el: Element,
    ctx: TransformContext
) => string;
