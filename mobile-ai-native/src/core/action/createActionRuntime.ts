import type { ActionDefinition, ActionContext } from "./defineAction";
import type { ActionResult, Store, ToolDefinition, TraceStore } from "../types";
import { createTraceStore } from "../trace/createTraceStore";

export function createActionRuntime<State, Event>(config: {
  store: Store<State, Event>;
  actions: Array<ActionDefinition<State, Event, any>>;
  traceStore?: TraceStore;
  effects?: Record<
    string,
    (ctx: { getState(): State; emit(event: Event): void }, input: any) => Promise<void> | void
  >;
}) {
  const actionsByName = new Map(
    config.actions.map((action) => [action.name, action]),
  );
  const traceStore = config.traceStore ?? createTraceStore();

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
    traceStore.record({
      actionName: name,
      status: "started",
      summary: latestSummary,
    });

    const trace = {
      start(summary: string) {
        latestSummary = summary;
        traceStore.record({
          actionName: name,
          status: "started",
          summary,
        });
      },
      update(summary: string) {
        latestSummary = summary;
        traceStore.record({
          actionName: name,
          status: "updated",
          summary,
        });
      },
      success(summary?: string) {
        latestSummary = summary ?? latestSummary;
        traceStore.record({
          actionName: name,
          status: "succeeded",
          summary: latestSummary,
        });
      },
      fail(summary: string) {
        latestSummary = summary;
        traceStore.record({
          actionName: name,
          status: "failed",
          summary,
        });
      },
    };

    const ctx: ActionContext<State, Event> = {
      getState: () => config.store.getState(),
      emit: (event) => config.store.emit(event),
      runEffect: async (name, input) => {
        const effect = config.effects?.[name];
        if (!effect) {
          return;
        }

        await effect(
          {
            getState: () => config.store.getState(),
            emit: (event) => config.store.emit(event),
          },
          input,
        );
      },
      trace,
    };

    try {
      const result = await action.handler(ctx, parsed.data);

      if (result.success) {
        trace.success(result.message);
      } else {
        trace.fail(
          result.error?.message ?? result.message ?? `Action ${name} failed`,
        );
      }

      return result;
    } catch (error) {
      trace.fail(
        error instanceof Error ? error.message : `Action ${name} failed`,
      );
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
