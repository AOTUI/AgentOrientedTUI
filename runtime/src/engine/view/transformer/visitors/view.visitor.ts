/**
 * View Visitor
 * 
 * Handles <view> definition elements (view="..." or data-is-view).
 * Responsible for maintaining currentViewId context.
 */

import type { IElementVisitor, ChildrenTraverser } from './interface.js';
import type { TransformContext } from '../types.js';

export const viewVisitor: IElementVisitor = {
    name: 'view',
    priority: 20,

    matches(el: Element, ctx: Readonly<TransformContext>): boolean {
        const viewAttr = el.getAttribute('view');
        // View definition if:
        // 1. has 'view' attribute AND NO 'href' (href implies it's a link)
        // 2. OR has explicit 'data-is-view' marker
        // 3. AND has 'name' attribute or 'view' attribute value is used as name
        const isViewDefinition = (!!viewAttr && !el.hasAttribute('href')) || el.hasAttribute('data-is-view');
        const viewName = viewAttr || el.getAttribute('name');

        return isViewDefinition && !!viewName;
    },

    transform(
        el: Element,
        ctx: TransformContext,
        children: ChildrenTraverser
    ): string {
        const viewAttr = el.getAttribute('view');
        const viewName = viewAttr || el.getAttribute('name');
        const viewId = el.id || null;

        // [Contract Enforced] SDK must provide ID
        if (!viewId) {
            console.error(
                `[Transformer] View "${viewName}" is missing required 'id' attribute. ` +
                `This View will be skipped. Please ensure SDK View outputs id.`
            );
            // Traverse children but don't wrap in <view>
            const childMarkup = children(el, ctx);
            return childMarkup.join('\n');
        }

        // Manage Context
        const prevViewId = ctx.currentViewId;
        ctx.currentViewId = viewId;

        // Recursively process children
        const childMarkup = children(el, ctx);
        const childrenContent = childMarkup.join('\n');

        // Restore Context
        ctx.currentViewId = prevViewId;

        return `\n<view id="${viewId}" name="${viewName}">\n${childrenContent}\n</view>\n`;
    }
};
