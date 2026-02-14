/**
 * Transformer Helpers (Pure Functions)
 * 
 * Shared utility functions for DOM traversal and payload sanitization.
 * Extracted from pure.ts to support Visitor Pattern refactoring.
 */





// ============================================================================
// Type Guards for DOM Nodes
// ============================================================================

/** DOM Node union type for type-safe traversal */
export type DOMNode = Node | Element | Text | Comment | DocumentFragment;

/** Type guard: Check if node is an Element */
export function isElement(node: DOMNode): node is Element {
    return node.nodeType === 1;
}

/** Type guard: Check if node is a Text node */
/**
 * Type guard: Check if node is a Text node
 */
export function isText(node: DOMNode): node is Text {
    return node.nodeType === 3;
}

// ============================================================================
// Helper Functions (Pure)
// ============================================================================

/**
 * Decode HTML entities for JSON parsing
 */
export function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}
