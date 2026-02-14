/**
 * Operation Visitor
 * 
 * Handles <operation> or data-operation elements.
 * Parses parameter definitions, types, and constraints.
 * Populates IndexMap with detailed operation signatures.
 */

import type { IElementVisitor, ChildrenTraverser } from './interface.js';
import type { TransformContext } from '../types.js';

export const operationVisitor: IElementVisitor = {
    name: 'operation',
    priority: 50,

    matches(el: Element, ctx: Readonly<TransformContext>): boolean {
        // [Reference] if (operationId)
        const operationId = el.getAttribute('data-operation') || el.getAttribute('operation');
        return !!operationId;
    },

    transform(
        el: Element,
        ctx: TransformContext,
        children: ChildrenTraverser
    ): string {
        const operationId = (el.getAttribute('data-operation') || el.getAttribute('operation'))!;
        const operationDesc = el.getAttribute('data-operation-desc') || el.getAttribute('desc');

        // Extract display text (excluding <param> tags)
        const displayText = Array.from(el.childNodes)
            .filter((child: any) => {
                if (child.nodeType === 3) return true; // Text node
                if (child.nodeType === 1 && (child as Element).tagName.toLowerCase() === 'param') return false;
                return true;
            })
            .map((child: any) => {
                if (child.nodeType === 3) return (child as Text).data.trim();
                return '';
            })
            .filter(Boolean)
            .join(' ')
            .trim() || operationId;

        let opOutput = `- [${displayText}](tool:${operationId})\n`;

        if (operationDesc) {
            opOutput += `    - Desc: ${operationDesc}\n`;
        }

        // Parse Parameters
        const params = Array.from(el.querySelectorAll('param'));
        const paramDefs: Array<{
            name: string;
            type: string;
            required: boolean;
            description?: string;
            itemType?: string;
            options?: string[];
            constraints?: Record<string, unknown>;
            default?: string;
        }> = [];

        if (params.length > 0) {
            opOutput += `    - Parameters:\n`;
            params.forEach((p: any) => {
                const name = p.getAttribute('name') || 'param';
                const type = p.getAttribute('type') || 'string';
                const required = p.getAttribute('required') === 'true';
                const desc = p.getAttribute('desc') || undefined;

                // Extended attributes
                const itemType = p.getAttribute('item-type') || undefined;
                const optionsStr = p.getAttribute('options') || undefined;
                const defaultVal = p.getAttribute('default') || undefined;

                // Constraints
                const minLength = p.getAttribute('min-length');
                const maxLength = p.getAttribute('max-length');
                const pattern = p.getAttribute('pattern');
                const min = p.getAttribute('min');
                const max = p.getAttribute('max');

                // Build type description string
                let typeDesc = type;
                if (type === 'array' && itemType) {
                    typeDesc = `array<${itemType}>`;
                } else if (type === 'enum' && optionsStr) {
                    typeDesc = `enum(${optionsStr.split(',').join(' | ')})`;
                }

                // Output Format
                opOutput += `        - ${name}: ${typeDesc}${required ? ' (required)' : ''}`;
                if (desc) {
                    opOutput += ` - ${desc}`;
                }
                opOutput += '\n';

                // Output Constraints
                const constraints: Record<string, unknown> = {};
                if (minLength) {
                    constraints.minLength = parseInt(minLength);
                    opOutput += `            - min length: ${minLength}\n`;
                }
                if (maxLength) {
                    constraints.maxLength = parseInt(maxLength);
                    opOutput += `            - max length: ${maxLength}\n`;
                }
                if (pattern) {
                    constraints.pattern = pattern;
                    opOutput += `            - pattern: /${pattern}/\n`;
                }
                if (min) {
                    constraints.min = parseFloat(min);
                    opOutput += `            - min value: ${min}\n`;
                }
                if (max) {
                    constraints.max = parseFloat(max);
                    opOutput += `            - max value: ${max}\n`;
                }
                if (defaultVal !== undefined) {
                    opOutput += `            - default: ${defaultVal}\n`;
                }

                paramDefs.push({
                    name,
                    type,
                    required,
                    description: desc,
                    itemType,
                    options: optionsStr ? optionsStr.split(',') : undefined,
                    constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
                    default: defaultVal
                });
            });
        }

        // Register in IndexMap (if context valid)
        if (ctx.currentAppId && ctx.currentViewId) {
            const operationPath = `tool:${ctx.currentAppId}.${ctx.currentViewId}.${operationId}`;
            ctx.indexMap[operationPath] = {
                description: operationDesc || undefined,
                params: paramDefs
            };
        }

        return opOutput;
    }
};
