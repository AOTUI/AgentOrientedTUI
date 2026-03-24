// @vitest-environment happy-dom
import { h, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { createInboxActions } from "../src/demo/inbox/actions";
import { createInboxEffects } from "../src/demo/inbox/effects";
import {
  createInitialInboxState,
  reduceInboxState,
} from "../src/demo/inbox/state";
import { AppRuntimeProvider } from "../src/projection/react/AppRuntimeProvider";
import { createReactAppRuntime } from "../src/projection/react/createReactAppRuntime";
import { useRuntimeTrace } from "../src/projection/react/hooks";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("runtime trace stream", () => {
  it("records action lifecycle from started to succeeded", async () => {
    const actions = createInboxActions();
    const messages = [{ id: "m1", subject: "Invoice ready", opened: false }];
    const runtime = createReactAppRuntime({
      initialState: createInitialInboxState(messages),
      reduce: reduceInboxState,
      actions: [actions.openMessage, actions.searchMessages],
      effects: createInboxEffects(messages),
    });

    await runtime.actions.callAction("searchMessages", { query: "invoice" });

    expect(runtime.trace.getEntries()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "started",
          actionName: "searchMessages",
        }),
        expect.objectContaining({
          status: "updated",
          actionName: "searchMessages",
        }),
        expect.objectContaining({
          status: "succeeded",
          actionName: "searchMessages",
        }),
      ]),
    );
    expect(runtime.trace.getRecent()).toEqual(
      expect.objectContaining({
        status: "succeeded",
        actionName: "searchMessages",
      }),
    );
  });

  it("subscribes React consumers to recent trace updates", async () => {
    const actions = createInboxActions();
    const messages = [{ id: "m1", subject: "Invoice ready", opened: false }];
    const runtime = createReactAppRuntime({
      initialState: createInitialInboxState(messages),
      reduce: reduceInboxState,
      actions: [actions.openMessage, actions.searchMessages],
      effects: createInboxEffects(messages),
    });
    const seen: Array<string | null> = [];
    const root = document.createElement("div");
    document.body.append(root);

    function Probe() {
      const summary = useRuntimeTrace((trace) => trace.recent?.summary ?? null);
      const label = summary === null ? "idle" : summary;
      seen.push(summary);
      return h("text", null, label);
    }

    await act(async () => {
      render(
        h(AppRuntimeProvider, { runtime }, h(Probe, {})),
        root,
      );
    });

    await act(async () => {
      await runtime.actions.callAction("searchMessages", { query: "Invoice" });
    });

    expect(seen).toContain(null);
    expect(seen.at(-1)).toBe(runtime.trace.getRecent()?.summary ?? null);
    expect(runtime.trace.getRecent()).toEqual(
      expect.objectContaining({
        status: "succeeded",
        actionName: "searchMessages",
      }),
    );
  });
});
