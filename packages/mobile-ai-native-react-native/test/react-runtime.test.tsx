// @vitest-environment happy-dom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { defineAction, type SnapshotBundle } from "@aotui/mobile-ai-native";
import {
  AppRuntimeProvider,
  createReactNativeAppRuntime,
  useRuntimeActions,
  useRuntimeSnapshot,
  useRuntimeState,
  useRuntimeTrace,
} from "../src/index";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type TestState = {
  shell: {
    currentTab: "home" | "settings";
    recentTrace: string | null;
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
      return { success: true, mutated: true };
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
      return { success: true, mutated: true, message: input.summary };
    },
  });

  return {
    initialState: {
      shell: {
        currentTab: "home",
        recentTrace: null,
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

const mountedRoots: Root[] = [];

afterEach(async () => {
  await act(async () => {
    while (mountedRoots.length > 0) {
      mountedRoots.pop()?.unmount();
    }
  });
  document.body.innerHTML = "";
});

async function renderIntoDocument(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  mountedRoots.push(root);

  await act(async () => {
    root.render(node);
  });

  return root;
}

describe("react-native runtime adapter", () => {
  it("hides raw core internals behind an adapter runtime boundary", () => {
    const runtime = createReactNativeAppRuntime(createTestApp());
    const snapshot = runtime.snapshot.getSnapshot();

    expect("store" in runtime).toBe(false);
    expect("traceStore" in runtime).toBe(false);
    expect("toolBridge" in runtime).toBe(false);
    expect(runtime.state.getState().shell.currentTab).toBe("home");
    expect(runtime.trace.getState()).toEqual({
      entries: [],
      recent: null,
    });
    expect(snapshot.views[0]?.type).toBe("Root");
    expect(runtime.snapshot.getSnapshot()).toBe(snapshot);
  });

  it("publishes runtime actions through the provider", async () => {
    const runtime = createReactNativeAppRuntime(createTestApp());
    const seen: Array<typeof runtime.actions> = [];

    function Probe() {
      seen.push(useRuntimeActions());
      return <div>probe</div>;
    }

    await renderIntoDocument(
      <AppRuntimeProvider runtime={runtime}>
        <Probe />
      </AppRuntimeProvider>,
    );

    expect(seen).toEqual([runtime.actions]);

    await act(async () => {
      await seen[0]?.callAction("changeTab", { tab: "settings" });
    });

    expect(runtime.state.getState().shell.currentTab).toBe("settings");
  });

  it("re-renders a consumer when runtime state changes", async () => {
    const runtime = createReactNativeAppRuntime(createTestApp());
    const seen: string[] = [];

    function Probe() {
      const tab = useRuntimeState((state: TestState) => state.shell.currentTab);
      seen.push(tab);
      return <div>{tab}</div>;
    }

    await renderIntoDocument(
      <AppRuntimeProvider runtime={runtime}>
        <Probe />
      </AppRuntimeProvider>,
    );

    await act(async () => {
      await runtime.actions.callAction("changeTab", { tab: "settings" });
    });

    expect(seen).toEqual(["home", "settings"]);
  });

  it("keeps snapshot reads stable until state changes", async () => {
    const runtime = createReactNativeAppRuntime(createTestApp());

    const firstSnapshotId = runtime.snapshot.getSnapshot().snapshotId;
    const secondSnapshotId = runtime.snapshot.getSnapshot().snapshotId;

    expect(secondSnapshotId).toBe(firstSnapshotId);

    await act(async () => {
      await runtime.actions.callAction("changeTab", { tab: "settings" });
    });

    const thirdSnapshotId = runtime.snapshot.getSnapshot().snapshotId;

    expect(thirdSnapshotId).not.toBe(firstSnapshotId);
  });

  it("shares the adapter snapshot cache with React snapshot consumers", async () => {
    const runtime = createReactNativeAppRuntime(createTestApp());
    const initialSnapshot = runtime.snapshot.getSnapshot();
    const seen: SnapshotBundle[] = [];

    function Probe() {
      seen.push(useRuntimeSnapshot((snapshot) => snapshot));
      return <div>snapshot</div>;
    }

    await renderIntoDocument(
      <AppRuntimeProvider runtime={runtime}>
        <Probe />
      </AppRuntimeProvider>,
    );

    expect(seen[0]).toBe(initialSnapshot);
    expect(runtime.snapshot.getSnapshot()).toBe(initialSnapshot);

    await act(async () => {
      await runtime.actions.callAction("changeTab", { tab: "settings" });
    });

    const latestSnapshot = runtime.snapshot.getSnapshot();

    expect(latestSnapshot).not.toBe(initialSnapshot);
    expect(seen.at(-1)).toBe(latestSnapshot);
    expect(runtime.snapshot.getSnapshot()).toBe(latestSnapshot);
  });

  it("emits one snapshot update per state change", async () => {
    const runtime = createReactNativeAppRuntime(createTestApp());
    const seenSnapshotIds: string[] = [];

    function Probe() {
      seenSnapshotIds.push(useRuntimeSnapshot((snapshot) => snapshot.snapshotId));
      return <div>snapshot-id</div>;
    }

    await renderIntoDocument(
      <AppRuntimeProvider runtime={runtime}>
        <Probe />
      </AppRuntimeProvider>,
    );

    await act(async () => {
      await runtime.actions.callAction("changeTab", { tab: "settings" });
    });

    const uniqueSnapshotIds = [...new Set(seenSnapshotIds)];

    expect(uniqueSnapshotIds).toHaveLength(2);
    expect(uniqueSnapshotIds[0]).not.toBe(uniqueSnapshotIds[1]);
  });

  it("reads trace and snapshot selectors from the runtime", async () => {
    const runtime = createReactNativeAppRuntime(createTestApp());
    const seen: string[] = [];

    function Probe() {
      const traceSummary = useRuntimeTrace(
        (trace) => trace.recent?.summary ?? "idle",
      );
      const snapshotSummary = useRuntimeSnapshot(
        (snapshot) =>
          `${snapshot.views[0]?.type ?? "none"}:${snapshot.visibleTools.map((tool) => tool.name).join(",")}`,
      );
      seen.push(`${traceSummary}|${snapshotSummary}`);
      return <div>{traceSummary}</div>;
    }

    await renderIntoDocument(
      <AppRuntimeProvider runtime={runtime}>
        <Probe />
      </AppRuntimeProvider>,
    );

    await act(async () => {
      await runtime.actions.callAction("updateTrace", { summary: "synced" });
    });

    expect(seen[0]).toBe("idle|Root:changeTab,updateTrace");
    expect(seen.at(-1)).toBe("synced|Root:changeTab,updateTrace");
  });
});
