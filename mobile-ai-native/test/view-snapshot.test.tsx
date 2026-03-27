/** @jsxImportSource preact */
import { describe, expect, it } from "vitest";
import { renderSnapshotDocument } from "../src/projection/tui/renderSnapshotDocument";
import { renderViewFragment } from "../src/projection/tui/renderViewFragment";
import { renderTUI } from "../src/projection/tui/renderTUI";

let demoRenderCount = 0;

function DemoView() {
  demoRenderCount += 1;
  return <span>semantic child</span>;
}

describe("view snapshot rendering", () => {
  it("renders root view first and preserves ordered business views", () => {
    const rootView = renderViewFragment({
      id: "root",
      type: "Root",
      name: "Navigation",
      children: "Navigation",
    });
    const workspaceView = renderViewFragment({
      id: "workspace",
      type: "Workspace",
      name: "Workspace",
      children: "Workspace",
    });
    const fileDetailView = renderViewFragment({
      id: "file-detail",
      type: "FileDetail",
      name: "File detail",
      children: "Detail",
    });

    const markup = renderSnapshotDocument([
      rootView,
      workspaceView,
      fileDetailView,
    ]);

    expect(markup).toContain(
      '<View id="root" type="Root" name="Navigation">',
    );
    expect(markup).not.toContain("<Snapshot>");
    expect(markup.indexOf(rootView.markup)).toBeLessThan(
      markup.indexOf(workspaceView.markup),
    );
    expect(markup.indexOf(workspaceView.markup)).toBeLessThan(
      markup.indexOf(fileDetailView.markup),
    );
  });

  it("keeps the compatibility root semantic instead of escaping rendered HTML", () => {
    demoRenderCount = 0;
    const bundle = renderTUI(<DemoView />, { visibleTools: [] });

    expect(bundle.markup).toContain(
      '<View id="root" type="Root" name="Root"><span>semantic child</span>',
    );
    expect(bundle.markup).not.toContain("&lt;span&gt;");
    expect(bundle.markup).not.toContain("<Snapshot>");
    expect(bundle.tui).toContain("<span>semantic child</span>");
    expect(demoRenderCount).toBe(1);
  });
});
