// @vitest-environment happy-dom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  AppRuntimeProvider,
  createHostLifecycleBridge,
  createReactNativeAppRuntime,
  useRuntimeHostLifecycle,
} from "../src/index";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

describe("host lifecycle bridge", () => {
  it("forwards app active/background and screen focus/blur transitions", () => {
    const bridge = createHostLifecycleBridge({
      appState: "background",
      screenState: "blurred",
    });
    const seen: string[] = [];

    const unsubscribe = bridge.subscribe(() => {
      const state = bridge.getState();
      seen.push(`${state.appState}:${state.screenState}`);
    });

    expect(bridge.getState()).toEqual({
      appState: "background",
      screenState: "blurred",
    });

    bridge.setAppActive();
    bridge.focusScreen();
    bridge.setAppBackground();
    bridge.blurScreen();

    unsubscribe();

    expect(bridge.getState()).toEqual({
      appState: "background",
      screenState: "blurred",
    });
    expect(seen).toEqual([
      "active:blurred",
      "active:focused",
      "background:focused",
      "background:blurred",
    ]);
  });

  it("exposes lifecycle state and forwarders through the hook", async () => {
    const bridge = createHostLifecycleBridge({
      appState: "background",
      screenState: "blurred",
    });
    const seen: Array<{
      appState: "active" | "background";
      screenState: "focused" | "blurred";
    }> = [];

    function Probe() {
      const lifecycle = useRuntimeHostLifecycle(bridge);
      seen.push(lifecycle.state);
      return (
        <button
          type="button"
          onClick={() => {
            lifecycle.setAppActive();
            lifecycle.focusScreen();
          }}
        >
          lifecycle
        </button>
      );
    }

    await renderIntoDocument(<Probe />);

    expect(seen).toEqual([
      {
        appState: "background",
        screenState: "blurred",
      },
    ]);

    await act(async () => {
      document.querySelector("button")?.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(seen.at(-1)).toEqual({
      appState: "active",
      screenState: "focused",
    });
  });

  it("can be wired into the RN adapter runtime boundary without exposing core internals", () => {
    const runtime = createReactNativeAppRuntime({
      initialState: { count: 0 },
      reduce(state: { count: number }) {
        return state;
      },
      actions: [],
    });
    const bridge = createHostLifecycleBridge();

    expect(runtime).not.toHaveProperty("store");
    expect(runtime).not.toHaveProperty("toolBridge");
    expect(runtime).not.toHaveProperty("traceStore");
    expect(bridge.getState()).toEqual({
      appState: "active",
      screenState: "focused",
    });

    // The lifecycle bridge is host-specific and should stay orthogonal to the runtime core.
    expect(runtime.state.getState()).toEqual({ count: 0 });
    expect(runtime.snapshot.getSnapshot().views[0]?.type).toBe("Root");
  });
});
