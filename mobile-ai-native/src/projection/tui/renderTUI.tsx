/** @jsxImportSource preact */
import type { ComponentChild } from "preact";
import renderToString from "preact-render-to-string";
import { createRefCollector } from "../../core/ref/ref-index";
import type { ToolDefinition } from "../../core/types";
import { RefProvider } from "../../ref/RefContext";
import { renderViewFragment } from "./renderViewFragment";
import { createSnapshotAssembler } from "./createSnapshotAssembler";

export function renderTUI(
  node: ComponentChild,
  options: { visibleTools: ToolDefinition[] },
) {
  const collector = createRefCollector();
  const renderedNode = <RefProvider registry={collector}>{node}</RefProvider>;
  const markup = renderToString(renderedNode);
  const rootView = renderViewFragment({
    id: "root",
    type: "Root",
    name: "Root",
    markup,
  });
  return createSnapshotAssembler({
    rootView,
    mountedViews: [],
    refIndex: collector.snapshot(),
    visibleTools: options.visibleTools,
  });
}
