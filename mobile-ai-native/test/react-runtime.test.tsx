/** @jsxImportSource preact */
// @vitest-environment happy-dom
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { defineAction } from "../src/core/action/defineAction";
import { createReactAppRuntime } from "../src/projection/react/createReactAppRuntime";
import { AppRuntimeProvider } from "../src/projection/react/AppRuntimeProvider";
import { useRuntimeState } from "../src/projection/react/hooks";

type TestState = {
  shell: {
    currentTab: "home" | "settings";
  };
};

type TestEvent = {
  type: "TabChanged";
  tab: TestState["shell"]["currentTab"];
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

  return {
    initialState: {
      shell: {
        currentTab: "home",
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

      return state;
    },
    actions: [changeTab],
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("react runtime host adapter", () => {
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
});
