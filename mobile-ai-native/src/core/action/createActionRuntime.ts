import type { ActionDefinition, ActionContext } from "./defineAction";
import type { EffectMap } from "../effect/types";
import type { ActionResult, Store, ToolDefinition, TraceStore } from "../types";
import { createTraceStore } from "../trace/createTraceStore";

export function createActionRuntime<State, Event>(config: {
  store: Store<State, Event>;
  actions: Array<ActionDefinition<State, Event, any>>;
  traceStore?: TraceStore;
  effects?: EffectMap<State, Event>;
}) {
  const actionsByName = new Map(
    config.actions.map((action) => [action.name, action]),
  );
  const traceStore = config.traceStore ?? createTraceStore();

  function recordTrace(
    actionName: string,
    status: "started" | "updated" | "succeeded" | "failed",
    summary: string,
  ) {
    traceStore.record({
      actionName,
      status,
      summary,
    });
  }

  async function executeAction(
    name: string,
    input: Record<string, unknown>,
  ): Promise<ActionResult> {
    const action = actionsByName.get(name);
    if (!action) {
      return {
        success: false,
        error: {
          code: "ACTION_NOT_FOUND",
          message: `Action ${name} was not found`,
        },
      };
    }

    if (!action.visibility(config.store.getState())) {
      return {
        success: false,
        error: {
          code: "ACTION_NOT_VISIBLE",
          message: `Action ${name} is not currently visible`,
        },
      };
    }

    const parsed = action.schema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: "ACTION_INVALID_INPUT",
          message: parsed.error.message,
        },
      };
    }

    let latestSummary = `Started action ${name}`;
    recordTrace(name, "started", latestSummary);

    const trace = {
      update(summary: string) {
        latestSummary = summary;
        recordTrace(name, "updated", summary);
      },
    };

    const ctx: ActionContext<State, Event> = {
      getState: () => config.store.getState(),
      emit: (event) => config.store.emit(event),
      runEffect: (name, input) => {
        const effect = config.effects?.[name];
        if (!effect) {
          return Promise.resolve(undefined);
        }

        return Promise.resolve(
          effect(
          {
            getState: () => config.store.getState(),
            emit: (event) => config.store.emit(event),
            trace,
          },
          input,
        ),
        );
      },
      trace,
    };

    try {
      const result = await action.handler(ctx, parsed.data);
      if (result.success) {
        latestSummary = result.message ?? latestSummary;
        recordTrace(name, "succeeded", latestSummary);
      } else {
        latestSummary =
          result.error?.message ?? result.message ?? `Action ${name} failed`;
        recordTrace(
          name,
          "failed",
          latestSummary,
        );
      }

      return result;
    } catch (error) {
      latestSummary =
        error instanceof Error ? error.message : `Action ${name} failed`;
      recordTrace(name, "failed", latestSummary);
      throw error;
    }
  }

  function listVisibleTools(): ToolDefinition[] {
    const state = config.store.getState();

    return config.actions
      .filter((action) => action.visibility(state))
      .map((action) => ({
        name: action.name,
        description: action.description,
        inputSchema: action.schema,
        meta: action.meta ?? {},
      }));
  }

  return {
    executeAction,
    listVisibleTools,
  };
}
