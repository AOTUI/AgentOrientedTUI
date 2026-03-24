/** @jsxImportSource preact */
import type { ComponentChild } from "preact";
import renderToString from "preact-render-to-string";
import { createRefCollector } from "../../core/ref/ref-index";
import { createSnapshotBundle } from "../../core/snapshot/createSnapshotBundle";
import type { ToolDefinition } from "../../core/types";
import { RefProvider } from "../../ref/RefContext";

export function renderTUI(
  node: ComponentChild,
  options: { visibleTools: ToolDefinition[] },
) {
  const collector = createRefCollector();
  const tui = renderToString(
    <RefProvider registry={collector}>{node}</RefProvider>,
  );

  return createSnapshotBundle({
    tui,
    refIndex: collector.snapshot(),
    visibleTools: options.visibleTools,
  });
}
