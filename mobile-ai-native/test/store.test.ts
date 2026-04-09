import { describe, expect, it } from "vitest";
import { createStore } from "../src/core/state/createStore";

describe("createStore", () => {
  it("applies events through the reducer", () => {
    const store = createStore({
      initialState: { count: 0 },
      reduce(state, event: { type: "Incremented" }) {
        if (event.type === "Incremented") {
          return { count: state.count + 1 };
        }

        return state;
      },
    });

    store.emit({ type: "Incremented" });

    expect(store.getState()).toEqual({ count: 1 });
  });
});
