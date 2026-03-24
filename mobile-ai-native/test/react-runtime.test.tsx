/** @jsxImportSource preact */
// @vitest-environment happy-dom
import { render } from "preact";
import { createStore } from "../src/core/state/createStore";
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createActionRuntime } from "../src/core/action/createActionRuntime";
import { defineAction } from "../src/core/action/defineAction";
import { AppProvider } from "../src/projection/gui/AppProvider";
import { createReactAppRuntime } from "../src/projection/react/createReactAppRuntime";
import { AppRuntimeProvider } from "../src/projection/react/AppRuntimeProvider";
import { useAppRuntime, useRuntimeState } from "../src/projection/react/hooks";
import type { ToolDefinition } from "../src/core/types";

type TestState = {
  shell: {
    currentTab: "home" | "settings";
    recentTrace: string | null;
  };
  inbox: {
    query: string;
  };
};

type TestEvent =
  | {
      type: "TabChanged";
      tab: TestState["shell"]["currentTab"];
    }
  | {
      type: "TraceUpdated";
      summary: string;
    };

function createTestApp() {
  const changeTab = defineAction<TestState, TestEvent, { tab: TestState["shell"]["currentTab"] }>({
    name: "changeTab",
    description: "Change the current tab.",
    schema: z.object({
      tab: z.union([z.literal("home"), z.literal("settings")]),
    }),
    visibility() {
      return true;
    },
    handler(ctx, input) {
      ctx.emit({ type: "TabChanged", tab: input.tab });
      return { success: true };
    },
  });
  const updateTrace = defineAction<TestState, TestEvent, { summary: string }>({
    name: "updateTrace",
    description: "Update the recent trace summary.",
    schema: z.object({
      summary: z.string(),
    }),
    visibility() {
      return true;
    },
    handler(ctx, input) {
      ctx.emit({ type: "TraceUpdated", summary: input.summary });
      return { success: true };
    },
  });

  return {
    initialState: {
      shell: {
        currentTab: "home",
        recentTrace: null,
      },
      inbox: {
        query: "",
      },
    } satisfies TestState,
    reduce(state: TestState, event: TestEvent): TestState {
      if (event.type === "TabChanged") {
        return {
          ...state,
          shell: {
            ...state.shell,
            currentTab: event.tab,
          },
        };
      }

      if (event.type === "TraceUpdated") {
        return {
          ...state,
          shell: {
            ...state.shell,
            recentTrace: event.summary,
          },
        };
      }

      return state;
    },
    actions: [changeTab, updateTrace],
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("react runtime host adapter", () => {
  it("types visible tools on the public runtime actions surface", () => {
    const runtime = createReactAppRuntime(createTestApp());
    const visibleTools: ToolDefinition[] = runtime.actions.getVisibleTools();

    expect(visibleTools).toEqual([
      expect.objectContaining({
        name: "changeTab",
        description: "Change the current tab.",
        inputSchema: expect.any(Object),
        meta: {},
      }),
      expect.objectContaining({
        name: "updateTrace",
        description: "Update the recent trace summary.",
        inputSchema: expect.any(Object),
        meta: {},
      }),
    ]);
  });

  it("re-renders a consumer when store state changes", async () => {
    const runtime = createReactAppRuntime(createTestApp());
    const seen: string[] = [];

    function Probe() {
      const tab = useRuntimeState((state) => state.shell.currentTab);
      seen.push(tab);
      return <text>{tab}</text>;
    }

    const root = document.createElement("div");
    document.body.append(root);

    await act(async () => {
      render(
        <AppRuntimeProvider runtime={runtime}>
          <Probe />
        </AppRuntimeProvider>,
        root,
      );
    });

    await act(async () => {
      await runtime.actions.callAction("changeTab", { tab: "settings" });
    });

    expect(seen).toEqual(["home", "settings"]);
  });

  it("updates the selected slice when the selector changes", async () => {
    const runtime = createReactAppRuntime(createTestApp());
    const seen: string[] = [];
    const root = document.createElement("div");
    document.body.append(root);

    function Probe(props: { selector: (state: TestState) => string }) {
      const value = useRuntimeState(props.selector);
      seen.push(value);
      return <text>{value}</text>;
    }

    await act(async () => {
      render(
        <AppRuntimeProvider runtime={runtime}>
          <Probe selector={(state) => state.shell.currentTab} />
        </AppRuntimeProvider>,
        root,
      );
    });

    await act(async () => {
      render(
        <AppRuntimeProvider runtime={runtime}>
          <Probe selector={(state) => `tab:${state.shell.currentTab}`} />
        </AppRuntimeProvider>,
        root,
      );
    });

    expect(seen).toEqual(["home", "tab:home"]);
  });

  it("only updates the selected slice when state changes", async () => {
    const runtime = createReactAppRuntime(createTestApp());
    const selected: string[] = [];
    const root = document.createElement("div");
    document.body.append(root);

    function Probe() {
      const value = useRuntimeState((state: TestState) => state.shell.currentTab);
      selected.push(value);
      return <text>{value}</text>;
    }

    await act(async () => {
      render(
        <AppRuntimeProvider runtime={runtime}>
          <Probe />
        </AppRuntimeProvider>,
        root,
      );
    });

    await act(async () => {
      await runtime.actions.callAction("updateTrace", { summary: "synced" });
    });

    expect(selected).toEqual(["home"]);
  });

  it("keeps the legacy compatibility runtime stable and fails unsupported snapshot tool execution", async () => {
    const store = createStore({
      initialState: {
        shell: {
          currentTab: "home" as const,
          recentTrace: null,
        },
        inbox: {
          query: "",
        },
      },
      reduce(state: TestState) {
        return state;
      },
    });
    const actionRuntime = createActionRuntime({
      store,
      actions: createTestApp().actions,
    });
    const runtimes: unknown[] = [];
    const root = document.createElement("div");
    document.body.append(root);

    function Probe() {
      runtimes.push(useAppRuntime());
      return <text>probe</text>;
    }

    await act(async () => {
      render(
        <AppProvider store={store} actionRuntime={actionRuntime}>
          <Probe />
        </AppProvider>,
        root,
      );
    });

    await act(async () => {
      render(
        <AppProvider store={store} actionRuntime={actionRuntime}>
          <Probe />
        </AppProvider>,
        root,
      );
    });

    expect(runtimes).toHaveLength(2);
    expect(runtimes[0]).toBe(runtimes[1]);

    const runtime = runtimes[0] as ReturnType<typeof useAppRuntime>;

    expect(() => runtime.toolBridge.getSnapshotBundle()).toThrow(
      "Snapshot rendering is not available through AppProvider",
    );
    await expect(
      runtime.toolBridge.executeTool("changeTab", { tab: "settings" }, "snap_123"),
    ).rejects.toThrow(
      "Snapshot-scoped tool execution is not available through AppProvider",
    );
  });
});
