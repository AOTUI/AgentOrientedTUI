/**
 * Transformer Visitors Registry
 * 
 * Exports the default set of visitors used by the Transformer.
 * Visitors are executed in order of their priority.
 */

import type { IElementVisitor } from './interface.js';
import { applicationVisitor } from './application.visitor.js';
import { viewVisitor } from './view.visitor.js';
import { viewLinkVisitor } from './view-link.visitor.js';

import { operationVisitor } from './operation.visitor.js';
import { htmlVisitor } from './html.visitor.js';

// Default visitors sorted by priority
// Default visitors sorted by priority
export const DEFAULT_VISITORS: IElementVisitor[] = sortVisitors([
    applicationVisitor,
    viewVisitor,
    viewLinkVisitor,
    operationVisitor,
    htmlVisitor
]);

/**
 * Sorts visitors by priority type
 */
export function sortVisitors(visitors: IElementVisitor[]): IElementVisitor[] {
    return [...visitors].sort((a, b) => a.priority - b.priority);
}
