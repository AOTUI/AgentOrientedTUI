import { parseHTML } from 'linkedom';

export function createMockElement(html: string): Element {
    const { document } = parseHTML(`<!DOCTYPE html><html><body>${html}</body></html>`);
    const el = document.body.firstElementChild;
    if (!el) {
        // Fallback if linkedom behaving weirdly, check root
        const rootEl = document.querySelector('div, application, view');
        if (rootEl) return rootEl as Element;
        throw new Error(`Failed to create mock element from: ${html}`);
    }
    return el as Element;
}
