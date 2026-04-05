import { describe, it, expect } from 'vitest';
import { parseHTML } from 'linkedom';

import { createViewFragmentExtractor } from './view-fragment-extractor.js';

function createContainer(markup: string): Element {
    const { document } = parseHTML('<html><body></body></html>');
    document.body.innerHTML = markup;
    return document.body;
}

describe('createViewFragmentExtractor', () => {
    it('classifies fragments with data-role="application-instruction" as application-instruction', () => {
        const extractor = createViewFragmentExtractor();
        const container = createContainer('<div data-view-id="view_0" data-view-type="Workspace"><div data-role="application-instruction">Open the workspace</div></div>');

        const fragments = extractor(container, 'app_0' as never, 1705305600000);

        expect(fragments).toHaveLength(1);
        expect(fragments[0]).toMatchObject({
            viewId: 'view_0',
            viewType: 'Workspace',
            markup: 'Open the workspace',
            timestamp: 1705305600000,
            kind: 'application-instruction',
        });
    });

    it('classifies unmarked fragments as view-state', () => {
        const extractor = createViewFragmentExtractor();
        const container = createContainer('<div data-view-id="view_1" data-view-type="Detail"><span>Business content</span></div>');

        const fragments = extractor(container, 'app_0' as never, 1705305601000);

        expect(fragments).toHaveLength(1);
        expect(fragments[0]).toMatchObject({
            viewId: 'view_1',
            viewType: 'Detail',
            markup: 'Business content',
            timestamp: 1705305601000,
            kind: 'view-state',
        });
    });

    it('preserves timestamp when the view digest does not change', () => {
        const extractor = createViewFragmentExtractor();
        const container = createContainer('<div data-view-id="view_2" data-view-type="Detail"><span>Stable content</span></div>');

        const firstPass = extractor(container, 'app_0' as never, 1705305602000);
        const secondPass = extractor(container, 'app_0' as never, 1705305609000);

        expect(firstPass[0]?.timestamp).toBe(1705305602000);
        expect(secondPass[0]?.timestamp).toBe(1705305602000);
    });

    it('resets cached timestamps when clear is called', () => {
        const extractor = createViewFragmentExtractor();
        const container = createContainer('<div data-view-id="view_3" data-view-type="Detail"><span>Resettable content</span></div>');

        const firstPass = extractor(container, 'app_0' as never, 1705305603000);
        extractor.clear();
        const secondPass = extractor(container, 'app_0' as never, 1705305609000);

        expect(firstPass[0]?.timestamp).toBe(1705305603000);
        expect(secondPass[0]?.timestamp).toBe(1705305609000);
    });

    it('advances timestamp when semantic kind changes without changing rendered markup', () => {
        const extractor = createViewFragmentExtractor();
        const marked = createContainer('<div data-view-id="view_4" data-view-type="Detail"><div data-role="application-instruction"><span>Same content</span></div></div>');
        const unmarked = createContainer('<div data-view-id="view_4" data-view-type="Detail"><span>Same content</span></div>');

        const firstPass = extractor(marked, 'app_0' as never, 1705305604000);
        const secondPass = extractor(unmarked, 'app_0' as never, 1705305609000);

        expect(firstPass[0]?.kind).toBe('application-instruction');
        expect(secondPass[0]?.kind).toBe('view-state');
        expect(firstPass[0]?.markup).toBe(secondPass[0]?.markup);
        expect(secondPass[0]?.timestamp).toBe(1705305609000);
    });
});
