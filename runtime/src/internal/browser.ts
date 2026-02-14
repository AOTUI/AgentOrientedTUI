/**
 * AOTUI Runtime - Browser Entry Point
 * 
 * This module exports only the browser-compatible parts of the runtime,
 * specifically the Transformer which works with native browser DOM.
 * 
 * Usage in browser:
 * ```html
 * <script type="module">
 * import { Transformer } from './aotui-runtime.browser.js';
 * 
 * const transformer = new Transformer();
 * const container = document.createElement('div');
 * container.innerHTML = htmlContent;
 * const { markup, indexMap } = transformer.transform({ body: container });
 * </script>
 * ```
 */

export { Transformer } from '../engine/view/index.js';
export type { IndexMap, DataPayload } from '../spi/index.js';


