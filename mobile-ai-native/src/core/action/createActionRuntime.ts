import type { ActionDefinition, ActionContext } from "./defineAction";
import type { EffectMap } from "../effect/types";
import type { ActionResult, Store, ToolDefinition, TraceStore } from "../types";
import { createTraceStore } from "../trace/createTraceStore";

export function createActionRuntime<State, Event>(config: {
  store: Store<State, Event>;
  actions: Array<ActionDefinition<State, Event, any>>;
  traceStore?: TraceStore;
  effects?: EffectMap<State, Event>;
  getRelevantViewTypes?: () => readonly string[];
}) {
  const actionsByName = new Map(
    config.actions.map((action) => [action.name, action]),
  );
  const traceStore = config.traceStore ?? createTraceStore();

  function isActionRelevant(action: ActionDefinition<State, Event, any>) {
    const scopedAction = action as ActionDefinition<State, Event, any> & {
      viewType?: string;
    };
    const relevantViewTypes = config.getRelevantViewTypes?.() ?? [];

    if (!scopedAction.viewType) {
      return true;
    }

    return relevantViewTypes.includes(scopedAction.viewType);
  }

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

    if (
      !isActionRelevant(action) ||
      !action.visibility(config.store.getState())
    ) {
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

  function listVisibleTools(
    relevantViewTypes = config.getRelevantViewTypes?.() ?? [],
  ): ToolDefinition[] {
    const state = config.store.getState();
    const relevantViewTypeSet = new Set(relevantViewTypes);

    return config.actions
      .filter((action) => {
        const scopedAction = action as ActionDefinition<State, Event, any> & {
          viewType?: string;
        };
        const isViewTypeRelevant =
          !scopedAction.viewType ||
          relevantViewTypeSet.has(scopedAction.viewType);

        return isViewTypeRelevant && action.visibility(state);
      })
      .map((action) => {
        const scopedAction = action as ActionDefinition<State, Event, any> & {
          viewType?: string;
        };

        return {
          name: action.name,
          description: action.description,
          inputSchema: action.schema,
          meta: action.meta ?? {},
          ...(scopedAction.viewType
            ? { viewType: scopedAction.viewType }
            : {}),
        };
      });
  }

  return {
    executeAction,
    listVisibleTools,
  };
}
