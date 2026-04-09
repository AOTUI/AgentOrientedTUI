import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createActionRuntime } from "../src/core/action/createActionRuntime";
import { defineViewTypeTool } from "../src/index";
import { createStore } from "../src/core/state/createStore";

type TestState = {
  mode: "browse" | "edit";
};

type TestEvent = {
  type: "ModeChanged";
  mode: TestState["mode"];
};

describe("view type scoped tools", () => {
  it("only lists tools whose view type is currently relevant", () => {
    const store = createStore({
      initialState: {
        mode: "browse" as const,
      },
      reduce(state: TestState, event: TestEvent) {
        if (event.type === "ModeChanged") {
          return {
            ...state,
            mode: event.mode,
          };
        }

        return state;
      },
    });
    const relevantViewTypes = ["Workspace"] as const;

    const openFile = defineViewTypeTool(
      {
        name: "open_file",
        description: "Open the current file.",
        schema: z.object({
          path: z.string(),
        }),
        viewType: "Workspace",
        visibility() {
          return true;
        },
        handler() {
          return { success: true };
        },
      },
    );

    const editFile = defineViewTypeTool(
      {
        name: "edit_file",
        description: "Edit the current file.",
        schema: z.object({
          path: z.string(),
        }),
        viewType: "FileDetail",
        visibility() {
          return true;
        },
        handler() {
          return { success: true };
        },
      },
    );

    const runtime = createActionRuntime({
      store,
      actions: [openFile, editFile],
      getRelevantViewTypes: () => relevantViewTypes,
    } as any);

    expect(runtime.listVisibleTools().map((tool) => tool.name)).toEqual([
      "open_file",
    ]);
  });

  it("still applies visibility(state) after view type filtering", () => {
    const store = createStore({
      initialState: {
        mode: "browse" as const,
      },
      reduce(state: TestState, event: TestEvent) {
        if (event.type === "ModeChanged") {
          return {
            ...state,
            mode: event.mode,
          };
        }

        return state;
      },
    });
    const relevantViewTypes = ["FileDetail"] as const;

    const editFile = defineViewTypeTool(
      {
        name: "edit_file",
        description: "Edit the current file.",
        schema: z.object({
          path: z.string(),
        }),
        viewType: "FileDetail",
        visibility(state) {
          return state.mode === "edit";
        },
        handler() {
          return { success: true };
        },
      },
    );

    const workspaceHelp = defineViewTypeTool(
      {
        name: "workspace_help",
        description: "Show workspace help.",
        schema: z.object({
          topic: z.string(),
        }),
        viewType: "Workspace",
        visibility() {
          return true;
        },
        handler() {
          return { success: true };
        },
      },
    );

    const runtime = createActionRuntime({
      store,
      actions: [editFile, workspaceHelp],
      getRelevantViewTypes: () => relevantViewTypes,
    } as any);

    expect(runtime.listVisibleTools().map((tool) => tool.name)).toEqual([]);
  });

  it("does not execute a view-type tool when its view is not currently relevant", async () => {
    const store = createStore({
      initialState: {
        mode: "edit" as const,
      },
      reduce(state: TestState, event: TestEvent) {
        if (event.type === "ModeChanged") {
          return {
            ...state,
            mode: event.mode,
          };
        }

        return state;
      },
    });
    const relevantViewTypes = ["Workspace"] as const;

    const editFile = defineViewTypeTool(
      {
        name: "edit_file",
        description: "Edit the current file.",
        schema: z.object({
          path: z.string(),
        }),
        viewType: "FileDetail",
        visibility() {
          return true;
        },
        handler() {
          return { success: true, mutated: true };
        },
      },
    );

    const runtime = createActionRuntime({
      store,
      actions: [editFile],
      getRelevantViewTypes: () => relevantViewTypes,
    } as any);

    await expect(
      runtime.executeAction("edit_file", { path: "src/App.tsx" }),
    ).resolves.toMatchObject({
      success: false,
      error: {
        code: "ACTION_NOT_VISIBLE",
      },
    });
  });
});
