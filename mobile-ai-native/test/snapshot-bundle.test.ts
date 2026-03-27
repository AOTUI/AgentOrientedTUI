import { describe, expect, expectTypeOf, it } from "vitest";
import { createSnapshotBundle } from "../src/core/snapshot/createSnapshotBundle";
import { createSnapshotAssembler } from "../src/projection/tui/createSnapshotAssembler";
import { renderViewFragment } from "../src/projection/tui/renderViewFragment";
import type {
  RefIndexEntry,
  SnapshotBundle,
  ToolDefinition,
  ViewFragment,
} from "../src/core/types";

describe("createSnapshotBundle", () => {
  it("exposes a view-centric snapshot bundle contract", () => {
    expectTypeOf<SnapshotBundle>().toEqualTypeOf<{
      readonly snapshotId: string;
      readonly generatedAt: number;
      readonly markup: string;
      readonly views: readonly ViewFragment[];
      readonly tui: string;
      readonly refIndex: Readonly<Record<string, RefIndexEntry>>;
      readonly visibleTools: readonly ToolDefinition[];
    }>();
  });

  it("creates an atomic snapshot bundle with generated metadata", () => {
    const nested = {
      tags: ["inbox"],
    };
    const footgunSource = Object.create(null) as Record<string, unknown>;
    footgunSource.__proto__ = { polluted: true };
    footgunSource.label = "safe";
    const viewMarkup = '<View id="root" type="RootView" name="Navigation"><screen>hello</screen></View>';
    const bundle = createSnapshotBundle({
      markup: viewMarkup,
      views: [
        {
          id: "root",
          type: "RootView",
          name: "Navigation",
          markup: viewMarkup,
        },
      ],
      refIndex: {
        "messages[0]": {
          type: "message",
          value: nested,
        },
        "messages[1]": {
          type: "message",
          value: footgunSource,
        },
      },
      visibleTools: [
        {
          name: "openMessage",
          description: "Open a message",
          inputSchema: {} as never,
          viewType: "Workspace",
          meta: {
            supportsRefs: true,
            tags: ["message"],
          },
        },
      ],
    });

    expect(bundle.snapshotId).toMatch(/^snap_/);
    expect(bundle.generatedAt).toBeTypeOf("number");
    expect(bundle.markup).toBe(viewMarkup);
    expect(bundle.views).toEqual([
      {
        id: "root",
        type: "RootView",
        name: "Navigation",
        markup: viewMarkup,
      },
    ]);
    expect(bundle.refIndex["messages[0]"]).toEqual({
      type: "message",
      value: {
        tags: ["inbox"],
      },
    });
    expect(Object.getPrototypeOf(bundle.refIndex["messages[0]"].value)).toBe(
      null,
    );
    expect(Object.keys(bundle.refIndex["messages[1]"].value)).toContain(
      "__proto__",
    );
    expect(
      (bundle.refIndex["messages[1]"].value as Record<string, unknown>).__proto__,
    ).toEqual({
      polluted: true,
    });
    expect(
      (bundle.refIndex["messages[1]"].value as Record<string, unknown>).label,
    ).toBe("safe");
    expect(Object.getPrototypeOf(bundle.refIndex["messages[1]"].value)).toBe(
      null,
    );
    expect(Object.getPrototypeOf(bundle.refIndex)).toBeNull();
    expect(() => {
      (bundle.views as Array<{ markup: string }>).push({
        id: "x",
        type: "Other",
        name: "Other",
        markup: "",
      });
    }).toThrow();
    expect(() => {
      (bundle.visibleTools[0].meta as { tags: string[] }).tags.push("mutated");
    }).toThrow();
    expect(bundle.visibleTools[0]).toMatchObject({
      name: "openMessage",
      viewType: "Workspace",
    });
    nested.tags.push("mutated");
    expect(bundle.refIndex["messages[0]"].value).toEqual({
      tags: ["inbox"],
    });
  });

  it("rejects non-plain snapshot values instead of preserving mutable references", () => {
    class ExampleValue {
      constructor(public readonly name: string) {}
    }

    const unsupportedValues = [
      new Date("2026-03-25T00:00:00.000Z"),
      new Map([["key", "value"]]),
      new Set(["value"]),
      new ExampleValue("demo"),
    ];

    for (const value of unsupportedValues) {
      expect(() =>
        createSnapshotBundle({
          markup: "<screen>hello</screen>",
          views: [],
          refIndex: {
            "messages[0]": {
              type: "message",
              value,
            },
          },
          visibleTools: [],
        }),
      ).toThrow(/plain JSON-like data/);
    }
  });

  it("rejects unsupported primitive snapshot values", () => {
    const unsupportedValues = [
      undefined,
      () => undefined,
      Symbol("snapshot"),
      1n,
    ];

    for (const value of unsupportedValues) {
      expect(() =>
        createSnapshotBundle({
          markup: "<screen>hello</screen>",
          views: [],
          refIndex: {
            "messages[0]": {
              type: "message",
              value,
            },
          },
          visibleTools: [],
        }),
      ).toThrow(/plain JSON-like data/);
    }
  });

  it("rejects non-finite number snapshot values", () => {
    const unsupportedValues = [NaN, Infinity, -Infinity];

    for (const value of unsupportedValues) {
      expect(() =>
        createSnapshotBundle({
          markup: "<screen>hello</screen>",
          views: [],
          refIndex: {
            "messages[0]": {
              type: "message",
              value,
            },
          },
          visibleTools: [],
        }),
      ).toThrow(/plain JSON-like data/);
    }
  });

  it("assembles markup, views, refIndex, and visibleTools from the same render tick", () => {
    const rootView = renderViewFragment({
      id: "root",
      type: "Root",
      name: "Navigation",
      children: "Root content",
    });
    const mountedView = renderViewFragment({
      id: "workspace",
      type: "Workspace",
      name: "Workspace",
      children: "Workspace content",
    });
    const refIndex = {
      "messages[0]": {
        type: "message",
        value: { id: "m1" },
      },
    } satisfies Readonly<Record<string, RefIndexEntry>>;
    const visibleTools = [
      {
        name: "openMessage",
        description: "Open a message",
        inputSchema: {} as never,
        meta: {},
      },
    ] satisfies readonly ToolDefinition[];

    const bundle = createSnapshotAssembler({
      rootView,
      mountedViews: [mountedView],
      refIndex,
      visibleTools,
    });

    expect(bundle.views).toEqual([rootView, mountedView]);
    expect(bundle.markup).toContain(
      '<View id="root" type="Root" name="Navigation">',
    );
    expect(bundle.markup.indexOf(rootView.markup)).toBeLessThan(
      bundle.markup.indexOf(mountedView.markup),
    );
    expect(bundle.refIndex).toEqual(refIndex);
    expect(bundle.visibleTools).toEqual(visibleTools);
  });

  it("derives markup from view fragments when markup is omitted", () => {
    const rootView = renderViewFragment({
      id: "root",
      type: "Root",
      name: "Navigation",
      children: "Root content",
    });
    const mountedView = renderViewFragment({
      id: "workspace",
      type: "Workspace",
      name: "Workspace",
      children: "Workspace content",
    });

    const bundle = createSnapshotBundle({
      views: [rootView, mountedView],
      refIndex: {},
      visibleTools: [],
    });

    expect(bundle.markup).toBe(`${rootView.markup}${mountedView.markup}`);
    expect(bundle.tui).toBe(bundle.markup);
  });

  it("rejects mismatched markup when view fragments are provided", () => {
    const rootView = renderViewFragment({
      id: "root",
      type: "Root",
      name: "Navigation",
      children: "Root content",
    });

    expect(() =>
      createSnapshotBundle({
        markup: "<View>different</View>",
        views: [rootView],
        refIndex: {},
        visibleTools: [],
      }),
    ).toThrow(/same render tick/);
  });

  it("allows a distinct tui readout when view fragments are provided", () => {
    const rootView = renderViewFragment({
      id: "root",
      type: "Root",
      name: "Navigation",
      children: "Root content",
    });

    const bundle = createSnapshotBundle({
      tui: "<screen>Agent-facing projection</screen>",
      views: [rootView],
      refIndex: {},
      visibleTools: [],
    });

    expect(bundle.markup).toBe(rootView.markup);
    expect(bundle.tui).toBe("<screen>Agent-facing projection</screen>");
  });
});
