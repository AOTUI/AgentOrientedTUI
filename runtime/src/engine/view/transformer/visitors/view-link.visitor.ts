/**
 * View Link Visitor
 * 
 * [RFC-006] Updated to support new ViewLink format:
 * - data-link-id: LinkID for V2 mount API
 * - data-unique-id: Business key for cross-snapshot matching
 * - data-view-type: View type name
 * - data-bound-view: Already mounted ViewID (if any)
 * 
 * Output format:
 * - V2: [content](mount:parent_view:link_id) - for Agent to mount via link
 * - Already mounted: [content](view:viewId) - direct navigation
 */

import type { IElementVisitor, ChildrenTraverser } from './interface.js';
import type { TransformContext } from '../types.js';

export const viewLinkVisitor: IElementVisitor = {
    name: 'view-link',
    priority: 30,

    matches(el: Element, ctx: Readonly<TransformContext>): boolean {
        // [RFC-006] Match new data-link-id format (highest priority)
        if (el.hasAttribute('data-link-id')) {
            return true;
        }

        // Legacy: data-view-link attribute
        if (el.hasAttribute('data-view-link') && el.getAttribute('data-view-link') !== '') {
            return true;
        }

        // Legacy: view-target
        const viewTargetId = el.getAttribute('data-view-target-id');
        const viewTarget = el.getAttribute('view-target');

        return !!(viewTargetId || viewTarget);
    },

    transform(
        el: Element,
        ctx: TransformContext,
        children: ChildrenTraverser
    ): string {
        const childTexts = children(el, ctx);
        const content = childTexts.join(' ').trim() || 'View';

        // [RFC-006] Handle new ViewLink format with data-link-id
        const linkId = el.getAttribute('data-link-id');
        if (linkId) {
            const boundViewId = el.getAttribute('data-bound-view');
            const viewType = el.getAttribute('data-view-type') || 'View';
            const description = el.getAttribute('data-view-description');

            // If already mounted, output link with ViewID in title
            // Format: [Content](link:LinkID "Mounted: ViewID")
            // This preserves the LinkID for context while showing the ViewID
            if (boundViewId && boundViewId !== '') {
                let output = `[${content}](link:${linkId} "Mounted: ${boundViewId}")`;
                if (description) {
                    output += ` - ${description}`;
                }
                return output + '\n';
            }

            // Not mounted: output mount link with V2 format
            // Agent will call: mount(link_id=linkId)
            let output = `[${content}](link:${linkId})`;
            if (description) {
                output += ` - ${description}`;
            }
            return output + '\n';
        }

        // Legacy: data-view-link format
        const dataViewLink = el.getAttribute('data-view-link');
        if (dataViewLink && dataViewLink !== '') {
            const linkDesc = el.getAttribute('data-view-description');

            let linkOutput = `[${content}](view:${dataViewLink})`;
            if (linkDesc) {
                linkOutput += ` - ${linkDesc}`;
            }
            return linkOutput + '\n';
        }

        // Legacy: view-target format
        const viewTargetId = el.getAttribute('data-view-target-id');
        const viewTarget = el.getAttribute('view-target');
        const viewLinkName = el.getAttribute('view');
        const viewParams = el.getAttribute('view-params');

        const targetId = viewTargetId || viewTarget;
        const legacyContent = content || viewLinkName || viewTarget || 'View';
        const desc = el.getAttribute('desc');

        let targetUrl = `view:${targetId}`;
        if (viewParams) {
            try {
                const paramsObj = JSON.parse(viewParams);
                const queryParts = Object.entries(paramsObj)
                    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
                    .join('&');
                if (queryParts) {
                    targetUrl += `?${queryParts}`;
                }
            } catch {
                // Invalid JSON, ignore params
            }
        }

        let linkOutput = `- [${legacyContent}](${targetUrl})\n`;
        if (desc) {
            linkOutput += `    - Description: ${desc}\n`;
        }
        return linkOutput;
    }
};

