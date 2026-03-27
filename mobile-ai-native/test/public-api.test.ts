import { expect, expectTypeOf, it } from "vitest";
import type { ComponentChild } from "preact";
import type {
  EffectContext,
  EffectHandler,
  EffectMap,
  EffectResult,
  MountedViewDescriptor,
  RefIndexEntry,
  ToolDefinition,
  ViewFragment,
} from "../src/index";
import {
  createSnapshotAssembler,
  defineViewTypeTool,
  View,
} from "../src/index";
import * as publicApi from "../src/index";

type TestState = {
  count: number;
};

type TestEvent = {
  type: "Incremented";
};

it("re-exports effect contract types from the public root entry", () => {
  const effect: EffectHandler<TestState, TestEvent, { amount: number }> = (
    ctx,
    input,
  ) => {
    ctx.trace.update(`count+${input.amount}`);
    ctx.emit({ type: "Incremented" });
    return undefined;
  };

  const effects: EffectMap<TestState, TestEvent> = {
    increment: effect,
  };

  const ctx: EffectContext<TestState, TestEvent> = {
    getState() {
      return { count: 1 };
    },
    emit() {},
    trace: {
      update() {},
    },
  };

  const result: EffectResult = undefined;

  expect(effects.increment).toBeTypeOf("function");
  expect(ctx.getState().count).toBe(1);
  expect(result).toBeUndefined();
});

it("exports the view-centric runtime surface from the public root entry", () => {
  expect(publicApi).toHaveProperty("View");
  expect(publicApi).toHaveProperty("defineViewTypeTool");
  expect(publicApi).toHaveProperty("createSnapshotAssembler");
  expect(View).toBeTypeOf("function");
  expect(defineViewTypeTool).toBeTypeOf("function");
  expect(createSnapshotAssembler).toBeTypeOf("function");
});

it("exposes the view-centric mounted view and snapshot assembler contracts", () => {
  expectTypeOf<MountedViewDescriptor<{ count: number }>>().toEqualTypeOf<{
    render: (state: { count: number }) => ComponentChild;
  }>();

  expectTypeOf(createSnapshotAssembler).parameter(0).toEqualTypeOf<{
    rootView: ViewFragment;
    mountedViews: readonly ViewFragment[];
    refIndex: Readonly<Record<string, RefIndexEntry>>;
    visibleTools: readonly ToolDefinition[];
    tui?: string;
  }>();
});

it("assembles a view-centric snapshot bundle from rootView and mountedViews", () => {
  const bundle = createSnapshotAssembler({
    rootView: {
      id: "root",
      type: "RootView",
      name: "Navigation",
      markup: '<View id="root" type="RootView" name="Navigation">',
    },
    mountedViews: [
      {
        id: "inbox",
        type: "InboxView",
        name: "Inbox",
        markup: '<View id="inbox" type="InboxView" name="Inbox">',
      },
    ],
    refIndex: {
      "messages[0]": {
        type: "message",
        value: { id: "m1" },
      },
    },
    visibleTools: [],
  });

  expect(bundle.markup).toBe(
    '<View id="root" type="RootView" name="Navigation"><View id="inbox" type="InboxView" name="Inbox">',
  );
  expect(bundle.views).toEqual([
    {
      id: "root",
      type: "RootView",
      name: "Navigation",
      markup: '<View id="root" type="RootView" name="Navigation">',
    },
    {
      id: "inbox",
      type: "InboxView",
      name: "Inbox",
      markup: '<View id="inbox" type="InboxView" name="Inbox">',
    },
  ]);
  expect(bundle.refIndex["messages[0]"]).toEqual({
    type: "message",
    value: { id: "m1" },
  });
  expect(bundle.visibleTools).toEqual([]);
});
