// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { createActionRuntime } from "../src/core/action/createActionRuntime";
import { defineAction } from "../src/core/action/defineAction";
import { createStore } from "../src/core/state/createStore";
import { createTraceStore } from "../src/core/trace/createTraceStore";
import type { ActionResult } from "../src/core/types";

type EffectState = {
  steps: string[];
};

type EffectEvent =
  | { type: "SearchStarted"; query: string }
  | { type: "SearchFailed"; code: string; message: string }
  | { type: "StepRecorded"; label: string };

afterEach(() => {
  document.body.innerHTML = "";
});

describe("effect runtime", () => {
  it("returns a structured failure from a recoverable effect and emits the failure event", async () => {
    const traceStore = createTraceStore();
    const store = createStore<EffectState, EffectEvent>({
      initialState: {
        steps: [],
      },
      reduce(state, event) {
        switch (event.type) {
          case "SearchStarted":
            return {
              ...state,
              steps: [...state.steps, `start:${event.query}`],
            };
          case "SearchFailed":
            return {
              ...state,
              steps: [...state.steps, `failed:${event.code}`],
            };
          case "StepRecorded":
            return {
              ...state,
              steps: [...state.steps, event.label],
            };
        }
      },
    });

    const action = defineAction({
      name: "searchMessages",
      description: "Search messages through an effect.",
      schema: z.object({
        query: z.string(),
      }),
      visibility() {
        return true;
      },
      async handler(ctx, input) {
        ctx.emit({ type: "SearchStarted", query: input.query });

        const effectResult = await ctx.runEffect("searchMessages", input);
        if (effectResult && effectResult.success === false) {
          ctx.emit({
            type: "SearchFailed",
            code: effectResult.error.code,
            message: effectResult.error.message,
          });

          return {
            success: false,
            mutated: true,
            message: effectResult.error.message,
            error: effectResult.error,
          } satisfies ActionResult;
        }

        ctx.emit({ type: "StepRecorded", label: "completed" });

        return {
          success: true,
          mutated: true,
          message: "Search completed",
        } satisfies ActionResult;
      },
    });

    const runtime = createActionRuntime({
      store,
      actions: [action],
      traceStore,
      effects: {
        async searchMessages(ctx) {
          ctx.trace.update("search started");
          ctx.emit({ type: "StepRecorded", label: "effect:page-1" });
          ctx.emit({ type: "StepRecorded", label: "effect:page-2" });
          ctx.trace.update("search failed");

          return {
            success: false,
            error: {
              code: "NO_MATCH",
              message: "No matching data",
            },
          };
        },
      },
    });

    const result = await runtime.executeAction("searchMessages", {
      query: "roadmap",
    });

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        mutated: true,
        error: expect.objectContaining({
          code: "NO_MATCH",
          message: "No matching data",
        }),
      }),
    );
    expect(store.getState().steps).toEqual([
      "start:roadmap",
      "effect:page-1",
      "effect:page-2",
      "failed:NO_MATCH",
    ]);
    expect(traceStore.getState().entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionName: "searchMessages",
          status: "started",
        }),
        expect.objectContaining({
          actionName: "searchMessages",
          status: "updated",
          summary: "search started",
        }),
        expect.objectContaining({
          actionName: "searchMessages",
          status: "updated",
          summary: "search failed",
        }),
        expect.objectContaining({
          actionName: "searchMessages",
          status: "failed",
          summary: "No matching data",
        }),
      ]),
    );
  });

  it("records a failed trace when an effect throws unexpectedly", async () => {
    const traceStore = createTraceStore();
    const store = createStore<EffectState, EffectEvent>({
      initialState: {
        steps: [],
      },
      reduce(state, event) {
        switch (event.type) {
          case "SearchStarted":
            return {
              ...state,
              steps: [...state.steps, `start:${event.query}`],
            };
          case "SearchFailed":
            return {
              ...state,
              steps: [...state.steps, `failed:${event.code}`],
            };
          case "StepRecorded":
            return {
              ...state,
              steps: [...state.steps, event.label],
            };
        }
      },
    });

    const action = defineAction({
      name: "explode",
      description: "Trigger an unexpected failure.",
      schema: z.object({
        query: z.string(),
      }),
      visibility() {
        return true;
      },
      async handler(ctx, input) {
        ctx.emit({ type: "SearchStarted", query: input.query });
        await ctx.runEffect("explodeEffect", input);

        return {
          success: true,
          mutated: true,
          message: "Should not reach here",
        } satisfies ActionResult;
      },
    });

    const runtime = createActionRuntime({
      store,
      actions: [action],
      traceStore,
      effects: {
        explodeEffect() {
          throw new Error("Kaboom");
        },
      },
    });

    await expect(
      runtime.executeAction("explode", { query: "roadmap" }),
    ).rejects.toThrow("Kaboom");
    expect(traceStore.getState().recent).toEqual(
      expect.objectContaining({
        actionName: "explode",
        status: "failed",
        summary: "Kaboom",
      }),
    );
  });
});
